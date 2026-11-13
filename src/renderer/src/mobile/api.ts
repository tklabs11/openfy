import {
  DEFAULT_DB,
  type AppUpdateState,
  type Db,
  type DesktopPreferences,
  type DiscordPresenceStatus,
  type LocalCoverLookupResult,
  type LyricsSearchResult,
  type OpenfyApi,
  type SearchOptions,
  type SearchPage,
  type Track
} from '@shared/types'
import { sanitizeDb } from '@shared/db-sanitize'
import { featured, search, searchPage } from '@main/sources'
import { checkInvidious, invidiousLastError } from '@main/sources/invidious'
import { getLyrics } from '@main/lyrics'
import { createMobileUpdater } from './appUpdater'

const DB_KEY = 'openfy-db-v1'
const PREFS_KEY = 'openfy-desktop-preferences-v1'
const DEFAULT_PREFS: DesktopPreferences = { minimizeToTray: false, notifications: false, discordPresence: false }

// O estado da atualização precisa sobreviver às telas: o objeto é único.
const updater = createMobileUpdater()

function readPreferences(): DesktopPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') as Partial<DesktopPreferences> | null
    if (!raw) return { ...DEFAULT_PREFS }
    return {
      minimizeToTray: false,
      notifications: false,
      discordPresence: false,
      ...(typeof raw.fadeSeconds === 'number' && Number.isFinite(raw.fadeSeconds)
        ? { fadeSeconds: Math.min(6, Math.max(0, raw.fadeSeconds)) }
        : {})
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/**
 * API da versão Android. Reaproveita as mesmas fontes de busca do desktop e
 * guarda a biblioteca no armazenamento local do WebView.
 */
export function createMobileApi(): OpenfyApi {
  return {
    loadDb: async (): Promise<Db> => {
      try {
        const raw = localStorage.getItem(DB_KEY)
        return raw ? sanitizeDb(JSON.parse(raw)) : structuredClone(DEFAULT_DB)
      } catch {
        return structuredClone(DEFAULT_DB)
      }
    },
    saveDb: async (db: Db): Promise<void> => {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(db))
      } catch (error) {
        // Cota do armazenamento do WebView: não interrompe o uso do app.
        console.warn('[Openfy] Não foi possível salvar a biblioteca no dispositivo:', error)
      }
    },
    // O MVP Android trabalha só com fontes online.
    pickFiles: async (): Promise<Track[]> => [],
    pickFolder: async (): Promise<Track[]> => [],
    pickThemeBackground: async (): Promise<string | null> => null,
    search: (query: string, options?: SearchOptions): Promise<Track[]> => search(query, options),
    searchPage: (query: string, options?: SearchOptions): Promise<SearchPage> => searchPage(query, options),
    youtubeStatus: async () => ({ lastError: invidiousLastError() }),
    youtubeTest: () => checkInvidious(),
    getLyrics: (title: string, artist: string, duration?: number): Promise<LyricsSearchResult> =>
      getLyrics(title, artist, duration),
    findLocalCover: async (): Promise<LocalCoverLookupResult> => ({ status: 'not-found' }),
    featured: () => featured(),
    desktopGetPreferences: async (): Promise<DesktopPreferences> => readPreferences(),
    desktopSetPreferences: async (prefs: DesktopPreferences): Promise<void> => {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      } catch (error) {
        console.warn('[Openfy] Não foi possível salvar as preferências:', error)
      }
    },
    desktopGetDiscordPresenceStatus: async (): Promise<DiscordPresenceStatus> => 'disabled',
    onDiscordPresenceStatus: () => () => {},
    desktopGetUpdateState: async (): Promise<AppUpdateState> => updater.getState(),
    desktopCheckForUpdates: (): Promise<void> => updater.check(),
    desktopInstallUpdate: (): Promise<void> => updater.install(),
    onUpdateState: (callback: (state: AppUpdateState) => void): (() => void) => updater.onState(callback),
    desktopUpdatePlayback: (): void => {},
    onMediaKey: () => () => {}
  }
}

/** Instala a API mobile quando o app roda fora do Electron (WebView do Capacitor). */
export function installMobileApi(): void {
  if (window.api) return
  window.api = createMobileApi()
  window.openfyMobile = true
}
