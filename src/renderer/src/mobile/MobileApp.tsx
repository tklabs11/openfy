import { useEffect, useRef, useState } from 'react'
import type { Track } from '@shared/types'
import { currentTrack, usePlayer, youtube } from '../player'
import { useLibrary } from '../library'
import { onVideoWindowChange, openVideoWindow, videoWindowSupported } from './backgroundAudio'
import { fmtTime, hueOf, plural } from '../util'
import { Icon } from '../components/Icon'
import { SettingsDialog } from '../components/SettingsDialog'
import { PlaylistDetailsDialog, type PlaylistDetails } from '../components/PlaylistDetailsDialog'
import { HomeView } from '../views/HomeView'
import { SearchView } from '../views/SearchView'
import { SavedView } from '../views/SavedView'
import { PlaylistView } from '../views/PlaylistView'
import { ThemesView } from '../views/ThemesView'
import { DeveloperView } from '../views/DeveloperView'
import { DiscoverView } from '../views/DiscoverView'
import type { View } from '../components/Sidebar'

type Tab = 'home' | 'search' | 'library'

const TABS: { id: Tab; label: string; icon: 'home' | 'search' | 'library' }[] = [
  { id: 'home', label: 'Início', icon: 'home' },
  { id: 'search', label: 'Buscar', icon: 'search' },
  { id: 'library', label: 'Biblioteca', icon: 'library' }
]

const ROOT_VIEWS: Record<Tab, View> = {
  home: { type: 'home' },
  search: { type: 'search' },
  library: { type: 'library' }
}

