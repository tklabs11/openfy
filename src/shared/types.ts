export type Source = 'local' | 'audius' | 'jamendo' | 'archive' | 'openverse'

export interface Track {
  id: string
  title: string
  artist: string
  album?: string
  cover?: string
  source: Source
  uri: string
  duration?: number
  /** Licença quando a fonte informa (ex.: "CC BY-SA 4.0"). */
  license?: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  cover?: string
  trackAddedAt?: Record<string, number>
  trackIds: string[]
}

export interface Settings {
  volume: number
}

export interface Db {
  tracks: Track[]
  liked: string[]
  playlists: Playlist[]
  settings: Settings
}

export type MediaKey = 'play-pause' | 'next' | 'prev'

export interface OpenfyApi {
  loadDb(): Promise<Db>
  saveDb(db: Db): Promise<void>
  pickFiles(): Promise<Track[]>
  pickFolder(): Promise<Track[]>
  search(query: string): Promise<Track[]>
  featured(): Promise<Track[]>
  onMediaKey(cb: (key: MediaKey) => void): () => void
  desktopGetPreferences(): Promise<{ minimizeToTray: boolean; notifications: boolean }>
  desktopSetPreferences(prefs: { minimizeToTray: boolean; notifications: boolean }): Promise<void>
  desktopUpdatePlayback(playing: boolean, title?: string, artist?: string): void
}

export const DEFAULT_DB: Db = {
  tracks: [],
  liked: [],
  playlists: [],
  settings: { volume: 0.8 }
}
