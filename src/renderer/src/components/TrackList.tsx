import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '@shared/types'
import { useLibrary } from '../library'
import { currentTrack, usePlayer } from '../player'
import { fmtTime, hueOf } from '../util'
import { Icon } from './Icon'

type ContextPosition = { x: number; y: number }

function TrackContextMenu({ track, position, liked, onClose, onCreatePlaylist, onShowDetails }: {
  track: Track
  position: ContextPosition
  liked: boolean
  onClose: () => void
  onCreatePlaylist: (track: Track) => void
  onShowDetails: (track: Track) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const playlists = useLibrary((s) => s.playlists)
  const [feedback, setFeedback] = useState('')
  const left = Math.max(8, Math.min(position.x, window.innerWidth - 268))
  const top = Math.max(8, Math.min(position.y, window.innerHeight - 420))

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointerDown = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]
        const current = items.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'Home' ? 0
          : event.key === 'End' ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        if (items[next]) {
          event.preventDefault()
          items[next].focus()
        }
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(track.uri)
      setFeedback('Link direto da faixa copiado.')
    } catch {
      setFeedback('Não foi possível copiar o link. Verifique as permissões da área de transferência.')
    }
  }

  return (
    <div ref={ref} className="track-context-menu" role="menu" aria-label={`Ações para ${track.title}`} style={{ left, top }}>
      <strong>{track.title}</strong>
      <button role="menuitem" onClick={() => { usePlayer.getState().enqueueNext(track); onClose() }}>Tocar a seguir</button>
      <button role="menuitem" onClick={() => { useLibrary.getState().toggleLike(track); onClose() }}>
        {liked ? 'Remover das músicas salvas' : 'Salvar nas músicas salvas'}
      </button>
      {track.source === 'local' && <button role="menuitem" onClick={() => { onShowDetails(track); onClose() }}>{track.cover ? 'Trocar capa…' : 'Escolher capa…'}</button>}
      {track.source !== 'local' && <button role="menuitem" onClick={() => { void copyLink() }}>Copiar link da fonte</button>}
      <button role="menuitem" onClick={() => { onShowDetails(track); onClose() }}>Detalhes da faixa</button>
      <div className="context-subtitle">Adicionar à playlist</div>
      {playlists.length
        ? playlists.map((playlist) => (
            <button key={playlist.id} role="menuitem" onClick={() => { useLibrary.getState().addToPlaylist(playlist.id, track); onClose() }}>
              {playlist.trackIds.includes(track.id) ? '✓ ' : ''}{playlist.name}
            </button>
          ))
        : <div className="track-context-feedback">Nenhuma playlist criada.</div>}
      <button role="menuitem" onClick={() => { onCreatePlaylist(track); onClose() }}>+ Criar playlist com esta faixa</button>
      {feedback && <p className="track-context-feedback" role="status">{feedback}</p>}
    </div>
  )
}