export function MobileApp() {
  const [tab, setTab] = useState<Tab>('home')
  const [view, setView] = useState<View>({ type: 'home' })
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [inVideoWindow, setInVideoWindow] = useState(false)
  const [playlistEditor, setPlaylistEditor] = useState<{ playlistId?: string; firstTrack?: Track } | null>(null)
  const editingPlaylist = useLibrary((s) => s.playlists.find((p) => p.id === playlistEditor?.playlistId))

  // O player do YouTube precisa de um contêiner que continue montado: mover o
  // iframe recarrega o vídeo e interromperia a música ao abrir/fechar o player.
  const youtubeStage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    youtube.attach(youtubeStage.current)
    return () => youtube.attach(null)
  }, [])

  // Na janela flutuante o palco do vídeo ocupa a tela; fora dela fica escondido.
  useEffect(() => onVideoWindowChange(setInVideoWindow), [])

  const openTab = (next: Tab): void => {
    setTab(next)
    setView(ROOT_VIEWS[next])
  }

  const openView = (next: View): void => {
    if (next.type === 'home') setTab('home')
    else if (next.type === 'search') setTab('search')
    else if (next.type === 'saved') setTab('library')
    else if (next.type === 'playlist') setTab('library')
    setView(next)
  }

  const backToTab = (): void => setView(ROOT_VIEWS[tab])
  const isRootView = view.type === ROOT_VIEWS[tab].type
  const createTrack = (track: Track): void => setPlaylistEditor({ firstTrack: track })

  return (
    <div className="m-app">
      <header className="m-top">
        {isRootView ? (
          <span className="m-brand"><img src="./openfy-pulse.png" alt="" /> Openfy</span>
        ) : (
          <button className="m-icon" onClick={backToTab} aria-label="Voltar"><Icon name="prev" size={20} /></button>
        )}
        <div className="m-top-actions">
          {tab === 'library' && <button className="m-icon" aria-label="Criar playlist" onClick={() => setPlaylistEditor({})}><Icon name="plus" size={20} /></button>}
          <button className="m-icon" aria-label="Configurações" onClick={() => setSettingsOpen(true)}><Icon name="settings" size={20} /></button>
        </div>
      </header>

      <main className="m-main">
        {view.type === 'home' && <HomeView setView={openView} />}
        {view.type === 'search' && (
          <div className="m-search">
            <form className="m-search-box" role="search" onSubmit={(e) => e.preventDefault()}>
              <Icon name="search" size={19} />
              <input aria-label="Buscar músicas e artistas" placeholder="O que você quer ouvir?" value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery('')}><Icon name="close" size={16} /></button>}
            </form>
            <SearchView query={query} onQueryChange={setQuery} onSearch={setQuery} onCreatePlaylist={createTrack} />
          </div>
        )}
        {view.type === 'saved' && <SavedView onCreatePlaylist={createTrack} />}
        {view.type === 'library' && <MobileLibrary onCreatePlaylist={() => setPlaylistEditor({})} onOpen={(v) => openView(v)} />}
        {view.type === 'playlist' && (
          <PlaylistView
            key={view.id}
            id={view.id}
            onDeleted={() => setView(ROOT_VIEWS.library)}
            onEdit={() => setPlaylistEditor({ playlistId: view.id })}
            onCreatePlaylist={createTrack}
          />
        )}
        {view.type === 'discover' && <DiscoverView onCreatePlaylist={createTrack} />}
        {view.type === 'themes' && <ThemesView />}
        {view.type === 'developer' && <DeveloperView />}
      </main>

      <MiniPlayer onOpen={() => setPlayerOpen(true)} />
      {playerOpen && <FullPlayer onClose={() => setPlayerOpen(false)} />}
      <div ref={youtubeStage} className={'m-yt-stage' + (inVideoWindow ? ' pip' : '')} aria-hidden="true" />

      <nav className="m-nav" aria-label="Navegação principal">
        {TABS.map((item) => (
          <button key={item.id} className={'m-tab' + (tab === item.id ? ' active' : '')} aria-current={tab === item.id ? 'page' : undefined} onClick={() => openTab(item.id)}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNavigate={(v) => { setView(v); setSettingsOpen(false) }}
        showNow={false}
        panelLocked={false}
        onToggleNow={() => {}}
      />
      <PlaylistDetailsDialog
        open={playlistEditor !== null}
        playlist={editingPlaylist}
        onClose={() => setPlaylistEditor(null)}
        onSave={(details: PlaylistDetails) => {
          if (playlistEditor?.playlistId) {
            useLibrary.getState().updatePlaylist(playlistEditor.playlistId, details)
          } else {
            const id = useLibrary.getState().createPlaylist(details.name, playlistEditor?.firstTrack, details)
            openView({ type: 'playlist', id })
          }
          setPlaylistEditor(null)
        }}
      />
    </div>
  )
}

function MobileLibrary({ onOpen, onCreatePlaylist }: { onOpen: (view: View) => void; onCreatePlaylist: () => void }) {
  const playlists = useLibrary((s) => s.playlists)
  const liked = useLibrary((s) => s.liked.length)

  return (
    <section className="m-library">
      <h1>Sua biblioteca</h1>
      <button className="m-lib-item" onClick={() => onOpen({ type: 'saved' })}>
        <span className="m-lib-art liked"><Icon name="heart" size={22} /></span>
        <span><strong>Músicas salvas</strong><small>{plural(liked)}</small></span>
      </button>
      {playlists.map((playlist) => (
        <button key={playlist.id} className="m-lib-item" onClick={() => onOpen({ type: 'playlist', id: playlist.id })}>
          <span className="m-lib-art" style={{ background: `linear-gradient(135deg, hsl(${hueOf(playlist.id)} 45% 38%), hsl(${(hueOf(playlist.id) + 40) % 360} 45% 22%))` }}>
            {playlist.cover ? <img src={playlist.cover} alt="" /> : <Icon name="music" size={20} />}
          </span>
          <span><strong>{playlist.name}</strong><small>{plural(playlist.trackIds.length)}</small></span>
        </button>
      ))}
      <button className="m-lib-create" onClick={onCreatePlaylist}><Icon name="plus" size={18} /> Criar playlist</button>
    </section>
  )
}

function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const track = usePlayer(currentTrack)
  const playing = usePlayer((s) => s.playing)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  if (!track) return null
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <div className="m-mini">
      <button className="m-mini-open" onClick={onOpen} aria-label={`Abrir player: ${track.title}`}>
        {track.cover ? <img src={track.cover} alt="" /> : <span className="m-mini-art"><Icon name="music" size={18} /></span>}
        <span className="m-mini-text"><strong>{track.title}</strong><small>{track.artist}</small></span>
      </button>
      <button className="m-icon" aria-label={playing ? 'Pausar' : 'Tocar'} onClick={() => usePlayer.getState().toggle()}><Icon name={playing ? 'pause' : 'play'} size={22} /></button>
      <button className="m-icon" aria-label="Próxima" onClick={() => usePlayer.getState().next()}><Icon name="next" size={22} /></button>
      <span className="m-mini-progress" style={{ width: pct + '%' }} />
    </div>
  )
}

