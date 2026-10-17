import type { Track } from './types'

export function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, digits: string) => String.fromCodePoint(Math.min(0x10ffff, Number(digits))))
    .replace(/&#x([0-9a-f]+);/gi, (_match, digits: string) => String.fromCodePoint(Math.min(0x10ffff, parseInt(digits, 16))))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const VIDEO_ID = /^[\w-]{11}$/

export function videoIdFromUri(uri: string): string | null {
  if (VIDEO_ID.test(uri)) return uri
  try {
    const url = new URL(uri)
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? ''
    return VIDEO_ID.test(id) ? id : null
  } catch {
    return null
  }
}

export const isKeyShape = (key: string): boolean => /^[A-Za-z0-9_-]{30,60}$/.test(key)

export function mapYouTube(data: unknown): Track[] {
  if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) return []
  const tracks: Track[] = []
  for (const item of data.items) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as {
      id?: { videoId?: unknown }
      snippet?: {
        title?: unknown
        channelTitle?: unknown
        liveBroadcastContent?: unknown
        thumbnails?: { high?: { url?: unknown }; medium?: { url?: unknown }; default?: { url?: unknown } }
      }
    }
    const id = candidate.id?.videoId
    const snippet = candidate.snippet
    if (typeof id !== 'string' || !VIDEO_ID.test(id) || !snippet) continue
    if (snippet.liveBroadcastContent && snippet.liveBroadcastContent !== 'none') continue
    const thumb = snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url
    const title = typeof snippet.title === 'string' ? snippet.title : 'Sem título'
    const channel = typeof snippet.channelTitle === 'string' ? snippet.channelTitle : ''
    tracks.push({
      id: `yt:${id}`,
      title: decodeEntities(title),
      artist: decodeEntities(channel).replace(/ - Topic$/i, ''),
      ...(typeof thumb === 'string' ? { cover: thumb.replace(/^http:\/\//, 'https://') } : {}),
      source: 'youtube',
      uri: `https://www.youtube.com/watch?v=${id}`
    })
  }
  return tracks
}

export function youtubeErrorMessage(status: number, body: unknown): string {
  const error = body && typeof body === 'object' && 'error' in body
    ? (body as { error?: { errors?: unknown[]; details?: unknown[]; status?: unknown; message?: unknown } }).error
    : undefined
  const reasons = [
    ...(Array.isArray(error?.errors) ? error.errors.map((item) => item && typeof item === 'object' && 'reason' in item ? String(item.reason) : '') : []),
    ...(Array.isArray(error?.details) ? error.details.map((item) => item && typeof item === 'object' && 'reason' in item ? String(item.reason) : '') : []),
    String(error?.status ?? ''),
    String(error?.message ?? '')
  ].map((reason) => reason.toLowerCase())
  const has = (...needles: string[]): boolean => reasons.some((reason) => needles.some((needle) => reason.includes(needle)))

  if (has('quotaexceeded', 'dailylimitexceeded')) return 'A cota diária da sua chave do YouTube acabou. A cota costuma renovar à meia-noite no horário do Pacífico.'
  if (has('ratelimitexceeded', 'userratelimit')) return 'Muitas buscas seguidas no YouTube. Tente novamente em instantes.'
  if (has('referer', 'referrer', 'ip_address', 'ipreferrerblocked')) return 'A chave tem restrição de site ou IP que bloqueia o Openfy. Restrinja a chave à YouTube Data API v3.'
  if (has('accessnotconfigured', 'service_disabled', 'has not been used', 'is disabled')) return 'A YouTube Data API v3 não está ativada no projeto dessa chave.'
  if (has('keyinvalid', 'api_key_invalid', 'api key not valid')) return 'Chave de API inválida.'
  return `Erro do YouTube (HTTP ${status}).`
}
