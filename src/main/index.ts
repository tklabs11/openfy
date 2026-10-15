/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, net, protocol, session, shell, Tray, Menu, nativeImage, Notification } from 'electron'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { basename, extname, join } from 'path'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { DEFAULT_DB, type Db, type MediaKey, type Track } from '../shared/types'
import { search, featured } from './sources'

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
const desktopPrefsPath = (): string => join(app.getPath('userData'), 'desktop-preferences.json')
let desktopPrefs = { minimizeToTray: false, notifications: false }
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
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self' openfy-file: https:",
  "frame-src 'none'",
  "connect-src 'self' https:"
].join('; ')

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

const dbPath = (): string => join(app.getPath('userData'), 'openfy-data.json')

const KNOWN_SOURCES = new Set(['local', 'audius', 'jamendo', 'archive', 'openverse'])

async function readDb(): Promise<Db> {
  try {
    const raw = JSON.parse(await fs.readFile(dbPath(), 'utf8'))
    // Dados de versões antigas podem ter faixas de fontes removidas: descarta.
    const tracks: Track[] = (Array.isArray(raw.tracks) ? raw.tracks : []).filter((t: Track) =>
      KNOWN_SOURCES.has(t?.source)
    )
    const ids = new Set(tracks.map((t) => t.id))
    const liked: string[] = (Array.isArray(raw.liked) ? raw.liked : []).filter((id: string) => ids.has(id))
    const playlists = (Array.isArray(raw.playlists) ? raw.playlists : []).map((p: Db['playlists'][number]) => ({
      ...p,
      trackIds: (Array.isArray(p.trackIds) ? p.trackIds : []).filter((id) => ids.has(id))
    }))
    return {
      tracks,
      liked,
      playlists,
      settings: {
        volume: typeof raw.settings?.volume === 'number' ? raw.settings.volume : DEFAULT_DB.settings.volume
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

  ipcMain.handle('api:search', async (_e, q: unknown) => {
    const query = typeof q === 'string' ? q.trim().slice(0, 100) : ''
    return query ? search(query) : []
  })

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
    ...(existsSync(join(__dirname, '../../resources/openfy-pulse.png')) ? { icon: join(__dirname, '../../resources/openfy-pulse.png') } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow = win
  win.on('minimize', () => {
    if (desktopPrefs.minimizeToTray) { setupTray(); win.hide() }
  })
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

if (hasInstanceLock) app.whenReady().then(() => {
  protocol.handle(SCHEME, async (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname.slice(1))
    if (!AUDIO_EXT.has(extname(p).toLowerCase())) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(p).toString(), { headers: req.headers })
  })

  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    if (app.isPackaged && details.url.startsWith('file://')) {
      cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [PROD_CSP] } })
      return
    }
    cb({})
  })

  try { const saved = JSON.parse(readFileSync(desktopPrefsPath(), 'utf8')); desktopPrefs = { minimizeToTray: saved.minimizeToTray === true, notifications: saved.notifications === true } } catch { /* defaults */ }
  ipcMain.handle('desktop:getPreferences', () => desktopPrefs)
  ipcMain.handle('desktop:setPreferences', async (_event, prefs: unknown) => {
    if (!prefs || typeof prefs !== 'object') return
    const p = prefs as Record<string, unknown>
    desktopPrefs = { minimizeToTray: p.minimizeToTray === true, notifications: p.notifications === true }
    await fs.writeFile(desktopPrefsPath(), JSON.stringify(desktopPrefs), 'utf8')
    if (desktopPrefs.minimizeToTray) setupTray()
    else if (tray) { tray.destroy(); tray = null }
  })
  ipcMain.on('desktop:playback', (_event, data: unknown) => {
    if (!data || typeof data !== 'object') return
    const p = data as Record<string, unknown>
    const title = typeof p.title === 'string' ? p.title.slice(0, 180) : ''
    const artist = typeof p.artist === 'string' ? p.artist.slice(0, 180) : ''
    const changed = title && title !== playback.title
    playback = { playing: p.playing === true, title, artist }
    if (mainWindow && !mainWindow.isDestroyed()) updateThumbbar(mainWindow)
    refreshTray()
    if (changed && playback.playing && desktopPrefs.notifications && Notification.isSupported()) new Notification({ title: 'Tocando agora no Openfy', body: `${title} — ${artist}` }).show()
  })
  registerIpc()
  let win: BrowserWindow | null = createWindow()
  win.on('closed', () => (win = null))
  registerMediaKeys(() => win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      win = createWindow()
      win.on('closed', () => (win = null))
    }
  })
})

app.on('before-quit', () => { quitting = true })
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy() })
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
