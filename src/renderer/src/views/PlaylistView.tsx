import { useMemo, useState } from 'react'
import { useLibrary } from '../library'
import { usePlayer } from '../player'
import { hueOf, plural } from '../util'
import { TrackList } from '../components/TrackList'
import { Icon } from '../components/Icon'

export function PlaylistView({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === id))
  const libTracks = useLibrary((s) => s.tracks)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  const tracks = useMemo(() => {
    if (!playlist) return []
    const map = new Map(libTracks.map((t) => [t.id, t]))
    return playlist.trackIds.map((tid) => map.get(tid)).filter((t): t is NonNullable<typeof t> => !!t)
  }, [playlist, libTracks])

  if (!playlist) return <p className="empty">Playlist não encontrada.</p>

  const hue = hueOf(id)
  const saveName = (): void => {
    useLibrary.getState().renamePlaylist(id, name)
    setEditing(false)
  }

  return (
    <section className="page" style={{ ['--hue' as string]: hue }}>
      <div className="page-bg" />
      <header className="hero">
        <div className="hero-cover" style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 40%), hsl(${(hue + 40) % 360} 45% 22%))` }}>
          <Icon name="music" size={72} />
        </div>
        <div>
          <div className="hero-kind">Playlist</div>
          {editing ? (
            <input
              className="hero-edit"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') setEditing(false)
              }}
              onBlur={saveName}
            />
          ) : (
            <h1
              className="hero-title"
              title="Clique para renomear"
              onClick={() => {
                setName(playlist.name)
                setEditing(true)
              }}
            >
              {playlist.name}
            </h1>
          )}
          <div className="hero-meta">{plural(tracks.length)}</div>
        </div>
      </header>
      <div className="actionbar">
        <button className="big-play" disabled={!tracks.length} onClick={() => usePlayer.getState().playQueue(tracks, 0)} title="Tocar">
          <Icon name="play" size={28} />
        </button>
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
      </div>
      <TrackList
        tracks={tracks}
        empty="Esta playlist está vazia. Use o + em qualquer música para adicioná-la aqui."
        onRemove={(t) => useLibrary.getState().removeFromPlaylist(id, t.id)}
      />
    </section>
  )
}
