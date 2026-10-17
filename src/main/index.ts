/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, net, protocol, session, shell, Tray, Menu, nativeImage, Notification } from 'electron'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { basename, extname, join } from 'path'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { DEFAULT_DB, type Db, type DesktopPreferences, type MediaKey, type SearchOptions, type Track } from '../shared/types'
import { search, searchPage, featured, MAX_PAGES } from './sources'
import { getLyrics } from './lyrics'
import { findLocalCover } from './local-covers'
import { checkYouTubeKey, youtubeLastError } from './sources/youtube'
import { clearYoutubeKey, getYoutubeKey, setYoutubeKey } from './youtube-key'
import { isKeyShape } from '../shared/youtube'
import { discordPresence } from './discordPresence'
import { appUpdates } from './updates'

// Keep the existing userData path unchanged to preserve libraries and settings.
// Chromium cache is disposable and belongs in a per-user local directory.
// This must run before app.whenReady() and before creating any Session.
function configureStorage(): void {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const cacheRoot = join(process.env.LOCALAPPDATA, 'Openfy', 'ChromiumCache')
    try {
      mkdirSync(cacheRoot, { recursive: true })
      app.setPath('sessionData', cacheRoot)
    } catch (error) {
      // Never block launch if a custom cache path cannot be prepared.
      console.warn('[Openfy] Cache local indisponível; usando caminho padrão:', error)
    }
  }
}
configureStorage()

// Prevent simultaneous Openfy processes from contending for Chromium cache.
// Do not confuse this with the app's background tray mode.
const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
}

const SCHEME = 'openfy-file'
const THEME_SCHEME = 'openfy-theme'
const THEME_IMAGE_MAX_BYTES = 12 * 1024 * 1024
const themeBackgroundDir = (): string => join(app.getPath('userData'), 'theme-backgrounds')
const desktopPrefsPath = (): string => join(app.getPath('userData'), 'desktop-preferences.json')
let desktopPrefs: DesktopPreferences = { minimizeToTray: false, notifications: false, discordPresence: false }
let tray: Tray | null = null
let quitting = false
let playback = { playing: false, title: '', artist: '' }
let mainWindow: BrowserWindow | null = null
const pulsePath = (): string => join(__dirname, '../../resources/openfy-pulse.ico')
const sendMedia = (key: MediaKey): void => mainWindow?.webContents.send('media-key', key)
function refreshTray(): void {
  if (!tray) return
  tray.setToolTip(playback.title ? `Openfy — ${playback.title}` : 'Openfy')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Openfy', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { label: playback.title || 'Nenhuma música selecionada', enabled: false },
    { type: 'separator' },
    { label: 'Anterior', click: () => sendMedia('prev') },
    { label: playback.playing ? 'Pausar' : 'Reproduzir', click: () => sendMedia('play-pause') },
    { label: 'Próxima', click: () => sendMedia('next') },
    { type: 'separator' },
    { label: 'Sair do Openfy', click: () => { quitting = true; app.quit() } }
  ]))
}
function setupTray(): void {
  if (tray || !existsSync(pulsePath())) return
  tray = new Tray(nativeImage.createFromPath(pulsePath()))
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus() })
  refreshTray()
}
// Windows thumbnail toolbar only accepts actual bitmap images reliably.
// SVG data URLs can produce empty NativeImages on Electron/Windows.
function updateThumbbar(win: BrowserWindow): void {
  if (process.platform !== 'win32' || win.isDestroyed()) return
  const mk = (kind: 'prev'|'play'|'pause'|'next'): Electron.NativeImage =>
    nativeImage.createFromPath(join(__dirname, '../../resources/thumbar', `${kind}.png`))
  const buttons = [
    { tooltip: 'Anterior', icon: mk('prev'), click: () => sendMedia('prev') },
    { tooltip: playback.playing ? 'Pausar' : 'Reproduzir', icon: mk(playback.playing ? 'pause' : 'play'), click: () => sendMedia('play-pause') },
    { tooltip: 'Próxima', icon: mk('next'), click: () => sendMedia('next') }
  ]
  if (buttons.some(button => button.icon.isEmpty())) {
    console.error('[Openfy] Ícones da barra de tarefas não foram carregados.')
    return
  }
  const success = win.setThumbarButtons(buttons)
  if (!success) console.warn('[Openfy] Windows recusou os controles da prévia da janela.')
}

const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus', '.weba'])

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: openfy-theme:",
  "media-src 'self' openfy-file: https:",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "connect-src 'self' https:"
].join('; ')

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  },
  {
    scheme: THEME_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true }
  }
])

