import { useEffect, useRef, useState } from 'react'
import { Icon } from './components/Icon'
import { SettingsDialog } from './components/SettingsDialog'
import './themes'
import './modhub'
import { DiscoverView } from './views/DiscoverView'
import { AudioStudioView, MiniPlayer } from './views/AudioStudioView'
import { DeveloperView } from './views/DeveloperView'
import { ModHubView } from './views/ModHubView'
import { ThemesView } from './views/ThemesView'
import { Sidebar, type View } from './components/Sidebar'
import { PlayerBar } from './components/PlayerBar'
import { NowPanel } from './components/NowPanel'
import { HomeView } from './views/HomeView'
import { SearchView } from './views/SearchView'
import { SavedView } from './views/SavedView'
import { PlaylistView } from './views/PlaylistView'
import { useLibrary } from './library'
import { usePlayer } from './player'

export default function App() {
  const ready = useLibrary((s) => s.ready)
  const hasTrack = usePlayer((s) => s.index >= 0)
  const [view, setView] = useState<View>({ type: 'home' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('openfy-search-history') || '[]') as string[] }
    catch { return [] }
  })
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitSearch = (value: string): void => {
    const q = value.trim()
    if (!q) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setSearchQuery(q)
    setView({ type: 'search' })
    setSearchFocused(false)
    setSearchHistory((old) => {
      const next = [q, ...old.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8)
      localStorage.setItem('openfy-search-history', JSON.stringify(next))
      return next
    })
  }
  const updateSearch = (value: string): void => {
    setSearchQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.trim().length >= 2) {
      searchTimer.current = setTimeout(() => setView({ type: 'search' }), 350)
    }
  }

  const [showNow, setShowNow] = useState(() => localStorage.getItem('openfy-show-now') !== 'false')

  useEffect(() => {
    void useLibrary
      .getState()
      .init()
      .then(async () => { usePlayer.getState().setVolume(useLibrary.getState().settings.volume); await usePlayer.getState().restoreSession() })
    return window.api.onMediaKey((k) => {
      const p = usePlayer.getState()
      if (k === 'play-pause') p.toggle()
      else if (k === 'next') p.next()
      else p.prev()
    })
  }, [])

  useEffect(() => {
    let lastTitle = ''
    const sync = (): void => {
      const state = usePlayer.getState()
      const track = state.queue[state.index]
      const title = track?.title || ''
      if (lastTitle !== title || state.playing !== previousPlaying) {
        lastTitle = title
        previousPlaying = state.playing
        window.api.desktopUpdatePlayback(state.playing, title, track?.artist)
      }
    }
    let previousPlaying = false
    const unsubscribe = usePlayer.subscribe(sync)
    sync()
    return unsubscribe
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement)?.tagName
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (e.key === 'Escape') setSearchFocused(false)
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'BUTTON') {
        e.preventDefault()
        usePlayer.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [])

  if (!ready) return <div className="loading">Carregando…</div>

  return (
    <div className={'app' + (hasTrack && showNow ? ' np-on' : '')}>
      <Sidebar view={view} setView={setView} />
      <header className="topbar">
        <button className="topbar-brand" onClick={() => setView({type:'home'})}><img className="openfy-pulse-brand" src="/openfy-pulse.png" alt="" /> Openfy</button>
        <div className="topbar-links">
          <button className={view.type === 'home' ? 'selected' : ''} onClick={() => setView({type:'home'})}>Início</button>
          <button className={view.type === 'discover' ? 'selected' : ''} onClick={() => setView({type:'discover'})}>Descobrir</button>
        </div>
        <div className="global-search-wrap">
          <form className="global-search" role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(searchQuery) }}>
            <Icon name="search" size={20} />
            <input ref={searchRef} aria-label="Buscar músicas e artistas" placeholder="O que você quer ouvir?" value={searchQuery}
              onFocus={() => { setSearchFocused(true); setView({ type: 'search' }) }}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
              onChange={(e) => updateSearch(e.target.value)} />
            {searchQuery ? <button type="button" className="global-search-clear" title="Limpar pesquisa" onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}><Icon name="close" size={17}/></button> : <kbd>Ctrl K</kbd>}
          </form>
          {searchFocused && !searchQuery.trim() && searchHistory.length > 0 && (
            <div className="global-search-suggestions">
              <div className="global-search-suggestion-heading">Pesquisas recentes <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setSearchHistory([]); localStorage.removeItem('openfy-search-history') }}>Limpar</button></div>
              {searchHistory.map((item) => <button key={item} onMouseDown={(e) => e.preventDefault()} onClick={() => submitSearch(item)}><Icon name="search" size={16}/>{item}</button>)}
            </div>
          )}
        </div>
        <div className="topbar-actions">
          <button title="Mostrar ou ocultar painel da música" className="topbar-icon" onClick={() => {const next = !showNow;setShowNow(next);localStorage.setItem('openfy-show-now', String(next))}}>▣</button>
          <button title="Configurações" aria-label="Configurações" className="topbar-icon" onClick={() => setSettingsOpen(true)}><Icon name="settings" size={21}/></button>
          <button title="Temas e mods" className="topbar-profile" onClick={() => setView({type:'themes'})}>OF</button>
        </div>
      </header>
      <main className="main">
        {view.type === 'themes' && <ThemesView />}
        {view.type === 'modhub' && <ModHubView />}
        {view.type === 'developer' && <DeveloperView />}
        {view.type === 'discover' && <DiscoverView />}
        {view.type === 'studio' && <AudioStudioView />}
        {view.type === 'home' && <HomeView setView={setView} />}
        {view.type === 'search' && <SearchView query={searchQuery} onQueryChange={updateSearch} onSearch={submitSearch} />}
        {view.type === 'saved' && <SavedView />}
        {view.type === 'playlist' && (
          <PlaylistView key={view.id} id={view.id} onDeleted={() => setView({ type: 'home' })} />
        )}
      </main>
      {showNow && <NowPanel />}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onNavigate={(v) => {setView(v);setSettingsOpen(false)}} showNow={showNow} onToggleNow={() => {const next = !showNow;setShowNow(next);localStorage.setItem('openfy-show-now',String(next))}} />
      <MiniPlayer />
      <PlayerBar />
    </div>
  )
}
