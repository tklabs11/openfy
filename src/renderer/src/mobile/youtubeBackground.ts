import { Capacitor } from '@capacitor/core'
import type { Track } from '@shared/types'
import { videoIdFromUri } from '@shared/youtube'
import { youtubeAudioStream } from '@main/sources/invidious'
import { playYouTubeAsAudio, playYouTubeInForeground, setAudioStreamResolver } from '../player'

/**
 * Android: o player oficial do YouTube pausa quando o app sai da tela. Em vez de
 * abrir uma janela flutuante, a mesma faixa continua pelo stream só de áudio do
 * Invidious — e volta para o vídeo quando o app reaparece.
 */
export function syncYouTubeBackground(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  setAudioStreamResolver(async (track: Track) => {
    const id = videoIdFromUri(track.uri)
    if (!id) return null
    const stream = await youtubeAudioStream(id)
    return stream ? { url: stream.url, duration: stream.duration } : null
  })

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') playYouTubeAsAudio()
    else playYouTubeInForeground()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    setAudioStreamResolver(null)
    playYouTubeInForeground()
  }
}
