import { useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '@shared/types'
import { useLibrary } from '../library'
import { currentTrack, usePlayer } from '../player'
import { fmtTime } from '../util'
import { Icon } from './Icon'

function AddMenu({ track }: { track: Track }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const playlists = useLibrary((s) => s.playlists)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn hov" title="Adicionar à playlist" onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={18} />
      </button>
      {open && (
        <div className="menu">
          <div className="menu-title">Adicionar à playlist</div>
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                useLibrary.getState().addToPlaylist(p.id, track)
                setOpen(false)
              }}
            >
              {p.name}
              {p.trackIds.includes(track.id) ? '  ✓' : ''}
            </button>
          ))}
          <button
            className="menu-new"
            onClick={() => {
              const n = useLibrary.getState().playlists.length + 1
              useLibrary.getState().createPlaylist(`Minha playlist nº ${n}`, track)
              setOpen(false)
            }}
          >
            + Nova playlist
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  tracks: Track[]
  empty?: string
  onRemove?: (t: Track) => void
}

export function TrackList({ tracks, empty = 'Nada por aqui ainda.', onRemove }: Props) {
  const current = usePlayer(currentTrack)
  const playing = usePlayer((s) => s.playing)
  const liked = useLibrary((s) => s.liked)
  const likedSet = useMemo(() => new Set(liked), [liked])

  if (!tracks.length) return empty ? <p className="empty">{empty}</p> : null

  return (
    <div className="tracklist">
      <div className="row head">
        <span className="idx">#</span>
        <span>Título</span>
        <span className="album">Álbum</span>
        <span />
        <span className="dur">Duração</span>
        <span />
      </div>
      {tracks.map((t, i) => {
        const isCurrent = current?.id === t.id
        const isLiked = likedSet.has(t.id)
        return (
          <div
            key={t.id + ':' + i}
            className={'row' + (isCurrent ? ' current' : '')}
            onDoubleClick={() => usePlayer.getState().playQueue(tracks, i)}
          >
            <button className="idx" onClick={() => usePlayer.getState().playQueue(tracks, i)}>
              <span className="n">{isCurrent && playing ? '♪' : i + 1}</span>
              <span className="p"><Icon name="play" size={16} /></span>
            </button>
            <div className="meta">
              {t.cover ? (
                <img className="cover" src={t.cover} alt="" />
              ) : (
                <div className="cover ph"><Icon name="music" size={18} /></div>
              )}
              <div className="txt">
                <div className="title">{t.title}</div>
                <div className="artist">{t.artist || 'Artista desconhecido'}</div>
              </div>
            </div>
            <span className="album">{t.album || '—'}</span>
            <button
              className={'icon-btn heart' + (isLiked ? ' on' : ' hov')}
              title={isLiked ? 'Remover das músicas salvas' : 'Salvar nas músicas salvas'}
              onClick={() => useLibrary.getState().toggleLike(t)}
            >
              <Icon name="heart" size={18} outline={!isLiked} />
            </button>
            <span className="dur">{t.duration ? fmtTime(t.duration) : ''}</span>
            <div className="actions">
              <AddMenu track={t} />
              {onRemove && (
                <button className="icon-btn hov" title="Remover desta playlist" onClick={() => onRemove(t)}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
