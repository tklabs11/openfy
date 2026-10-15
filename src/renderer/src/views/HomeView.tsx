import { useEffect, useMemo, useState } from 'react'
import type { Track } from '@shared/types'
import { useLibrary } from '../library'
import { usePlayer } from '../player'
import { greeting, hueOf } from '../util'
import { Icon } from '../components/Icon'
import { getTaste, rankForYou, tasteEnabled } from '../taste'
import type { View } from '../components/Sidebar'

let featuredCache: Track[] | null = null

export function HomeView({ setView }: { setView: (v: View) => void }) {
  const playlists = useLibrary((s) => s.playlists)
  const libraryTracks = useLibrary((s) => s.tracks)
  const liked = useLibrary((s) => s.liked)
  const [tasteVersion, setTasteVersion] = useState(0)
  useEffect(() => { const refresh = () => setTasteVersion(v => v + 1); window.addEventListener('openfy-taste-change', refresh); return () => window.removeEventListener('openfy-taste-change', refresh) }, [])
  const taste = useMemo(() => getTaste(), [tasteVersion])
  const [featured, setFeatured] = useState<Track[]>(featuredCache ?? [])
  const recommendations = useMemo(() => rankForYou([...new Map([...libraryTracks, ...featured].map(t => [t.id,t])).values()], taste, liked).slice(0, 12), [libraryTracks, featured, taste, liked])

  useEffect(() => {
    if (featuredCache) return
    let alive = true
    window.api
      .featured()
      .then((r) => {
        featuredCache = r
        if (alive) setFeatured(r)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const shortcuts = useMemo(
    () => [
      { key: 'saved', name: 'Músicas salvas', hue: 270, cover: undefined, go: () => setView({ type: 'saved' }), heart: true },
      ...playlists.slice(0, 5).map((p) => ({
        key: p.id,
        name: p.name,
        hue: hueOf(p.id),
        cover: p.cover,
        go: () => setView({ type: 'playlist', id: p.id }),
        heart: false
      }))
    ],
    [playlists, setView]
  )

  return (
    <section className="page" style={{ ['--hue' as string]: 150 }}>
      <div className="page-bg" />
      <h1 className="greet">{greeting()}</h1>
      <div className="shortcuts">
        {shortcuts.map((s) => (
          <button key={s.key} className="shortcut" onClick={s.go}>
            <div className="sq" style={{ background: s.cover ? 'transparent' : `linear-gradient(135deg, hsl(${s.hue} 45% 40%), hsl(${(s.hue + 40) % 360} 45% 24%))` }}>
              {s.cover ? <img src={s.cover} alt="" /> : <Icon name={s.heart ? 'heart' : 'music'} size={24} />}
            </div>
            <span>{s.name}</span>
          </button>
        ))}
      </div>

      {tasteEnabled() && taste.length > 0 && recommendations.length > 0 && (
        <><h2 className="shelf-title">Do seu jeito</h2><p className="taste-subtitle">Baseado no que você ouviu e curtiu — sem recomendações patrocinadas.</p>
        <div className="shelf">{recommendations.map((t,i) => <button key={t.id} className="card" onClick={() => usePlayer.getState().playQueue(recommendations,i)}>
          <div className="card-img">{t.cover ? <img src={t.cover} alt="" /> : <div className="np-ph"><Icon name="music" size={40}/></div>}<span className="fab"><Icon name="play" size={22}/></span></div>
          <div className="title">{t.title}</div><div className="artist">{t.artist}</div>
        </button>)}</div></>
      )}
      {tasteEnabled() && taste.length === 0 && <p className="taste-subtitle">Sua página inicial vai se adaptar naturalmente conforme você escutar músicas. Sem pressa, sem anúncios.</p>}
      {featured.length > 0 && (
        <>
          <h2 className="shelf-title">Explorar catálogo</h2>
          <div className="shelf">
            {featured.map((t, i) => (
              <button key={t.id} className="card" onClick={() => usePlayer.getState().playQueue(featured, i)}>
                <div className="card-img">
                  {t.cover ? <img src={t.cover} alt="" /> : <div className="np-ph"><Icon name="music" size={40} /></div>}
                  <span className="fab"><Icon name="play" size={22} /></span>
                </div>
                <div className="title">{t.title}</div>
                <div className="artist">{t.artist}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {!featured.length && !playlists.length && (
        <p className="empty">Use a busca para encontrar músicas e montar suas playlists.</p>
      )}
    </section>
  )
}