const dbPath = (): string => join(app.getPath('userData'), 'openfy-data.json')

const KNOWN_SOURCES = new Set(['local', 'audius', 'jamendo', 'archive', 'openverse', 'librivox', 'youtube'])

async function readDb(): Promise<Db> {
  try {
    const raw = JSON.parse(await fs.readFile(dbPath(), 'utf8'))
    // Dados de versões antigas podem ter faixas de fontes removidas: descarta.
    const tracks: Track[] = (Array.isArray(raw.tracks) ? raw.tracks : []).filter((t: Track) =>
      KNOWN_SOURCES.has(t?.source)
    )
    const ids = new Set(tracks.map((t) => t.id))
    const liked: string[] = (Array.isArray(raw.liked) ? raw.liked : []).filter((id: string) => ids.has(id))
    const playlists = (Array.isArray(raw.playlists) ? raw.playlists : []).map((p: Db['playlists'][number]) => {
      const trackIds = (Array.isArray(p.trackIds) ? p.trackIds : []).filter((id) => ids.has(id))
      const trackIdSet = new Set(trackIds)
      const trackAddedAt = p.trackAddedAt && typeof p.trackAddedAt === 'object' && !Array.isArray(p.trackAddedAt)
        ? Object.fromEntries(Object.entries(p.trackAddedAt).filter(([id, addedAt]) =>
            trackIdSet.has(id) && typeof addedAt === 'number' && Number.isFinite(addedAt)
          ))
        : undefined
      return { ...p, trackIds, trackAddedAt }
    })
    return {
      tracks,
      liked,
      playlists,
      settings: {
        volume: typeof raw.settings?.volume === 'number' ? raw.settings.volume : DEFAULT_DB.settings.volume,
        automaticLocalCovers: raw.settings?.automaticLocalCovers === true
      }
    }
  } catch {
    return structuredClone(DEFAULT_DB)
  }
}

let writeChain: Promise<void> = Promise.resolve()
function writeDb(db: Db): Promise<void> {
  writeChain = writeChain
    .then(async () => {
      const tmp = dbPath() + '.tmp'
      await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8')
      await fs.rename(tmp, dbPath())
    })
    .catch((err) => console.error('falha ao salvar db', err))
  return writeChain
}

function trackFromFile(path: string): Track {
  const name = basename(path, extname(path)).replace(/_/g, ' ').trim()
  const m = name.match(/^(.+?)\s+-\s+(.+)$/)
  return {
    id: 'local:' + createHash('sha1').update(path).digest('hex').slice(0, 16),
    title: m ? m[2].trim() : name,
    artist: m ? m[1].trim() : 'Artista desconhecido',
    source: 'local',
    uri: `${SCHEME}://media/${encodeURIComponent(path)}`
  }
}

async function walk(dir: string, out: string[], depth = 0): Promise<void> {
  if (depth > 8) return
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) await walk(full, out, depth + 1)
    else if (AUDIO_EXT.has(extname(e.name).toLowerCase())) out.push(full)
  }
}


