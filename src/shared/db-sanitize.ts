import { DEFAULT_DB, type Db, type Track } from './types'

const KNOWN_SOURCES = new Set(['local', 'audius', 'jamendo', 'archive', 'openverse', 'librivox', 'youtube'])

/**
 * Descarta dados inválidos de bibliotecas vindas de versões antigas ou de
 * arquivos editados à mão, mantendo apenas faixas de fontes conhecidas.
 */
export function sanitizeDb(raw: unknown): Db {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const tracks: Track[] = (Array.isArray(data.tracks) ? data.tracks : []).filter((track: Track) =>
    KNOWN_SOURCES.has(track?.source)
  )
  const ids = new Set(tracks.map((track) => track.id))
  const liked: string[] = (Array.isArray(data.liked) ? data.liked : []).filter((id: string) => ids.has(id))
  const settings = (data.settings && typeof data.settings === 'object' ? data.settings : {}) as Record<string, unknown>
  const playlists = (Array.isArray(data.playlists) ? data.playlists : []).map((playlist: Db['playlists'][number]) => {
    const trackIds = (Array.isArray(playlist.trackIds) ? playlist.trackIds : []).filter((id: string) => ids.has(id))
    const trackIdSet = new Set(trackIds)
    const trackAddedAt = playlist.trackAddedAt && typeof playlist.trackAddedAt === 'object' && !Array.isArray(playlist.trackAddedAt)
      ? Object.fromEntries(Object.entries(playlist.trackAddedAt).filter(([id, addedAt]) =>
          trackIdSet.has(id) && typeof addedAt === 'number' && Number.isFinite(addedAt)
        ))
      : undefined
    return { ...playlist, trackIds, trackAddedAt }
  })
  return {
    tracks,
    liked,
    playlists,
    settings: {
      volume: typeof settings.volume === 'number' ? settings.volume : DEFAULT_DB.settings.volume,
      automaticLocalCovers: settings.automaticLocalCovers === true
    }
  }
}
