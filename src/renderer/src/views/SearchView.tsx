import { useEffect, useRef, useState } from 'react'
import type { Track } from '@shared/types'
import { TrackList } from '../components/TrackList'
import { Icon } from '../components/Icon'

interface SearchProps {
  query: string
  onQueryChange: (value: string) => void
  onSearch: (value: string) => void
  onCreatePlaylist: (track: Track) => void
}

export function SearchView({ query, onQueryChange, onSearch, onCreatePlaylist }: SearchProps) {
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState('')
  const requestId = useRef(0)

  useEffect(() => {
    const term = query.trim()
    const id = ++requestId.current
    if (term.length < 2) {
      setResults([]); setError(null); setSearched(''); setLoading(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(null)
      try {
        const found = await window.api.search(term)
        if (id !== requestId.current) return
        setResults(found)
        setSearched(term)
        if (!found.length) setError(`Nenhum resultado para "${term}".`)
      } catch {
        if (id !== requestId.current) return
        setResults([])
        setError('Não foi possível buscar agora. Verifique sua conexão e tente de novo.')
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 450)
    return () => { window.clearTimeout(timer); requestId.current++ }
  }, [query])

  return (
    <section className="page" style={{ ['--hue' as string]: 220 }}>
      <div className="search-results-heading">
        <h1>Buscar músicas</h1>
        <p>Pesquise na barra superior por músicas ou artistas. Pressione <kbd>Ctrl K</kbd> de qualquer tela.</p>
      </div>
      {loading && <p className="empty">Buscando…</p>}
      {!loading && error && <p className="empty">{error}</p>}
      {!loading && !error && !results.length && <p className="empty">Digite pelo menos 2 caracteres na barra de pesquisa acima.</p>}
      {!loading && results.length > 0 && (
        <>
          <h2 className="shelf-title">Resultados para "{searched}"</h2>
          <TrackList tracks={results} onCreatePlaylist={onCreatePlaylist} />
        </>
      )}
    </section>
  )
}
