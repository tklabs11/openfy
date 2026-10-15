import type { Track } from '@shared/types'
import type { PlayerProvider } from './types'

/** Separate audio elements prevent cross-origin streams from being routed through Web Audio. */
export class HtmlAudioProvider implements PlayerProvider {
  private localAudio = new Audio()
  private remoteAudio = new Audio()
  private audio = this.remoteAudio
  private context: AudioContext | null = null
  private filters: BiquadFilterNode[] = []
  private gains = Array(10).fill(0) as number[]
  private analyser: AnalyserNode | null = null
  private errCb: (message: string) => void = () => {}
  private endCb: () => void = () => {}

  constructor() {
    for (const element of [this.localAudio, this.remoteAudio]) {
      element.preload = 'auto'
      element.addEventListener('error', () => {
        if (element === this.audio) this.errCb('Falha ao reproduzir o áudio.')
      })
      element.addEventListener('ended', () => {
        if (element === this.audio) this.endCb()
      })
    }
  }

  load(track: Track): Promise<void> {
    const next = track.source === 'local' ? this.localAudio : this.remoteAudio
    this.audio.pause()
    if (next !== this.audio) {
      this.audio.removeAttribute('src')
      this.audio.load()
    }
    this.audio = next
    return new Promise<void>((resolve, reject) => {
      const element = this.audio
      const cleanup = (): void => {
        element.removeEventListener('loadedmetadata', ok)
        element.removeEventListener('error', bad)
      }
      const ok = (): void => { cleanup(); resolve() }
      const bad = (): void => { cleanup(); reject(new Error('Não foi possível carregar o áudio.')) }
      element.addEventListener('loadedmetadata', ok)
      element.addEventListener('error', bad)
      element.src = track.uri
      element.load()
    })
  }

  private initEffects(): void {
    if (this.context) return
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(this.localAudio)
      const freqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
      const filters = freqs.map((freq, i) => {
        const node = ctx.createBiquadFilter()
        node.type = i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking'
        node.frequency.value = freq
        node.Q.value = 1.1
        node.gain.value = this.gains[i]
        return node
      })
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(filters[0])
      for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1])
      filters[filters.length - 1].connect(analyser)
      analyser.connect(ctx.destination)
      this.context = ctx
      this.filters = filters
      this.analyser = analyser
    } catch (error) { console.warn('Audio effects unavailable', error) }
  }

  setEqualizer(gains: number[]): void {
    this.gains = Array.from({ length: 10 }, (_, i) => Math.max(-12, Math.min(12, Number(gains[i]) || 0)))
    this.filters.forEach((filter, i) => { filter.gain.value = this.gains[i] })
  }
  getSpectrum(): number[] {
    if (this.audio !== this.localAudio || !this.analyser) return Array(40).fill(0)
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return Array.from({ length: 40 }, (_, i) => data[Math.floor(i * data.length / 40)] / 255)
  }
  play(): void {
    if (this.audio === this.localAudio) {
      this.initEffects()
      if (this.context?.state === 'suspended') void this.context.resume()
    }
    void this.audio.play().catch(error => this.errCb(`Falha ao iniciar reprodução: ${String(error)}`))
  }
  pause(): void { this.audio.pause() }
  seek(seconds: number): void { this.audio.currentTime = seconds }
  setVolume(volume: number): void { this.localAudio.volume = this.remoteAudio.volume = Math.min(1, Math.max(0, volume)) }
  getPosition(): number { return this.audio.currentTime || 0 }
  getDuration(): number { return Number.isFinite(this.audio.duration) ? this.audio.duration : 0 }
  onEnd(cb: () => void): void { this.endCb = cb }
  onError(cb: (message: string) => void): void { this.errCb = cb }
  destroy(): void {
    for (const element of [this.localAudio, this.remoteAudio]) {
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
    if (this.context) void this.context.close()
  }
}
