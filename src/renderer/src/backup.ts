import type { Db, Playlist, Track } from '@shared/types'

export const LIBRARY_BACKUP_FORMAT = 'openfy-library-backup'
export const LIBRARY_BACKUP_VERSION = 1

export interface LibraryBackup {
  format: typeof LIBRARY_BACKUP_FORMAT
  version: typeof LIBRARY_BACKUP_VERSION
  exportedAt: string
  tracks: Track[]
  liked: string[]
  playlists: Playlist[]
}

export interface BackupMergeResult {
  db: Db
  addedTracks: number
  addedLikes: number
  addedPlaylists: number
  updatedPlaylists: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isStringArray = (value: unknown[]): value is string[] => value.every((item) => typeof item === 'string')
const isSource = (value: unknown): value is Track['source'] =>
  value === 'local' || value === 'audius' || value === 'jamendo' || value === 'archive' || value === 'openverse'

function validOptionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`Campo inválido no backup: ${field}.`)
  return value
}

function parseTrack(value: unknown): Track {
  if (!isRecord(value)) throw new Error('O backup contém uma faixa inválida.')
  const { id, title, artist, uri, source, duration } = value
  const album = validOptionalString(value.album, 'album', 1000)
  const cover = validOptionalString(value.cover, 'cover', 5_000_000)
  const license = validOptionalString(value.license, 'license', 200)
  if (typeof id !== 'string' || !id || id.length > 500
    || typeof title !== 'string' || title.length > 1000
    || typeof artist !== 'string' || artist.length > 1000
    || typeof uri !== 'string' || !uri || uri.length > 100_000
    || !isSource(source)) {
    throw new Error('O backup contém uma faixa inválida.')
  }
  if (duration !== undefined && (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)) {
    throw new Error(`Duração inválida na faixa "${title}".`)
  }
  const validUri = source === 'local'
    ? uri.startsWith('openfy-file://media/') && uri.length > 'openfy-file://media/'.length
    : (() => {
        try { return new URL(uri).protocol === 'https:' } catch { return false }
      })()
  if (!validUri) throw new Error(`Endereço inválido na faixa "${title}".`)
  return {
    id,
    title,
    artist,
    source,
    uri,
    ...(duration !== undefined ? { duration } : {}),
    ...(album !== undefined ? { album } : {}),
    ...(cover !== undefined ? { cover } : {}),
    ...(license !== undefined ? { license } : {})
  }
}

function parsePlaylist(value: unknown, trackIds: Set<string>): Playlist {
  if (!isRecord(value)
    || typeof value.id !== 'string' || !value.id || value.id.length > 500
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200
    || !Array.isArray(value.trackIds) || value.trackIds.length > 100_000
    || !isStringArray(value.trackIds) || value.trackIds.some((id) => !trackIds.has(id))) {
    throw new Error('O backup contém uma playlist inválida ou faixas que não existem no arquivo.')
  }
  const uniqueTrackIds = [...new Set(value.trackIds)]
  let trackAddedAt: Record<string, number> | undefined
  if (value.trackAddedAt !== undefined) {
    if (!isRecord(value.trackAddedAt)) {
      throw new Error(`Datas de adição inválidas na playlist "${value.name}".`)
    }
    trackAddedAt = {}
    for (const [id, addedAt] of Object.entries(value.trackAddedAt)) {
      if (!trackIds.has(id) || typeof addedAt !== 'number' || !Number.isFinite(addedAt)) {
        throw new Error(`Datas de adição inválidas na playlist "${value.name}".`)
      }
      trackAddedAt[id] = addedAt
    }
  }
  const description = validOptionalString(value.description, 'description', 2000)
  const cover = validOptionalString(value.cover, 'playlist cover', 5_000_000)
  return {
    id: value.id,
    name: value.name.trim(),
    trackIds: uniqueTrackIds,
    ...(trackAddedAt ? { trackAddedAt } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(cover !== undefined ? { cover } : {})
  }
}

export function createLibraryBackup(db: Pick<Db, 'tracks' | 'liked' | 'playlists'>): LibraryBackup {
  return {
    format: LIBRARY_BACKUP_FORMAT,
    version: LIBRARY_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tracks: db.tracks,
    liked: db.liked,
    playlists: db.playlists
  }
}

export function parseLibraryBackup(value: unknown): LibraryBackup {
  if (!isRecord(value) || value.format !== LIBRARY_BACKUP_FORMAT || value.version !== LIBRARY_BACKUP_VERSION
    || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))
    || !Array.isArray(value.tracks) || value.tracks.length > 100_000
    || !Array.isArray(value.liked) || value.liked.length > 100_000
    || !Array.isArray(value.playlists) || value.playlists.length > 10_000) {
    throw new Error('Este arquivo não é um backup válido do Openfy ou usa uma versão não suportada.')
  }

  const tracks = value.tracks.map(parseTrack)
  const trackIds = new Set(tracks.map((track) => track.id))
  if (trackIds.size !== tracks.length) throw new Error('O backup contém músicas duplicadas.')
  if (!isStringArray(value.liked) || value.liked.some((id) => !trackIds.has(id))) {
    throw new Error('O backup contém favoritos sem uma faixa correspondente.')
  }
  const playlists = value.playlists.map((playlist) => parsePlaylist(playlist, trackIds))
  if (new Set(playlists.map((playlist) => playlist.id)).size !== playlists.length) {
    throw new Error('O backup contém playlists duplicadas.')
  }

  return {
    format: LIBRARY_BACKUP_FORMAT,
    version: LIBRARY_BACKUP_VERSION,
    exportedAt: value.exportedAt,
    tracks,
    liked: [...new Set(value.liked as string[])],
    playlists
  }
}

export function mergeLibraryBackup(current: Db, backup: LibraryBackup): BackupMergeResult {
  const tracks = [...current.tracks]
  const trackIds = new Set(tracks.map((track) => track.id))
  for (const track of backup.tracks) {
    if (!trackIds.has(track.id)) {
      trackIds.add(track.id)
      tracks.push(track)
    }
  }

  const liked = [...current.liked]
  const likedIds = new Set(liked)
  for (const id of backup.liked) {
    if (trackIds.has(id) && !likedIds.has(id)) {
      likedIds.add(id)
      liked.push(id)
    }
  }

  const playlists = [...current.playlists]
  const playlistIndexes = new Map(playlists.map((playlist, index) => [playlist.id, index]))
  let addedPlaylists = 0
  let updatedPlaylists = 0
  for (const imported of backup.playlists) {
    const existingIndex = playlistIndexes.get(imported.id)
    if (existingIndex === undefined) {
      playlists.push(imported)
      playlistIndexes.set(imported.id, playlists.length - 1)
      addedPlaylists++
      continue
    }
    const existing = playlists[existingIndex]
    const trackIds = new Set(existing.trackIds)
    const mergedTrackIds = [...existing.trackIds, ...imported.trackIds.filter((id) => !trackIds.has(id))]
    if (mergedTrackIds.length > existing.trackIds.length) updatedPlaylists++
    playlists[existingIndex] = {
      ...existing,
      trackIds: mergedTrackIds,
      trackAddedAt: { ...imported.trackAddedAt, ...existing.trackAddedAt }
    }
  }

  return {
    db: { tracks, liked, playlists, settings: current.settings },
    addedTracks: tracks.length - current.tracks.length,
    addedLikes: liked.length - current.liked.length,
    addedPlaylists,
    updatedPlaylists
  }
}