function FullPlayer({ onClose }: { onClose: () => void }) {
  const track = usePlayer(currentTrack)
  const playing = usePlayer((s) => s.playing)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const volume = usePlayer((s) => s.volume)
  const liked = useLibrary((s) => (track ? s.liked.includes(track.id) : false))
  const [queueOpen, setQueueOpen] = useState(false)
  const queue = usePlayer((s) => s.queue)
  const index = usePlayer((s) => s.index)
  const [pipAvailable, setPipAvailable] = useState(false)

  useEffect(() => {
    void videoWindowSupported().then(setPipAvailable)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!track) return null
  const p = usePlayer.getState
  const shown = Math.min(position, duration || position)

  return (
    <div className="openfy-immersive m-full" role="dialog" aria-modal="true" aria-label="Player">
      <div className="openfy-immersive-bg" style={track.cover ? { ['--immersive-art' as string]: `url("${track.cover.replaceAll('"', '%22')}")` } : undefined} />
      <button className="openfy-immersive-close" onClick={onClose} aria-label="Fechar player"><Icon name="close" size={18} /> Fechar</button>
      <div className="openfy-immersive-content">
        {track.cover
          ? <img className="openfy-immersive-cover" src={track.cover} alt={`Capa de ${track.title}`} />
          : <div className="openfy-immersive-cover openfy-cover-placeholder"><Icon name="music" size={80} /></div>}
        <h1>{track.title}</h1>
        <p>{track.artist || 'Artista desconhecido'}</p>
        {track.source === 'youtube' && (
          <small className="m-full-note">
            O áudio continua tocando quando você sai do app
            {pipAvailable ? '; o botão abre o vídeo em janela flutuante.' : '.'}
          </small>
        )}

        <div className="openfy-immersive-progress">
          <span>{fmtTime(shown)}</span>
          <input type="range" min={0} max={duration || 1} step={0.1} value={shown} onChange={(e) => p().seek(Number(e.target.value))} aria-label="Posição da música" />
          <span>{fmtTime(duration)}</span>
        </div>

        <div className="openfy-immersive-controls">
          <button title="Anterior" aria-label="Anterior" onClick={() => p().prev()}><Icon name="prev" size={30} /></button>
          <button className="openfy-immersive-play" title={playing ? 'Pausar' : 'Tocar'} aria-label={playing ? 'Pausar' : 'Tocar'} onClick={() => p().toggle()}><Icon name={playing ? 'pause' : 'play'} size={32} /></button>
          <button title="Próxima" aria-label="Próxima" onClick={() => p().next()}><Icon name="next" size={30} /></button>
        </div>

        <div className="m-full-actions">
          <button className={'m-full-action' + (liked ? ' on' : '')} onClick={() => useLibrary.getState().toggleLike(track)} aria-label={liked ? 'Remover das músicas salvas' : 'Salvar'}>
            <Icon name="heart" size={22} outline={!liked} />
          </button>
          <button className="m-full-action" onClick={() => setQueueOpen((open) => !open)} aria-label="Fila de reprodução"><Icon name="queue" size={22} /></button>
          {track.source === 'youtube' && pipAvailable && (
            <button className="m-full-action" onClick={() => void openVideoWindow()} aria-label="Ver em janela flutuante"><Icon name="panel" size={22} /></button>
          )}
          <label className="m-full-volume">
            <Icon name="volume" size={18} />
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => p().setVolume(Number(e.target.value))} aria-label="Volume" />
          </label>
        </div>

        {queueOpen && (
          <div className="np-queue m-full-queue">
            {queue.map((item, i) => (
              <button key={`${item.id}-${i}`} className={'np-queue-track' + (i === index ? ' current' : '')} onClick={() => p().playQueue(queue, i)}>
                {item.cover ? <img src={item.cover} alt="" /> : <span className="np-queue-cover"><Icon name="music" size={18} /></span>}
                <span className="np-queue-text"><strong>{item.title}</strong><small>{item.artist}{i === index ? ' · Tocando agora' : ''}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
