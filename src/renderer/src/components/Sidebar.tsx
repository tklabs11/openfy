import { useState } from 'react'
import { useLibrary } from '../library'
import { hueOf, plural } from '../util'
import { Icon } from './Icon'

export type View =
  | { type: 'home' }
  | { type: 'search' }
  | { type: 'discover' }
  | { type: 'studio' }
  | { type: 'themes' }
  | { type: 'modhub' }
  | { type: 'developer' }
  | { type: 'saved' }
  | { type: 'playlist'; id: string }

interface Props {
  view: View
  setView: (v: View) => void
}

export function Sidebar({ view, setView }: Props) {
  const playlists = useLibrary((s) => s.playlists)
  const likedCount = useLibrary((s) => s.liked.length)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const create = (): void => {
    if (name.trim()) {
      const id = useLibrary.getState().createPlaylist(name)
      setView({ type: 'playlist', id })
    }
    setName('')
    setCreating(false)
  }

  return (
    <aside className="sidebar">
      <div className="panel top sidebar-quick">
        <div className="sidebar-caption">ACESSO RÁPIDO</div>
        <button className={'nav' + (view.type === 'home' ? ' active' : '')} onClick={() => setView({type:'home'})}><Icon name="home" size={20}/> Início</button>
        <button className={'nav' + (view.type === 'discover' ? ' active' : '')} onClick={() => setView({type:'discover'})}><span className="theme-nav-icon">◎</span> Descobrir</button>
      </div>
      <div className="panel lib">
        <div className="lib-head">
          <span><Icon name="library" size={24} /> Sua Biblioteca</span>
          <button className="icon-btn" title="Criar playlist" onClick={() => setCreating(true)}>
            <Icon name="plus" size={22} />
          </button>
        </div>
        {creating && (
          <input
            className="pl-input"
            autoFocus
            placeholder="Nome da playlist"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') {
                setName('')
                setCreating(false)
              }
            }}
            onBlur={create}
          />
        )}
        <div className="lib-list">
          <button className={'lib-item' + (view.type === 'saved' ? ' active' : '')} onClick={() => setView({ type: 'saved' })}>
            <div className="sq liked"><Icon name="heart" size={20} /></div>
            <div className="txt">
              <div className="title">Músicas salvas</div>
              <div className="artist">Playlist • {plural(likedCount)}</div>
            </div>
          </button>
          {playlists.map((p) => (
            <button
              key={p.id}
              className={'lib-item' + (view.type === 'playlist' && view.id === p.id ? ' active' : '')}
              onClick={() => setView({ type: 'playlist', id: p.id })}
            >
              <div className="sq" style={{ background: `linear-gradient(135deg, hsl(${hueOf(p.id)} 45% 38%), hsl(${(hueOf(p.id) + 40) % 360} 45% 22%))` }}>
                <Icon name="music" size={20} />
              </div>
              <div className="txt">
                <div className="title">{p.name}</div>
                <div className="artist">Playlist • {plural(p.trackIds.length)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
