import { create } from 'zustand'
import { DEFAULT_DB, type Db, type Playlist, type Settings, type Track } from '@shared/types'
import { mergeLibraryBackup, type LibraryBackup } from './backup'

interface LibraryState extends Db {
  ready: boolean
  coverLookupNotice: string | null
  init(): Promise<void>
  likeTracks(tracks: Track[]): void
  toggleLike(track: Track): void
  createPlaylist(name: string, firstTrack?: Track, details?: Pick<Playlist, 'description' | 'cover'>): string
  updatePlaylist(id: string, details: Pick<Playlist, 'name' | 'description' | 'cover'>): void
  deletePlaylist(id: string): void
  addToPlaylist(playlistId: string, track: Track): void
  removeFromPlaylist(playlistId: string, trackId: string): void
  reorderPlaylistTrack(playlistId: string, fromTrackId: string, toTrackId: string): void
  updateSettings(patch: Partial<Settings>): void
  updateTrackCover(trackId: string, cover: string | undefined, onlyIfMissing?: boolean): void
  retryLocalCoverLookups(): void
  mergeBackup(backup: LibraryBackup): { addedTracks: number; addedLikes: number; addedPlaylists: number; updatedPlaylists: number }
}

let saveTimer: number | undefined

export const useLibrary = create<LibraryState>((set, get) => {
  const persist = (): void => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const { tracks, liked, playlists, settings } = get()
      void window.api.saveDb({ tracks, liked, playlists, settings })
    }, 400)
  }
  const merge = (existing: Track[], incoming: Track[]): Track[] => {
    const ids = new Set(existing.map((t) => t.id))
    return [...existing, ...incoming.filter((t) => !ids.has(t.id))]
  }
  const coverQueue: Track[] = []
  const queuedCoverIds = new Set<string>()
  let coverLookupRunning = false
  let coverRetryTimer: number | undefined
  const enqueueAutomaticCoverLookups = (tracks: Track[] = get().tracks): void => {
    if (!get().settings.automaticLocalCovers) return
    for (const track of tracks) {
      if (track.source !== 'local' || track.cover || track.coverLookupAttempted || queuedCoverIds.has(track.id)) continue
      queuedCoverIds.add(track.id)
      coverQueue.push(track)
    }
    void processCoverLookups()
  }
  const processCoverLookups = async (): Promise<void> => {
    if (coverLookupRunning || !coverQueue.length) return
    coverLookupRunning = true
    try {
      while (coverQueue.length) {
        const state = get()
        if (!state.settings.automaticLocalCovers) {
          coverQueue.length = 0
          queuedCoverIds.clear()
          break
        }
        const candidate = coverQueue.shift()
        if (!candidate) continue
        queuedCoverIds.delete(candidate.id)
        const track = state.tracks.find((item) => item.id === candidate.id)
        if (!track || track.source !== 'local' || track.cover || track.coverLookupAttempted) continue
        try {
          const result = await window.api.findLocalCover(track.title, track.artist)
          if (!get().settings.automaticLocalCovers) continue
          if (result.status === 'found') {
            set({ coverLookupNotice: null })
            get().updateTrackCover(track.id, result.cover, true)
          } else if (result.status === 'not-found') {
            set({ coverLookupNotice: null })
            get().updateTrackCover(track.id, undefined, true)
          } else if (result.status === 'rate-limited') {
            coverQueue.unshift(track)
            queuedCoverIds.add(track.id)
            set({ coverLookupNotice: `O catálogo limitou as buscas. A tentativa será retomada em cerca de ${Math.ceil(result.retryAfterMs / 60_000)} minuto(s).` })
            coverRetryTimer = window.setTimeout(() => {
              coverRetryTimer = undefined
              void processCoverLookups()
            }, result.retryAfterMs)
            return
          } else {
            set({ coverLookupNotice: result.message })
            coverQueue.length = 0
            queuedCoverIds.clear()
            console.warn(`[Openfy] Busca automática de capas pausada: ${result.message}`)
            return
          }
        } catch (error) {
          console.warn(`[Openfy] Falha inesperada ao localizar capa para "${track.title}":`, error)
        }
      }
    } finally {
      coverLookupRunning = false
    }
  }

  return {
    ...structuredClone(DEFAULT_DB),
    ready: false,
    coverLookupNotice: null,

    async init() {
      const db = await window.api.loadDb()
      set({ ...db, ready: true })
      enqueueAutomaticCoverLookups(db.tracks)
    },

    likeTracks(tracks) {
      set((s) => {
        const have = new Set(s.liked)
        return { tracks: merge(s.tracks, tracks), liked: [...s.liked, ...tracks.map((t) => t.id).filter((id) => !have.has(id))] }
      })
      persist()
      enqueueAutomaticCoverLookups(tracks)
    },

    toggleLike(track) {
      set((s) => ({
        tracks: merge(s.tracks, [track]),
        liked: s.liked.includes(track.id) ? s.liked.filter((x) => x !== track.id) : [...s.liked, track.id]
      }))
      persist()
    },

    createPlaylist(name, firstTrack, details = {}) {
      const id = crypto.randomUUID()
      set((s) => ({
        tracks: firstTrack ? merge(s.tracks, [firstTrack]) : s.tracks,
        playlists: [...s.playlists, {
          id,
          name: name.trim() || 'Minha playlist',
          description: details.description?.trim() || undefined,
          cover: details.cover,
          trackAddedAt: firstTrack ? { [firstTrack.id]: Date.now() } : {},
          trackIds: firstTrack ? [firstTrack.id] : []
        }]
      }))
      persist()
      return id
    },

    updatePlaylist(id, details) {
      const name = details.name.trim()
      if (!name) return
      set((s) => ({
        playlists: s.playlists.map((p) => p.id === id
          ? { ...p, name, description: details.description?.trim() || undefined, cover: details.cover }
          : p)
      }))
      persist()
    },

    deletePlaylist(id) {
      set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }))
      persist()
    },

    addToPlaylist(playlistId, track) {
      set((s) => {
        const playlist = s.playlists.find((p) => p.id === playlistId)
        if (!playlist || playlist.trackIds.includes(track.id)) return {}
        return {
          tracks: merge(s.tracks, [track]),
          playlists: s.playlists.map((p) => p.id === playlistId
            ? {
                ...p,
                trackIds: [...p.trackIds, track.id],
                trackAddedAt: { ...p.trackAddedAt, [track.id]: Date.now() }
              }
            : p)
        }
      })
      persist()
    },

    removeFromPlaylist(playlistId, trackId) {
      set((s) => ({
        playlists: s.playlists.map((p) =>
          p.id === playlistId
            ? {
                ...p,
                trackIds: p.trackIds.filter((x) => x !== trackId),
                trackAddedAt: Object.fromEntries(Object.entries(p.trackAddedAt ?? {}).filter(([id]) => id !== trackId))
              }
            : p
        )
      }))
      persist()
    },

    reorderPlaylistTrack(playlistId, fromTrackId, toTrackId) {
      set((s) => ({
        playlists: s.playlists.map((p) => {
          if (p.id !== playlistId) return p
          const from = p.trackIds.indexOf(fromTrackId)
          const to = p.trackIds.indexOf(toTrackId)
          if (from < 0 || to < 0 || from === to) return p
          const trackIds = [...p.trackIds]
          trackIds.splice(from, 1)
          trackIds.splice(to, 0, fromTrackId)
          return { ...p, trackIds }
        })
      }))
      persist()
    },

    updateSettings(patch) {
      set((s) => ({ settings: { ...s.settings, ...patch } }))
      persist()
      if (patch.automaticLocalCovers === true) enqueueAutomaticCoverLookups()
      if (patch.automaticLocalCovers === false) {
        if (coverRetryTimer !== undefined) window.clearTimeout(coverRetryTimer)
        coverRetryTimer = undefined
        coverQueue.length = 0
        queuedCoverIds.clear()
        set({ coverLookupNotice: null })
      }
    },

    retryLocalCoverLookups() {
      set({ coverLookupNotice: null })
      enqueueAutomaticCoverLookups()
    },

    updateTrackCover(trackId, cover, onlyIfMissing = false) {
      set((s) => ({
        tracks: s.tracks.map((track) => track.id === trackId
          ? onlyIfMissing && track.cover
            ? track
            : { ...track, cover, coverLookupAttempted: true }
          : track)
      }))
      persist()
    },

    mergeBackup(backup) {
      const result = mergeLibraryBackup(get(), backup)
      set(result.db)
      persist()
      enqueueAutomaticCoverLookups(backup.tracks)
      return {
        addedTracks: result.addedTracks,
        addedLikes: result.addedLikes,
        addedPlaylists: result.addedPlaylists,
        updatedPlaylists: result.updatedPlaylists
      }
    }
  }
})
