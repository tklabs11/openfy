import { useMemo } from 'react'
import { useLibrary } from '../library'
import { usePlayer } from '../player'
import { plural } from '../util'
import { TrackList } from '../components/TrackList'
import { Icon } from '../components/Icon'

export function SavedView() {
  const tracks = useLibrary((s) => s.tracks)
  const liked = useLibrary((s) => s.liked)

  const list = useMemo(() => {
    const map = new Map(tracks.map((t) => [t.id, t]))
    return [...liked].reverse().map((id) => map.get(id)).filter((t): t is NonNullable<typeof t> => !!t)
  }, [tracks, liked])

  const importFiles = async (): Promise<void> => useLibrary.getState().likeTracks(await window.api.pickFiles())
  const importFolder = async (): Promise<void> => useLibrary.getState().likeTracks(await window.api.pickFolder())

  return (
    <section className="page" style={{ ['--hue' as string]: 270 }}>
      <div className="page-bg" />
      <header className="hero">
        <div className="hero-cover liked"><Icon name="heart" size={72} /></div>
        <div>
          <div className="hero-kind">Playlist</div>
          <h1 className="hero-title">Músicas salvas</h1>
          <div className="hero-meta">{plural(list.length)}</div>
        </div>
      </header>
      <div className="actionbar">
        <button className="big-play" disabled={!list.length} onClick={() => usePlayer.getState().playQueue(list, 0)} title="Tocar">
          <Icon name="play" size={28} />
        </button>
        <button className="btn" onClick={importFiles}>Adicionar arquivos do computador</button>
        <button className="btn" onClick={importFolder}>Adicionar pasta</button>
      </div>
      <TrackList tracks={list} empty="Toque no coração de qualquer música para salvá-la aqui, ou adicione arquivos do seu computador." />
    </section>
  )
}
