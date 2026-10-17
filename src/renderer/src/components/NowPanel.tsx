import { useEffect, useMemo, useRef, useState } from 'react'
import type { LyricsSearchResult, TrackLyrics } from '@shared/types'
import { currentTrack, usePlayer, youtube } from '../player'
import { useLibrary } from '../library'
import { fmtTime } from '../util'
import { Icon } from './Icon'

type PanelTab = 'cover' | 'queue' | 'lyrics' | 'info'
type LyricsState =
  | { status: 'idle' | 'loading' | 'missing' }
  | { status: 'rate-limited'; retryAfterMs: number }
  | { status: 'error'; message: string }
  | { status: 'ready'; lyrics: TrackLyrics }
const lyricsCache = new Map<string, TrackLyrics | null>()
const sourceNames: Record<string, string> = {
  local: 'Arquivo local',
  audius: 'Audius',
  jamendo: 'Jamendo',
  archive: 'Internet Archive',
  openverse: 'Openverse',
  librivox: 'LibriVox',
  youtube: 'YouTube'
}

function syncedLines(value: string): { time: number; text: string }[] {
  return value.split(/\r?\n/).flatMap((line) => {
    const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
    const text = line.replace(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim()
    if (!text) return []
    return timestamps.map((match) => ({
      time: Number(match[1]) * 60 + Number(match[2]) + Number((match[3] ?? '').padEnd(3, '0') || 0) / 1000,
      text
    }))
  }).sort((a, b) => a.time - b.time)
}

export function NowPanel() {
  const track = usePlayer(currentTrack)
  const queue = usePlayer((s) => s.queue)
  const currentIndex = usePlayer((s) => s.index)
  const position = usePlayer((s) => s.position)
  const liked = useLibrary((s) => (track ? s.liked.includes(track.id) : false))
  const [tab, setTab] = useState<PanelTab>('cover')
  const [retry, setRetry] = useState(0)
  const [lyricsState, setLyricsState] = useState<LyricsState>({ status: 'idle' })
  const lyricsRequest = useRef(0)
  const lyricsContainer = useRef<HTMLDivElement>(null)
  const activeLyricElement = useRef<HTMLButtonElement>(null)
  const youtubeStage = useRef<HTMLDivElement>(null)
  const isYouTube = track?.source === 'youtube'

  useEffect(() => {
    youtube.attach(youtubeStage.current)
    return () => youtube.attach(null)
  }, [isYouTube])

  useEffect(() => {
    if (tab !== 'lyrics' || !track) return
    const requestId = ++lyricsRequest.current
    const cached = lyricsCache.get(track.id)
    if (cached !== undefined || lyricsCache.has(track.id)) {
      setLyricsState(cached ? { status: 'ready', lyrics: cached } : { status: 'missing' })
      return
    }
    if (!track.artist.trim()) {
      setLyricsState({ status: 'missing' })
      return
    }
    setLyricsState({ status: 'loading' })
    void window.api.getLyrics(track.title, track.artist, track.duration).then((result: LyricsSearchResult) => {
      if (lyricsRequest.current !== requestId) return
      if (result.status === 'found') {
        lyricsCache.set(track.id, result.lyrics)
        if (lyricsCache.size > 100) {
          const oldest = lyricsCache.keys().next()
          if (!oldest.done) lyricsCache.delete(oldest.value)
        }
        setLyricsState({ status: 'ready', lyrics: result.lyrics })
      } else if (result.status === 'not-found') {
        lyricsCache.set(track.id, null)
        setLyricsState({ status: 'missing' })
      } else if (result.status === 'rate-limited') {
        setLyricsState({ status: 'rate-limited', retryAfterMs: result.retryAfterMs })
      } else {
        setLyricsState({ status: 'error', message: result.message })
      }
    }).catch((error: unknown) => {
      if (lyricsRequest.current !== requestId) return
      setLyricsState({ status: 'error', message: error instanceof Error ? error.message : 'Falha ao buscar a letra.' })
    })
    return () => {
      if (lyricsRequest.current === requestId) lyricsRequest.current++
    }
  }, [tab, track?.id, retry])

  const timedLyrics = useMemo(
    () => lyricsState.status === 'ready' && lyricsState.lyrics.syncedLyrics
      ? syncedLines(lyricsState.lyrics.syncedLyrics)
      : [],
    [lyricsState]
  )
  const activeLyric = timedLyrics.reduce((index, line, i) => line.time <= position ? i : index, -1)

  useEffect(() => {
    const container = lyricsContainer.current
    const line = activeLyricElement.current
    if (tab !== 'lyrics' || activeLyric < 0 || !container || !line) return

    const containerTop = container.getBoundingClientRect().top
    const lineTop = line.getBoundingClientRect().top
    const top = container.scrollTop + lineTop - containerTop - (container.clientHeight - line.offsetHeight) / 2
    container.scrollTo({
      top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    })
  }, [activeLyric, tab, lyricsState.status])

  const tabs: [PanelTab, string][] = [['cover', 'Capa'], ['queue', 'Fila'], ['lyrics', 'Letra'], ['info', 'Info']]

  return (
    <aside className="np" aria-label="Painel da música atual">
      <div className="np-inner">
        <div className="np-title">Tocando agora</div>
        {isYouTube && <div className="yt-player-frame" aria-label="Player oficial do YouTube"><div ref={youtubeStage} className="yt-stage" /></div>}
        <div className="np-tabs" role="tablist" aria-label="Conteúdo do painel">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              id={`now-tab-${id}`}
              className={tab === id ? 'active' : ''}
              role="tab"
              aria-selected={tab === id}
              aria-controls="now-panel-content"
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div ref={tab === 'lyrics' ? lyricsContainer : undefined} id="now-panel-content" className="np-tab-content" role="tabpanel" aria-labelledby={`now-tab-${tab}`}>
          {!track ? <p className="np-empty">Escolha uma faixa para começar.</p> : <>
            {tab === 'cover' && <>
              {isYouTube
                ? <p className="np-empty">Vídeo reproduzido pelo player oficial do YouTube.</p>
                : <div className="np-media">
                    {track.cover ? <img src={track.cover} alt={`Capa de ${track.album || track.title}`} /> : <div className="np-ph"><Icon name="music" size={64} /></div>}
                  </div>}
              <div className="np-info">
                <div className="np-text">
                  <div className="np-track">{track.title}</div>
                  <div className="np-artist">{track.artist || 'Artista desconhecido'}</div>
                </div>
                <button
                  className={'icon-btn' + (liked ? ' on' : '')}
                  title={liked ? 'Remover das músicas salvas' : 'Salvar'}
                  aria-label={liked ? 'Remover das músicas salvas' : 'Salvar nas músicas salvas'}
                  onClick={() => useLibrary.getState().toggleLike(track)}
                >
                  <Icon name="heart" size={22} outline={!liked} />
                </button>
              </div>
              {track.album && <div className="np-album">{track.album}</div>}
            </>}
            {tab === 'queue' && (
              queue.length
                ? <div className="np-queue">{queue.map((item, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      className={'np-queue-track' + (index === currentIndex ? ' current' : '')}
                      aria-current={index === currentIndex ? 'true' : undefined}
                      onClick={() => usePlayer.getState().playQueue(queue, index)}
                    >
                      {item.cover ? <img src={item.cover} alt="" /> : <span className="np-queue-cover"><Icon name="music" size={18} /></span>}
                      <span className="np-queue-text"><strong>{item.title}</strong><small>{item.artist || 'Artista desconhecido'}{index === currentIndex ? ' · Tocando agora' : ''}</small></span>
                    </button>
                  ))}</div>
                : <p className="np-empty">A fila está vazia.</p>
            )}
            {tab === 'lyrics' && (
              <div className="np-lyrics">
                {lyricsState.status === 'loading' && <p className="np-empty" role="status">Buscando letra no LRCLIB…</p>}
                {lyricsState.status === 'missing' && <p className="np-empty">Nenhuma letra encontrada para esta faixa.</p>}
                {lyricsState.status === 'rate-limited' && <div className="np-lyrics-error" role="status">
                  <p>O LRCLIB limitou temporariamente as consultas. Aguarde cerca de {Math.ceil(lyricsState.retryAfterMs / 1000)} segundos antes de tentar novamente.</p>
                  <button onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button>
                </div>}
                {lyricsState.status === 'error' && <div className="np-lyrics-error" role="alert"><p>Não foi possível buscar a letra: {lyricsState.message}</p><button onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div>}
                {lyricsState.status === 'ready' && timedLyrics.length > 0
                  ? <div className="np-lyrics-timed" aria-label="Letra sincronizada">
                      {timedLyrics.map((line, index) => (
                        <button
                          ref={index === activeLyric ? activeLyricElement : undefined}
                          className={'np-lyric-line' + (index === activeLyric ? ' active' : index < activeLyric ? ' past' : ' upcoming')}
                          key={`${line.time}-${index}`}
                          aria-current={index === activeLyric ? 'true' : undefined}
                          aria-label={`Ir para ${fmtTime(line.time)}: ${line.text}`}
                          title={`Ir para ${fmtTime(line.time)}`}
                          onClick={() => usePlayer.getState().seek(line.time)}
                        >
                          {line.text}
                        </button>
                      ))}
                    </div>
                  : lyricsState.status === 'ready' && (lyricsState.lyrics.plainLyrics || lyricsState.lyrics.syncedLyrics)
                    ? <p className="np-plain-lyrics">{lyricsState.lyrics.plainLyrics || lyricsState.lyrics.syncedLyrics}</p>
                    : null}
                <small className="np-lyrics-credit">Letras consultadas sob demanda no LRCLIB.</small>
              </div>
            )}
            {tab === 'info' && (
              <dl className="np-details">
                <div><dt>Título</dt><dd>{track.title}</dd></div>
                <div><dt>Artista / autor</dt><dd>{track.artist || 'Não informado'}</dd></div>
                <div><dt>Álbum / livro</dt><dd>{track.album || 'Não informado'}</dd></div>
                <div><dt>Fonte</dt><dd>{sourceNames[track.source] || track.source}</dd></div>
                <div><dt>Duração</dt><dd>{track.duration && track.duration > 0 ? fmtTime(track.duration) : 'Não informada'}</dd></div>
                <div><dt>Licença</dt><dd>{track.license || 'Não informada pela fonte'}</dd></div>
              </dl>
            )}
          </>}
        </div>
      </div>
    </aside>
  )
}