function TrackDetailsDialog({ track, onClose, onCoverChange }: {
  track: Track | null
  onClose: () => void
  onCoverChange: (track: Track) => void
}) {
  const coverInput = useRef<HTMLInputElement>(null)
  const [coverError, setCoverError] = useState('')
  useEffect(() => {
    if (!track) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [track, onClose])

  if (!track) return null
  const selectCover = async (file?: File): Promise<void> => {
    if (!file) return
    setCoverError('')
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Escolha uma imagem PNG, JPEG ou WebP.')
      if (file.size > 15 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 15 MB.')
      const bitmap = await createImageBitmap(file)
      let cover: string
      try {
        const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Não foi possível processar a imagem.')
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        cover = canvas.toDataURL('image/jpeg', 0.88)
      } finally {
        bitmap.close()
      }
      useLibrary.getState().updateTrackCover(track.id, cover)
      onCoverChange({ ...track, cover, coverLookupAttempted: true })
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'Não foi possível usar essa imagem como capa.')
    }
  }
  const removeCover = (): void => {
    useLibrary.getState().updateTrackCover(track.id, undefined)
    onCoverChange({ ...track, cover: undefined, coverLookupAttempted: true })
  }
  const sourceNames: Record<string, string> = {
    local: 'Arquivo local',
    audius: 'Audius',
    jamendo: 'Jamendo',
    archive: 'Internet Archive',
    openverse: 'Openverse',
    librivox: 'LibriVox',
    youtube: 'YouTube'
  }
  return (
    <div className="track-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="track-details-dialog" role="dialog" aria-modal="true" aria-labelledby="track-details-title">
        <header className="track-details-heading">
          <h2 id="track-details-title">Detalhes da faixa</h2>
          <button className="icon-btn" aria-label="Fechar detalhes" onClick={onClose}><Icon name="close" /></button>
        </header>
        {track.source === 'local' && <div className="local-cover-editor">
          {track.cover && <img src={track.cover} alt={`Capa atual de ${track.title}`} />}
          <div className="local-cover-actions">
            <button className="settings-action" onClick={() => coverInput.current?.click()}>{track.cover ? 'Trocar capa' : 'Escolher capa'}</button>
            {track.cover && <button className="settings-action" onClick={removeCover}>Remover capa</button>}
            <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
              void selectCover(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }} />
          </div>
          {coverError && <p className="local-cover-error" role="alert">{coverError}</p>}
          <p className="settings-tip">A imagem é redimensionada e salva junto com a biblioteca neste dispositivo.</p>
        </div>}
        <dl className="np-details">
          <div><dt>Título</dt><dd>{track.title}</dd></div>
          <div><dt>Artista</dt><dd>{track.artist || 'Não informado'}</dd></div>
          <div><dt>Álbum</dt><dd>{track.album || 'Não informado'}</dd></div>
          <div><dt>Fonte</dt><dd>{sourceNames[track.source] || track.source}</dd></div>
          <div><dt>Duração</dt><dd>{track.duration && track.duration > 0 ? fmtTime(track.duration) : 'Não informada'}</dd></div>
          <div><dt>Licença</dt><dd>{track.license || 'Não informada pela fonte'}</dd></div>
          <div><dt>Link da fonte</dt><dd>{track.source === 'local' ? <span className="track-details-link">Arquivo local deste dispositivo</span> : <a className="track-details-link" href={track.uri} target="_blank" rel="noreferrer">{track.uri}</a>}</dd></div>
        </dl>
      </section>
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
  const [contextMenu, setContextMenu] = useState<{ track: Track; position: ContextPosition } | null>(null)
  const [detailsTrack, setDetailsTrack] = useState<Track | null>(null)
  const closeContextMenu = useCallback((): void => setContextMenu(null), [])
  const closeDetails = useCallback((): void => setDetailsTrack(null), [])

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
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({ track: t, position: { x: event.clientX, y: event.clientY } })
            }}
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
              <button
                className="icon-btn hov"
                title="Mais ações"
                aria-label={`Mais ações para ${t.title}`}
                aria-haspopup="menu"
                aria-expanded={contextMenu?.track.id === t.id}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setContextMenu({ track: t, position: { x: rect.left, y: rect.bottom } })
                }}
              >
                <Icon name="more" size={17} />
              </button>
              {onRemove && (
                <button className="icon-btn hov" title="Remover desta playlist" onClick={() => onRemove(t)}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {contextMenu && (
        <TrackContextMenu
          track={contextMenu.track}
          position={contextMenu.position}
          liked={likedSet.has(contextMenu.track.id)}
          onClose={closeContextMenu}
          onCreatePlaylist={onCreatePlaylist}
          onShowDetails={setDetailsTrack}
        />
      )}
      <TrackDetailsDialog track={detailsTrack} onClose={closeDetails} onCoverChange={setDetailsTrack} />
    </div>
  )
}
