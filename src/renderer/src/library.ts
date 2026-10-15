import { create } from 'zustand'
import { DEFAULT_DB, type Db, type Playlist, type Settings, type Track } from '@shared/types'

interface LibraryState extends Db {
  ready: boolean
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

  return {
    ...structuredClone(DEFAULT_DB),
    ready: false,

    async init() {
      const db = await window.api.loadDb()
      set({ ...db, ready: true })
    },

    likeTracks(tracks) {
      set((s) => {
        const have = new Set(s.liked)
        return { tracks: merge(s.tracks, tracks), liked: [...s.liked, ...tracks.map((t) => t.id).filter((id) => !have.has(id))] }
      })
      persist()
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
    }
  }
})
