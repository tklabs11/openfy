import { useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '@shared/types'
import { useLibrary } from '../library'
import { currentTrack, usePlayer } from '../player'
import { fmtTime, hueOf } from '../util'
import { Icon } from './Icon'

function AddMenu({ track, onCreatePlaylist }: { track: Track; onCreatePlaylist: (track: Track) => void }) {
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
      <button className="icon-btn hov" title="Adicionar música" onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={18} />
      </button>
      {open && (
        <div className="menu">
          <div className="menu-title">Adicionar música</div>
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
              usePlayer.getState().enqueueNext(track)
              setOpen(false)
            }}
          >
            Tocar a seguir
          </button>
          <button
            className="menu-new"
            onClick={() => {
              onCreatePlaylist(track)
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
  onCreatePlaylist: (track: Track) => void
  onReorder?: (fromTrackId: string, toTrackId: string) => void
}

export function TrackList({ tracks, empty = 'Nada por aqui ainda.', onRemove, onCreatePlaylist, onReorder }: Props) {
  const current = usePlayer(currentTrack)
  const playing = usePlayer((s) => s.playing)
  const liked = useLibrary((s) => s.liked)
  const likedSet = useMemo(() => new Set(liked), [liked])
  const draggedTrack = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  if (!tracks.length) return empty ? <p className="empty">{empty}</p> : null

  return (
    <div className="tracklist">
      <div className="row head">
        <span className="idx">#</span>
        <span>Título</span>
        <span className="album">Álbum</span>
        <span className="dur">Duração</span>
        <span className="heart-heading" aria-label="Favorita" />
        <span />
      </div>
      {tracks.map((t, i) => {
        const isCurrent = current?.id === t.id
        const isLiked = likedSet.has(t.id)
        return (
          <div
            key={t.id}
            className={'row' + (isCurrent ? ' current' : '') + (onReorder ? ' reorderable' : '') + (dropTarget === t.id ? ' drop-target' : '')}
            draggable={!!onReorder}
            onDragStart={(event) => {
              if (!onReorder) return
              draggedTrack.current = t.id
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', t.id)
            }}
            onDragOver={(event) => {
              if (!onReorder || !draggedTrack.current || draggedTrack.current === t.id) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDropTarget(t.id)
            }}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDropTarget(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              const fromTrackId = draggedTrack.current ?? event.dataTransfer.getData('text/plain')
              if (fromTrackId && fromTrackId !== t.id) onReorder?.(fromTrackId, t.id)
              draggedTrack.current = null
              setDropTarget(null)
            }}
            onDragEnd={() => {
              draggedTrack.current = null
              setDropTarget(null)
            }}
            onDoubleClick={() => usePlayer.getState().playQueue(tracks, i)}
          >
            <button className="idx" onClick={() => usePlayer.getState().playQueue(tracks, i)}>
              <span className="n">{isCurrent && playing ? '♪' : i + 1}</span>
              <span className="p"><Icon name="play" size={16} /></span>
            </button>
            <div className="meta">
              {onReorder && <span className="drag-handle" aria-hidden="true"><Icon name="drag" size={16} /></span>}
              {t.cover ? (
                <img className="cover" src={t.cover} alt="" />
              ) : (
                <div className="cover ph" style={{ background: `linear-gradient(145deg, hsl(${hueOf(t.id)} 48% 34%), hsl(${(hueOf(t.id) + 42) % 360} 42% 18%))` }}>
                  <span aria-hidden="true">{t.title.trim().charAt(0).toLocaleUpperCase() || '♪'}</span>
                </div>
              )}
              <div className="txt">
                <div className="title" title={t.title}>{t.title}</div>
                <div className="artist">{t.artist || 'Artista desconhecido'}</div>
              </div>
            </div>
            <span className="album">{t.album || '—'}</span>
            <span className="dur">{t.duration && t.duration > 0 ? fmtTime(t.duration) : '—'}</span>
            <button
              className={'icon-btn heart' + (isLiked ? ' on' : ' hov')}
              title={isLiked ? 'Remover das músicas salvas' : 'Salvar nas músicas salvas'}
              onClick={() => useLibrary.getState().toggleLike(t)}
            >
              <Icon name="heart" size={18} outline={!isLiked} />
            </button>
            <div className="actions">
              <AddMenu track={t} onCreatePlaylist={onCreatePlaylist} />
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
