import { useEffect, useRef, useState } from 'react'
import { currentTrack, usePlayer } from '../player'
import { useLibrary } from '../library'
import { fmtTime } from '../util'
import { Icon } from './Icon'

export function PlayerBar() {
  const track = usePlayer(currentTrack)
  const { playing, position, duration, volume, shuffle, repeat, error } = usePlayer()
  const [drag, setDrag] = useState<number | null>(null)
  const [immersive, setImmersive] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [previousVolume, setPreviousVolume] = useState(0.8)
  const queue = usePlayer((s) => s.queue)
  const currentIndex = usePlayer((s) => s.index)
  const draggedQueueIndex = useRef<number | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setImmersive(false); setQueueOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const toggleMute = () => {
    if (volume > 0) { setPreviousVolume(volume); p().setVolume(0) }
    else p().setVolume(previousVolume || 0.8)
  }
  const liked = useLibrary((s) => (track ? s.liked.includes(track.id) : false))

  const p = usePlayer.getState
  const shown = drag ?? position
  const pct = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0

  const commit = (): void => {
    if (drag !== null) p().seek(drag)
    setDrag(null)
  }

  return (
    <>
    <footer className="playerbar">
      <div className="now">
        {track ? (
          <>
            {track.cover ? (
              <img className="cover big" src={track.cover} alt="" />
            ) : (
              <div className="cover big ph"><Icon name="music" size={22} /></div>
            )}
            <div className="txt">
              <div className="title">{track.title}</div>
              <div className={error ? 'artist err' : 'artist'}>{error ?? track.artist}</div>
            </div>
            <button
              className={'icon-btn' + (liked ? ' on' : '')}
              title={liked ? 'Remover das músicas salvas' : 'Salvar'}
              onClick={() => useLibrary.getState().toggleLike(track)}
            >
              <Icon name="heart" size={18} outline={!liked} />
            </button>
          </>
        ) : (
          <div className="artist">Escolha uma música para começar</div>
        )}
      </div>

      <div className="center">
        <div className="controls">
          <button className={'icon-btn' + (shuffle ? ' on' : '')} title="Aleatório" onClick={() => p().toggleShuffle()}>
            <Icon name="shuffle" />
          </button>
          <button className="icon-btn" title="Anterior" onClick={() => p().prev()}>
            <Icon name="prev" size={24} />
          </button>
          <button className={'play-btn' + (playing ? ' is-playing' : '')} title={playing ? 'Pausar' : 'Tocar'} onClick={() => p().toggle()}>
            <Icon name={playing ? 'pause' : 'play'} size={24} />
          </button>
          <button className="icon-btn" title="Próxima" onClick={() => p().next()}>
            <Icon name="next" size={24} />
          </button>
          <button
            className={'icon-btn' + (repeat !== 'off' ? ' on' : '')}
            title={`Repetir: ${repeat}`}
            onClick={() => p().cycleRepeat()}
          >
            <Icon name="repeat" />
            {repeat === 'one' && <span className="one">1</span>}
          </button>
        </div>
        <div className="seek">
          <span>{fmtTime(shown)}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(shown, duration || 1)}
            style={{ ['--pct' as string]: pct + '%' }}
            onChange={(e) => setDrag(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
          />
          <span>{fmtTime(duration)}</span>
        </div>
      </div>

      <div className="vol">
        <button className={'icon-btn' + (queueOpen ? ' on' : '')} title="Fila de reprodução" aria-label="Fila de reprodução" onClick={() => setQueueOpen(!queueOpen)}><Icon name="queue" size={19}/></button>
        <button className="icon-btn" title={volume === 0 ? 'Ativar som' : 'Silenciar'} aria-label="Alternar mudo" onClick={toggleMute}><Icon name={volume === 0 ? 'mute' : 'volume'} size={18} /></button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          style={{ ['--pct' as string]: volume * 100 + '%' }}
          onChange={(e) => p().setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
        <span className="volume-percent" aria-live="off">{Math.round(volume * 100)}%</span>
        <button className="icon-btn" title="Tela cheia imersiva" aria-label="Tela cheia imersiva" onClick={() => setImmersive(true)}><Icon name="expand" size={19}/></button>
      </div>
    </footer>
    {queueOpen && <aside className="openfy-queue" aria-label="Fila de reprodução">
      <div className="openfy-queue-head">
        <strong>Fila de reprodução</strong>
        <div>
          <button className="openfy-queue-clear" disabled={currentIndex < 0 || queue.length <= 1} onClick={() => p().clearUpcoming()}>Limpar próximas</button>
          <button className="icon-btn" title="Fechar fila" onClick={() => setQueueOpen(false)}><Icon name="close"/></button>
        </div>
      </div>
      <div className="openfy-queue-list">
        {queue.length ? queue.map((item, i) => <div
          key={`${item.id}-${i}`}
          className={'openfy-queue-row' + (i === currentIndex ? ' active' : '')}
          draggable
          onDragStart={(event) => {
            draggedQueueIndex.current = i
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', String(i))
          }}
          onDragOver={(event) => {
            if (draggedQueueIndex.current === null || draggedQueueIndex.current === i) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(event) => {
            event.preventDefault()
            const from = draggedQueueIndex.current ?? Number(event.dataTransfer.getData('text/plain'))
            if (Number.isInteger(from)) p().moveQueueTrack(from, i)
            draggedQueueIndex.current = null
          }}
          onDragEnd={() => { draggedQueueIndex.current = null }}
        >
          <button className="openfy-queue-track" onClick={() => p().playQueue(queue, i)}>
            {item.cover ? <img src={item.cover} alt="" /> : <span className="openfy-queue-cover">♫</span>}
            <span><strong>{item.title}</strong><small>{item.artist}{i === currentIndex ? ' · Tocando agora' : ''}</small></span>
          </button>
          <div className="openfy-queue-actions">
            <button aria-label="Mover faixa para cima" title="Mover para cima" disabled={i === 0} onClick={() => p().moveQueueTrack(i, i - 1)}>↑</button>
            <button aria-label="Mover faixa para baixo" title="Mover para baixo" disabled={i === queue.length - 1} onClick={() => p().moveQueueTrack(i, i + 1)}>↓</button>
            <button aria-label={`Remover ${item.title} da fila`} title="Remover da fila" onClick={() => p().removeQueueTrack(i)}>×</button>
          </div>
        </div>) : <p>Nenhuma música na fila.</p>}
      </div>
    </aside>}
    {immersive && <div className="openfy-immersive" role="dialog" aria-modal="true" aria-label="Player imersivo" style={track?.cover ? { ['--immersive-art' as string]: `url("${track.cover.replaceAll('"','%22')}")` } : undefined}><div className="openfy-immersive-bg"/><button className="openfy-immersive-close" title="Fechar modo imersivo (Esc)" onClick={() => setImmersive(false)}><Icon name="close"/> Fechar</button><div className="openfy-immersive-content">{track?.cover ? <img className="openfy-immersive-cover" src={track.cover} alt="Capa do álbum"/> : <div className="openfy-immersive-cover openfy-cover-placeholder"><Icon name="music" size={80}/></div>}<h1>{track?.title || 'Openfy'}</h1><p>{track?.artist || 'Escolha uma música'}</p><div className="openfy-immersive-progress"><span>{fmtTime(shown)}</span><input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(shown, duration || 1)} onChange={e => p().seek(Number(e.target.value))} aria-label="Posição da música"/><span>{fmtTime(duration)}</span></div><div className="openfy-immersive-controls"><button title="Anterior" onClick={() => p().prev()}><Icon name="prev" size={30}/></button><button className="openfy-immersive-play" title={playing ? 'Pausar' : 'Tocar'} onClick={() => p().toggle()}><Icon name={playing ? 'pause' : 'play'} size={32}/></button><button title="Próxima" onClick={() => p().next()}><Icon name="next" size={30}/></button></div><small>OPENFY • Sua música, sua liberdade</small></div></div>}
    </>
  )
}
