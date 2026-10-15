import type { Track } from '@shared/types'

export interface PlayerProvider {
  load(track: Track): Promise<void>
  play(): void
  pause(): void
  seek(seconds: number): void
  setVolume(volume: number): void
  getPosition(): number
  getDuration(): number
  onEnd(cb: () => void): void
  onError(cb: (message: string) => void): void
  destroy(): void
}
