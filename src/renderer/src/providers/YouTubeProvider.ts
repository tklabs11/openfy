import type { Track } from '@shared/types'
import { videoIdFromUri } from '@shared/youtube'
import type { PlayerProvider } from './types'

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer
      PlayerState: { ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YouTubePlayer {
  cueVideoById(id: string): void
  destroy(): void
  getCurrentTime(): number
  getDuration(): number
  getIframe(): HTMLIFrameElement
  pauseVideo(): void
  playVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setVolume(volume: number): void
}

interface YouTubeEvent {
  data: number
}

let apiPromise: Promise<void> | null = null

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise<void>((resolve, reject) => {
    const fail = (): void => {
      apiPromise = null
      reject(new Error('Não foi possível carregar o player do YouTube. Verifique a conexão.'))
    }
    const timeout = window.setTimeout(fail, 12_000)
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout)
      previous?.()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      window.clearTimeout(timeout)
      fail()
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

const PLAYER_ERRORS: Record<number, string> = {
  2: 'Vídeo inválido do YouTube.',
  5: 'O player do YouTube falhou.',
  100: 'Vídeo indisponível ou privado.',
  101: 'O dono do vídeo não permite reproduzi-lo incorporado.',
  150: 'O dono do vídeo não permite reproduzi-lo incorporado.',
  153: 'O YouTube recusou a origem do app (erro 153).'
}

/** Reproduz pelo player oficial, que fica visível no painel Tocando agora. */
export class YouTubeProvider implements PlayerProvider {
  private player: YouTubePlayer | null = null
  private container: HTMLElement | null = null
  private volume = 80
  private endCallback: () => void = () => {}
  private errorCallback: (message: string) => void = () => {}

  attach(container: HTMLElement | null): void {
    this.container = container
    const frame = this.player?.getIframe?.()
    if (container && frame && frame.parentElement !== container) container.appendChild(frame)
  }

  private async waitForContainer(): Promise<HTMLElement> {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (this.container?.isConnected) return this.container
      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }
    throw new Error('Abra o painel "Tocando agora" para reproduzir vídeos do YouTube.')
  }

  async load(track: Track): Promise<void> {
    const id = videoIdFromUri(track.uri)
    if (!id) throw new Error('Vídeo do YouTube inválido.')
    await loadApi()
    const host = await this.waitForContainer()
    if (this.player && !this.player.getIframe?.()?.isConnected) this.destroy()
    if (this.player) {
      this.player.cueVideoById(id)
      return
    }
    await new Promise<void>((resolve, reject) => {
      const mount = document.createElement('div')
      host.appendChild(mount)
      this.player = new window.YT!.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: id,
        playerVars: { playsinline: 1, rel: 0, enablejsapi: 1 },
        events: {
          onReady: () => {
            this.player?.setVolume(this.volume)
            resolve()
          },
          onStateChange: (event: YouTubeEvent) => {
            if (event.data === window.YT?.PlayerState.ENDED) this.endCallback()
          },
          onError: (event: YouTubeEvent) => {
            const message = PLAYER_ERRORS[event.data] ?? 'Erro do player do YouTube.'
            this.errorCallback(message)
            reject(new Error(message))
          }
        }
      })
    })
  }

  play(): void { this.player?.playVideo() }
  pause(): void { this.player?.pauseVideo() }
  seek(seconds: number): void { this.player?.seekTo(seconds, true) }
  setVolume(volume: number): void {
    this.volume = Math.round(Math.min(1, Math.max(0, volume)) * 100)
    this.player?.setVolume(this.volume)
  }
  getPosition(): number { return Number(this.player?.getCurrentTime()) || 0 }
  getDuration(): number { return Number(this.player?.getDuration()) || 0 }
  onEnd(callback: () => void): void { this.endCallback = callback }
  onError(callback: (message: string) => void): void { this.errorCallback = callback }
  setEqualizer(_gains: number[]): void {}
  destroy(): void {
    this.player?.destroy()
    this.player = null
  }
}
