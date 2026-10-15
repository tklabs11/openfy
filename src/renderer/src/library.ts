import { create } from 'zustand'
import { DEFAULT_DB, type Db, type Settings, type Track } from '@shared/types'

interface LibraryState extends Db {
  ready: boolean
  init(): Promise<void>
  likeTracks(tracks: Track[]): void
  toggleLike(track: Track): void
  createPlaylist(name: string, firstTrack?: Track): string
  renamePlaylist(id: string, name: string): void
  deletePlaylist(id: string): void
  addToPlaylist(playlistId: string, track: Track): void
  removeFromPlaylist(playlistId: string, trackId: string): void
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

    createPlaylist(name, firstTrack) {
      const id = crypto.randomUUID()
      set((s) => ({
        tracks: firstTrack ? merge(s.tracks, [firstTrack]) : s.tracks,
        playlists: [...s.playlists, { id, name: name.trim() || 'Minha playlist', trackIds: firstTrack ? [firstTrack.id] : [] }]
      }))
      persist()
      return id
    },

    renamePlaylist(id, name) {
      const clean = name.trim()
      if (!clean) return
      set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, name: clean } : p)) }))
      persist()
    },

    deletePlaylist(id) {
      set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }))
      persist()
    },

    addToPlaylist(playlistId, track) {
      set((s) => ({
        tracks: merge(s.tracks, [track]),
        playlists: s.playlists.map((p) =>
          p.id === playlistId && !p.trackIds.includes(track.id) ? { ...p, trackIds: [...p.trackIds, track.id] } : p
        )
      }))
      persist()
    },

    removeFromPlaylist(playlistId, trackId) {
      set((s) => ({
        playlists: s.playlists.map((p) =>
          p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((x) => x !== trackId) } : p
        )
      }))
      persist()
    },

    updateSettings(patch) {
      set((s) => ({ settings: { ...s.settings, ...patch } }))
      persist()
    }
  }
})