function registerIpc(): void {
  ipcMain.handle('db:load', () => readDb())

  ipcMain.handle('db:save', async (_e, db: Db) => {
    if (!db || !Array.isArray(db.tracks) || !Array.isArray(db.playlists) || typeof db.settings !== 'object') return
    await writeDb(db)
  })

  ipcMain.handle('library:pickFiles', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Adicionar músicas',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Áudio', extensions: [...AUDIO_EXT].map((e) => e.slice(1)) }]
    })
    return res.canceled ? [] : res.filePaths.map(trackFromFile)
  })

  ipcMain.handle('library:pickFolder', async () => {
    const res = await dialog.showOpenDialog({ title: 'Adicionar pasta', properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return []
    const files: string[] = []
    await walk(res.filePaths[0], files)
    return files.map(trackFromFile)
  })

  ipcMain.handle('theme:pickBackground', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Escolher imagem de fundo do tema',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    const selectedPath = result.filePaths[0]
    if (result.canceled || !selectedPath) return null

    const fileStat = await fs.stat(selectedPath)
    if (fileStat.size <= 0 || fileStat.size > THEME_IMAGE_MAX_BYTES) {
      throw new Error('A imagem precisa ter até 12 MB.')
    }
    const image = await fs.readFile(selectedPath)
    const isPng = image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const isJpeg = image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    const isWebp = image.length >= 12 && image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP'
    const extension = isPng ? 'png' : isJpeg ? 'jpg' : isWebp ? 'webp' : null
    if (!extension) throw new Error('Formato de imagem não reconhecido. Use PNG, JPEG ou WebP.')

    const hash = createHash('sha256').update(image).digest('hex')
    await fs.mkdir(themeBackgroundDir(), { recursive: true })
    await fs.writeFile(join(themeBackgroundDir(), `${hash}.${extension}`), image)
    return `${THEME_SCHEME}://background/${hash}.${extension}`
  })

  const searchOptions = (opts: unknown): SearchOptions => {
    const o = opts && typeof opts === 'object' ? (opts as Record<string, unknown>) : {}
    const page = typeof o.page === 'number' && Number.isFinite(o.page) ? Math.floor(o.page) : 1
    return {
      archiveOpenOnly: o.archiveOpenOnly !== false,
      page: Math.min(MAX_PAGES, Math.max(1, page)),
      youtube: o.youtube === true
    }
  }
  const searchText = (q: unknown): string => (typeof q === 'string' ? q.trim().slice(0, 100) : '')
  ipcMain.handle('api:search', async (_e, q: unknown, opts: unknown) => {
    const query = searchText(q)
    return query ? search(query, searchOptions(opts)) : []
  })
  ipcMain.handle('api:searchPage', async (_e, q: unknown, opts: unknown) => {
    const query = searchText(q)
    return query ? searchPage(query, searchOptions(opts)) : { tracks: [], hasMore: false }
  })

  ipcMain.handle('api:lyrics', (_e, title: unknown, artist: unknown, duration: unknown) => {
    if (typeof title !== 'string' || !title.trim() || title.length > 300
      || typeof artist !== 'string' || !artist.trim() || artist.length > 300) {
      throw new Error('Título ou artista inválido para buscar a letra.')
    }
    const validDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? Math.min(duration, 24 * 60 * 60)
      : undefined
    return getLyrics(title.trim(), artist.trim(), validDuration)
  })

  ipcMain.handle('api:findLocalCover', (_e, title: unknown, artist: unknown) => {
    if (typeof title !== 'string' || !title.trim() || title.length > 300
      || typeof artist !== 'string' || artist.length > 300) {
      throw new Error('Título ou artista inválido para buscar a capa.')
    }
    return findLocalCover(title.trim(), artist.trim())
  })

  ipcMain.handle('youtube:status', async () => ({ hasKey: !!(await getYoutubeKey()), lastError: youtubeLastError() }))
  ipcMain.handle('youtube:setKey', async (_event, key: unknown) => {
    const value = typeof key === 'string' ? key.trim() : ''
    if (!isKeyShape(value)) {
      return { ok: false, error: 'Formato de chave inválido. Verifique a chave da YouTube Data API v3.' }
    }
    const problem = await checkYouTubeKey(value)
    if (problem) return { ok: false, error: problem }
    try {
      await setYoutubeKey(value)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Não foi possível salvar a chave.' }
    }
  })
  ipcMain.handle('youtube:clearKey', async () => clearYoutubeKey())

  ipcMain.handle('api:featured', () => featured())
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1220,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0b0f',
    title: 'Openfy',
    ...(existsSync(pulsePath()) ? { icon: pulsePath() } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow = win
  win.on('close', (event) => {
    if (!quitting && desktopPrefs.minimizeToTray) { event.preventDefault(); setupTray(); win.hide() }
  })
  // Reapply after the native window is visible and after taskbar restoration.
  win.once('ready-to-show', () => updateThumbbar(win))
  win.on('show', () => updateThumbbar(win))
  win.on('restore', () => updateThumbbar(win))
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env['ELECTRON_RENDERER_URL']
    if (!(dev && url.startsWith(dev)) && !url.startsWith('file://')) e.preventDefault()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

function registerMediaKeys(getWin: () => BrowserWindow | null): void {
  const map: Record<string, MediaKey> = {
    MediaPlayPause: 'play-pause',
    MediaNextTrack: 'next',
    MediaPreviousTrack: 'prev'
  }
  for (const [accel, key] of Object.entries(map)) {
    try {
      globalShortcut.register(accel, () => getWin()?.webContents.send('media-key', key))
    } catch {
      /* atalho indisponível nesta plataforma */
    }
  }
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.openfy.app')
}

if (hasInstanceLock) app.whenReady().then(() => {
  protocol.handle(SCHEME, async (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname.slice(1))
    if (!AUDIO_EXT.has(extname(p).toLowerCase())) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(p).toString(), { headers: req.headers })
  })
  protocol.handle(THEME_SCHEME, async (req) => {
    const url = new URL(req.url)
    const match = url.hostname === 'background' && /^\/([a-f0-9]{64})\.(png|jpg|webp)$/.exec(url.pathname)
    if (!match) return new Response('forbidden', { status: 403 })
    const [, hash, extension] = match
    const contentType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`
    const image = await fs.readFile(join(themeBackgroundDir(), `${hash}.${extension}`))
    if (createHash('sha256').update(image).digest('hex') !== hash) return new Response('not found', { status: 404 })
    return new Response(new Uint8Array(image), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' }
    })
  })

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube.com/*', 'https://www.youtube-nocookie.com/*'] },
    (details, callback) => callback({
      requestHeaders: { ...details.requestHeaders, Referer: 'https://github.com/tklabs11/openfy' }
    })
  )

  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    if (app.isPackaged && details.url.startsWith('file://')) {
      cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [PROD_CSP] } })
      return
    }
    cb({})
  })

  try {
    const saved = JSON.parse(readFileSync(desktopPrefsPath(), 'utf8'))
    const fadeSeconds = [0, 0.5, 1, 2, 3, 4, 6].find((value) => value === saved.fadeSeconds)
    desktopPrefs = {
      minimizeToTray: saved.minimizeToTray === true,
      notifications: saved.notifications === true,
      discordPresence: saved.discordPresence === true,
      ...(fadeSeconds !== undefined ? { fadeSeconds } : {})
    }
  } catch { /* defaults */ }
  ipcMain.handle('desktop:getPreferences', () => desktopPrefs)
  ipcMain.handle('desktop:discordPresenceStatus', () => discordPresence.getStatus())
  ipcMain.handle('app:update:state', () => appUpdates.getState())
  ipcMain.handle('app:update:check', () => appUpdates.check())
  ipcMain.handle('app:update:install', () => appUpdates.install())
  ipcMain.handle('desktop:setPreferences', async (_event, prefs: unknown) => {
    if (!prefs || typeof prefs !== 'object') return
    const p = prefs as Record<string, unknown>
    const fadeSeconds = [0, 0.5, 1, 2, 3, 4, 6].find((value) => value === p.fadeSeconds)
    desktopPrefs = {
      minimizeToTray: p.minimizeToTray === true,
      notifications: p.notifications === true,
      discordPresence: p.discordPresence === true,
      ...(fadeSeconds !== undefined
        ? { fadeSeconds }
        : desktopPrefs.fadeSeconds !== undefined
          ? { fadeSeconds: desktopPrefs.fadeSeconds }
          : {})
    }
    await fs.writeFile(desktopPrefsPath(), JSON.stringify(desktopPrefs), 'utf8')
    discordPresence.setEnabled(desktopPrefs.discordPresence)
    if (desktopPrefs.minimizeToTray) setupTray()
    else if (tray) { tray.destroy(); tray = null }
  })
  discordPresence.setStatusListener((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('desktop:discordPresenceStatus', status)
  })
  discordPresence.setEnabled(desktopPrefs.discordPresence)
  ipcMain.on('desktop:playback', (_event, data: unknown) => {
    if (!data || typeof data !== 'object') return
    const p = data as Record<string, unknown>
    const title = typeof p.title === 'string' ? p.title.slice(0, 180) : ''
    const artist = typeof p.artist === 'string' ? p.artist.slice(0, 180) : ''
    const duration = typeof p.duration === 'number' && Number.isFinite(p.duration) ? p.duration : 0
    const position = typeof p.position === 'number' && Number.isFinite(p.position) ? p.position : 0
    const changed = title && title !== playback.title
    playback = { playing: p.playing === true, title, artist }
    discordPresence.updatePlayback({ playing: playback.playing, title, artist, duration, position })
    if (mainWindow && !mainWindow.isDestroyed()) updateThumbbar(mainWindow)
    refreshTray()
    if (changed && playback.playing && desktopPrefs.notifications && Notification.isSupported()) new Notification({ title: 'Tocando agora no Openfy', body: `${title} — ${artist}` }).show()
  })
  registerIpc()
  let win: BrowserWindow | null = createWindow()
  win.on('closed', () => (win = null))
  registerMediaKeys(() => win)
  appUpdates.setListener((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:update:state', state)
  })
  appUpdates.initialize(app.isPackaged, process.platform, app.getVersion())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      win = createWindow()
      win.on('closed', () => (win = null))
    }
  })
})

app.on('before-quit', () => { quitting = true })
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); discordPresence.setEnabled(false) })
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
