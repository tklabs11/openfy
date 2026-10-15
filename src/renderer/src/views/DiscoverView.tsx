import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Track } from '@shared/types'
import { TrackList } from '../components/TrackList'
import { useLibrary } from '../library'
import { usePlayer } from '../player'

const genres = [
  { name: 'Eletrônica', query: 'electronic' }, { name: 'Lo-fi', query: 'lofi' },
  { name: 'Hip-Hop', query: 'hip hop' }, { name: 'Rock', query: 'rock' },
  { name: 'Jazz', query: 'jazz' }, { name: 'Ambient', query: 'ambient' },
  { name: 'Reggae', query: 'reggae' }, { name: 'Classical', query: 'classical' }
]
const uniq = (tracks: Track[]) => [...new Map(tracks.map(t => [t.id, t])).values()]

export function DiscoverView() {
  const liked = useLibrary(s => s.liked)
  const saved = useLibrary(s => s.tracks)
  const [genre, setGenre] = useState(genres[0])
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [radio, setRadio] = useState(false)
  const [seed, setSeed] = useState('')
  const favorites = useMemo(() => saved.filter(t => liked.includes(t.id)), [liked, saved])
  const recent = useMemo(() => {
    try { const ids: string[] = JSON.parse(localStorage.getItem('openfy-history') || '[]'); return ids.map(id => saved.find(t => t.id === id)).filter((t): t is Track => !!t).slice(0, 12) } catch { return [] }
  }, [saved, tracks])
  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setTracks([])
    window.api.search(genre.query).then(result => { if (alive) setTracks(uniq(result)) })
      .catch(() => { if (alive) setError('Não foi possível consultar o catálogo. Verifique sua conexão.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [genre])
  const playRadio = async () => {
    setRadio(true); setError('')
    try {
      const related = seed.trim() ? await window.api.search(seed.trim()) : []
      const queue = uniq([...related, ...tracks, ...favorites]).filter(t => !!t.uri)
      if (!queue.length) { setError('Nenhuma faixa disponível para esta rádio.'); return }
      usePlayer.getState().playQueue(queue, 0)
    } catch { setError('Não foi possível montar a rádio agora.') }
    finally { setRadio(false) }
  }
  return <section className="page discover-page">
    <div className="discovery-hero"><div className="discovery-eyebrow">OPENFY • MUSIC DISCOVERY</div><h1>Descubra seu próximo som.</h1><p>Explore faixas dos catálogos conectados e crie sua própria rádio.</p></div>
    <h2 className="shelf-title">Explore por estilo</h2>
    <div className="genre-grid">{genres.map((g,i) => <button key={g.name} className={'genre-card'+(genre.name===g.name?' selected':'')} style={{ '--genre-hue': `${195+i*23}` } as CSSProperties} onClick={() => setGenre(g)}><span>♫</span>{g.name}</button>)}</div>
    <div className="radio-panel"><div><div className="discovery-eyebrow">OPENFY RADIO</div><h2>Uma rádio com a sua vibe</h2><p>Comece pelo gênero selecionado ou digite um artista/estilo para buscar faixas relacionadas.</p></div><div className="radio-actions"><input value={seed} onChange={e=>setSeed(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void playRadio()}} placeholder="Artista ou estilo (opcional)"/><button disabled={radio||loading} onClick={()=>void playRadio()}>{radio?'Preparando…':'▶ Iniciar rádio'}</button></div></div>
    {error && <p className="discovery-error" role="alert">{error}</p>}
    <h2 className="shelf-title">{genre.name} · músicas disponíveis</h2>
    {loading ? <p className="empty">Buscando músicas…</p> : tracks.length ? <TrackList tracks={tracks}/> : <p className="empty">Nenhuma faixa encontrada neste estilo.</p>}
    {favorites.length > 0 && <><h2 className="shelf-title">Suas favoritas</h2><TrackList tracks={favorites.slice(0,10)}/></>}
    {recent.length > 0 && <><h2 className="shelf-title">Da sua biblioteca, ouvidas recentemente</h2><TrackList tracks={recent}/></>}
    <p className="discovery-note">As músicas vêm das fontes configuradas no Openfy. A disponibilidade e os direitos de uso dependem da licença de cada faixa; a rádio monta uma fila, sem recomendações por IA nesta versão.</p>
  </section>
}
