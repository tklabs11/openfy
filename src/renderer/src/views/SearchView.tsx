import { useEffect, useRef, useState } from 'react'
import type { Track } from '@shared/types'
import { TrackList } from '../components/TrackList'
import { searchTracksPage } from '../searchTracks'
import { PLUGINS_CHANGED } from '../plugin-sdk'

interface SearchProps {
  query: string
  onQueryChange: (value: string) => void
  onSearch: (value: string) => void
  onCreatePlaylist: (track: Track) => void
}

export function SearchView({ query, onQueryChange, onSearch, onCreatePlaylist }: SearchProps) {
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [retryable, setRetryable] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const again = (): void => setRefresh((value) => value + 1)
    window.addEventListener(PLUGINS_CHANGED, again)
    return () => window.removeEventListener(PLUGINS_CHANGED, again)
  }, [])

  useEffect(() => {
    const term = query.trim()
    const id = ++requestId.current
    if (term.length < 2) {
      setResults([]); setError(null); setSearched(''); setLoading(false); setPage(1); setHasMore(false); setRetryable(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(null); setRetryable(false)
      try {
        const found = await searchTracksPage(term, 1)
        if (id !== requestId.current) return
        setResults(found.tracks)
        setPage(1)
        setHasMore(found.hasMore)
        setSearched(term)
        if (!found.tracks.length) setError(`Nenhum resultado para "${term}".`)
      } catch {
        if (id !== requestId.current) return
        setResults([]); setHasMore(false)
        setError('Não foi possível buscar agora. Verifique sua conexão e tente de novo.')
        setRetryable(true)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 450)
    return () => { window.clearTimeout(timer); requestId.current++ }
  }, [query, refresh])

  const showMore = async (): Promise<void> => {
    if (loadingMore || !searched) return
    const id = requestId.current
    setLoadingMore(true)
    setMoreError('')
    try {
      const next = await searchTracksPage(searched, page + 1)
      if (id !== requestId.current) return
      setResults((current) => {
        const seen = new Set(current.map((track) => track.id))
        const seenText = new Set(current.map((track) => `${track.title}|${track.artist}`.toLowerCase().replace(/\s+/g, ' ').trim()))
        return [...current, ...next.tracks.filter((track) =>
          !seen.has(track.id) && !seenText.has(`${track.title}|${track.artist}`.toLowerCase().replace(/\s+/g, ' ').trim())
        )]
      })
      setPage((current) => current + 1)
      setHasMore(next.hasMore)
    } catch (cause) {
      if (id === requestId.current) setMoreError(cause instanceof Error ? cause.message : 'Não foi possível carregar mais resultados.')
    } finally {
      if (id === requestId.current) setLoadingMore(false)
    }
  }

  return (
    <section className="page" style={{ ['--hue' as string]: 220 }}>
      <div className="search-results-heading">
        <h1>Buscar músicas</h1>
        <p>Pesquise na barra superior por músicas ou artistas. Pressione <kbd>Ctrl K</kbd> de qualquer tela.</p>
      </div>
      {loading && <p className="empty">Buscando…</p>}
      {!loading && error && <div className="search-error" role={retryable ? 'alert' : 'status'}><p>{error}</p>{retryable && <button className="settings-action" onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</button>}</div>}
      {!loading && !error && !results.length && <p className="empty">Digite pelo menos 2 caracteres na barra de pesquisa acima.</p>}
      {!loading && results.length > 0 && (
        <>
          <h2 className="shelf-title">Resultados para "{searched}"</h2>
          <TrackList tracks={results} onCreatePlaylist={onCreatePlaylist} />
          {moreError && <p className="search-more-error" role="alert">{moreError}</p>}
          {hasMore && (
            <button className="show-more" onClick={() => void showMore()} disabled={loadingMore}>
              {loadingMore ? 'Buscando mais…' : 'Mostrar mais'}
            </button>
          )}
        </>
      )}
    </section>
  )
}
