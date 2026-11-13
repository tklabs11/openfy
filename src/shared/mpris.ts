export interface MprisPlayback {
  playing: boolean
  title: string
  artist: string
  duration: number
  position: number
}

export type MprisPlaybackStatus = 'Playing' | 'Paused' | 'Stopped'

export const mprisPlaybackStatus = (playing: boolean): MprisPlaybackStatus => (playing ? 'Playing' : 'Paused')

/** Converte segundos em microssegundos, como o MPRIS exige. */
export const mprisMicroseconds = (seconds: number): number =>
  Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1_000_000) : 0

export function mprisMetadata(playback: MprisPlayback, trackId: string): Record<string, unknown> {
  const length = mprisMicroseconds(playback.duration)
  return {
    'mpris:trackid': trackId,
    'xesam:title': playback.title || 'Openfy',
    'xesam:artist': playback.artist ? [playback.artist] : [],
    ...(length ? { 'mpris:length': length } : {})
  }
}
