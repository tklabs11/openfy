import { useMemo, useState } from 'react'
import type { Track } from '@shared/types'
import { useLibrary } from '../library'
import { usePlayer } from '../player'
import { hueOf, plural } from '../util'
import { TrackList } from '../components/TrackList'
import { Icon } from '../components/Icon'

type PlaylistSort = 'custom' | 'title' | 'artist' | 'added'

export function PlaylistView({ id, onDeleted, onEdit, onCreatePlaylist }: { id: string; onDeleted: () => void; onEdit: () => void; onCreatePlaylist: (track: Track) => void }) {
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === id))
  const libTracks = useLibrary((s) => s.tracks)
  const [sort, setSort] = useState<PlaylistSort>('custom')

  const tracks = useMemo(() => {
    if (!playlist) return []
    const map = new Map(libTracks.map((t) => [t.id, t]))
    return playlist.trackIds.map((tid) => map.get(tid)).filter((t): t is NonNullable<typeof t> => !!t)
  }, [playlist, libTracks])

  const sortedTracks = useMemo(() => {
    if (!playlist || sort === 'custom') return tracks
    const originalPosition = new Map(tracks.map((track, index) => [track.id, index]))
    return [...tracks].sort((a, b) => {
      if (sort === 'added') {
        const aAdded = playlist.trackAddedAt?.[a.id] ?? originalPosition.get(a.id) ?? 0
        const bAdded = playlist.trackAddedAt?.[b.id] ?? originalPosition.get(b.id) ?? 0
        return bAdded - aAdded || (originalPosition.get(a.id) ?? 0) - (originalPosition.get(b.id) ?? 0)
      }
      const aValue = sort === 'title' ? a.title : a.artist
      const bValue = sort === 'title' ? b.title : b.artist
      return aValue.localeCompare(bValue, undefined, { sensitivity: 'base', numeric: true })
        || (originalPosition.get(a.id) ?? 0) - (originalPosition.get(b.id) ?? 0)
    })
  }, [playlist, sort, tracks])

  if (!playlist) return <p className="empty">Playlist não encontrada.</p>

  const hue = hueOf(id)

  return (
    <section className="page" style={{ ['--hue' as string]: hue }}>
      <div className="page-bg" />
      <header className="hero">
        <div className="hero-cover" style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 40%), hsl(${(hue + 40) % 360} 45% 22%))` }}>
          {playlist.cover ? <img src={playlist.cover} alt={`Capa de ${playlist.name}`} /> : <Icon name="music" size={72} />}
        </div>
        <div>
          <div className="hero-kind">Playlist</div>
          <h1 className="hero-title">{playlist.name}</h1>
          {playlist.description && <p className="playlist-description">{playlist.description}</p>}
          <div className="hero-meta">{plural(tracks.length)}</div>
        </div>
      </header>
      <div className="actionbar playlist-actionbar">
        <button className="big-play" disabled={!tracks.length} onClick={() => usePlayer.getState().playQueue(tracks, 0)} title="Tocar">
          <Icon name="play" size={28} />
        </button>
        <button className="btn" onClick={onEdit}>Editar detalhes</button>
        <button
          className="btn"
          onClick={() => {
            if (confirm(`Excluir a playlist "${playlist.name}"?`)) {
              useLibrary.getState().deletePlaylist(id)
              onDeleted()
            }
          }}
        >
          Excluir playlist
        </button>
        <label className="playlist-sort">
          <span>Ordenar</span>
          <select className="settings-select" value={sort} onChange={(event) => setSort(event.target.value as PlaylistSort)}>
            <option value="custom">Ordem personalizada</option>
            <option value="title">Título (A–Z)</option>
            <option value="artist">Artista (A–Z)</option>
            <option value="added">Data de adição (recentes primeiro)</option>
          </select>
        </label>
      </div>
      <TrackList
        tracks={sortedTracks}
        empty="Esta playlist está vazia. Use o + em qualquer música para adicioná-la aqui."
        onRemove={(t) => useLibrary.getState().removeFromPlaylist(id, t.id)}
        onCreatePlaylist={onCreatePlaylist}
        onReorder={sort === 'custom'
          ? (fromTrackId, toTrackId) => useLibrary.getState().reorderPlaylistTrack(id, fromTrackId, toTrackId)
          : undefined}
      />
    </section>
  )
}
