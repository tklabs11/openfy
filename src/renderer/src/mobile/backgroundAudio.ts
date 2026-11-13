import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { Track } from '@shared/types'
import { usePlayer } from '../player'

interface PlaybackUpdate {
  title: string
  artist: string
  album: string
  artwork: string
  playing: boolean
  duration: number
  position: number
}

interface BackgroundAudioPlugin {
  start(): Promise<void>
  update(payload: PlaybackUpdate): Promise<void>
  stop(): Promise<void>
  isPipSupported(): Promise<{ supported: boolean }>
  setVideoPlaying(payload: { playing: boolean }): Promise<void>
  enterPictureInPicture(): Promise<{ supported: boolean }>
  addListener(event: 'command', listener: (data: { command: string }) => void): Promise<PluginListenerHandle>
  addListener(event: 'pip', listener: (data: { inPip: boolean }) => void): Promise<PluginListenerHandle>
}

const BackgroundAudio = registerPlugin<BackgroundAudioPlugin>('BackgroundAudio')

const POSITION_INTERVAL_MS = 1000
const AUTO_WINDOW_KEY = 'openfy-auto-video-window'

/** Janela flutuante automática ao sair do app (pode ser ligada nas configurações). */
export function autoVideoWindowEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_WINDOW_KEY) === '1'
  } catch {
    return false
  }
}

export function setAutoVideoWindowEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_WINDOW_KEY, enabled ? '1' : '0')
  } catch {
    // Armazenamento indisponível: mantém o padrão.
  }
}

/** Janela flutuante (PiP) é o que mantém o vídeo do YouTube tocando fora do app. */
export async function videoWindowSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    return (await BackgroundAudio.isPipSupported()).supported
  } catch {
    return false
  }
}

/** Abre o player em janela flutuante; devolve false quando o aparelho não suporta. */
export async function openVideoWindow(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    return (await BackgroundAudio.enterPictureInPicture()).supported
  } catch {
    return false
  }
}

/** Avisa a interface quando o app entra ou sai da janela flutuante. */
export function onVideoWindowChange(callback: (inWindow: boolean) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}
  const handle = BackgroundAudio.addListener('pip', ({ inPip }) => callback(inPip))
  return () => {
    void handle.then((listener) => listener.remove()).catch(() => {})
  }
}

/**
 * Mantém o serviço de reprodução nativo ativo e sincroniza a faixa atual com a
 * MediaSession do Android (tela de bloqueio, fones e painel de mídia).
 */
export function syncBackgroundAudio(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  let serviceRunning = false
  let lastKey = ''
  let lastSentAt = 0
  let videoPlaying = false

  const startService = (): void => {
    if (serviceRunning) return
    serviceRunning = true
    void BackgroundAudio.start().catch((error: unknown) => {
      serviceRunning = false
      console.warn('[Openfy] Não foi possível iniciar o serviço de reprodução:', error)
    })
  }

  const stopService = (): void => {
    if (!serviceRunning) return
    serviceRunning = false
    void BackgroundAudio.stop().catch(() => {})
  }

  const apply = (): void => {
    const state = usePlayer.getState()
    const track: Track | undefined = state.queue[state.index]

    if (!track) {
      stopService()
      lastKey = ''
      if (videoPlaying) {
        videoPlaying = false
        void BackgroundAudio.setVideoPlaying({ playing: false }).catch(() => {})
      }
      return
    }

    startService()

    // Só vídeo em reprodução justifica a janela flutuante ao sair do app; com a
    // opção desligada o player pausa como qualquer vídeo em segundo plano.
    const nextVideoPlaying = state.playing && track.source === 'youtube' && autoVideoWindowEnabled()
    if (nextVideoPlaying !== videoPlaying) {
      videoPlaying = nextVideoPlaying
      void BackgroundAudio.setVideoPlaying({ playing: videoPlaying }).catch(() => {})
    }

    const key = [track.id, state.playing ? '1' : '0', track.title, track.artist, track.cover ?? ''].join('|')
    const now = Date.now()
    if (key === lastKey && now - lastSentAt < POSITION_INTERVAL_MS) return

    void BackgroundAudio.update({
      title: track.title,
      artist: track.artist || 'Artista desconhecido',
      album: track.album ?? '',
      artwork: track.cover ?? '',
      playing: state.playing,
      duration: state.duration,
      position: state.position
    })
      .then(() => {
        // Só marca como enviado depois da confirmação nativa: a primeira
        // chamada pode chegar antes de o serviço existir.
        lastKey = key
        lastSentAt = now
      })
      .catch((error: unknown) => {
        console.warn('[Openfy] Não foi possível atualizar os controles de mídia:', error)
      })
  }

  const unsubscribe = usePlayer.subscribe(apply)
  apply()

  const listener = BackgroundAudio.addListener('command', ({ command }) => {
    const player = usePlayer.getState()
    if (command === 'play') {
      if (!player.playing) player.toggle()
    } else if (command === 'pause') {
      if (player.playing) player.toggle()
    } else if (command === 'next') {
      player.next()
    } else if (command === 'prev') {
      player.prev()
    } else if (command.startsWith('seek:')) {
      const seconds = Number(command.slice(5))
      if (Number.isFinite(seconds)) player.seek(seconds)
    }
  })

  return () => {
    unsubscribe()
    void listener.then((handle) => handle.remove()).catch(() => {})
    stopService()
  }
}
