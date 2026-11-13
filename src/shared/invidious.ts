import type { Track } from './types'

const VIDEO_ID = /^[\w-]{11}$/
const INSTANCE_ORIGIN = /^https:\/\/[^\s/?#]+$/i
const THUMB_ORDER = ['maxresdefault', 'maxres', 'sddefault', 'high', 'medium', 'default']

export type JsonFetcher = (url: string) => Promise<unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Lê a lista de api.invidious.io e mantém só instâncias HTTPS com a API ligada. */
export function parseInvidiousInstances(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  for (const entry of data) {
    const info = Array.isArray(entry) ? entry[1] : undefined
    if (!isRecord(info) || info.type !== 'https' || info.api !== true) continue
    if (isRecord(info.monitor) && info.monitor.down === true) continue
    const uri = typeof info.uri === 'string' ? info.uri.replace(/\/+$/, '') : ''
    if (!INSTANCE_ORIGIN.test(uri)) continue
    seen.add(uri)
  }
  return [...seen]
}

function absoluteThumbnail(url: unknown, base: string): string | null {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const parsed = new URL(url, base)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return null
  }
}

function thumbnailOf(item: Record<string, unknown>, base: string): string | null {
  const list = Array.isArray(item.videoThumbnails) ? item.videoThumbnails : []
  for (const quality of THUMB_ORDER) {
    const match = list.find((thumb) => isRecord(thumb) && thumb.quality === quality)
    if (match && isRecord(match)) {
      const url = absoluteThumbnail(match.url, base)
      if (url) return url
    }
  }
  for (const thumb of list) {
    if (isRecord(thumb)) {
      const url = absoluteThumbnail(thumb.url, base)
      if (url) return url
    }
  }
  return null
}

/** Converte a resposta de /api/v1/search em faixas. Vídeos ao vivo e estreias ficam de fora. */
export function mapInvidious(data: unknown, base = 'https://i.ytimg.com'): Track[] {
  if (!Array.isArray(data)) return []
  const tracks: Track[] = []
  for (const item of data) {
    if (!isRecord(item) || item.type !== 'video') continue
    const id = item.videoId
    if (typeof id !== 'string' || !VIDEO_ID.test(id)) continue
    if (item.liveNow === true || item.isUpcoming === true) continue
    const title = typeof item.title === 'string' && item.title.trim() ? item.title : 'Sem título'
    const author = typeof item.author === 'string' ? item.author : ''
    const duration = typeof item.lengthSeconds === 'number' && Number.isFinite(item.lengthSeconds) && item.lengthSeconds > 0
      ? Math.round(item.lengthSeconds)
      : undefined
    tracks.push({
      id: `yt:${id}`,
      title,
      artist: author.replace(/ - Topic$/i, ''),
      cover: thumbnailOf(item, base) ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      source: 'youtube',
      uri: `https://www.youtube.com/watch?v=${id}`,
      ...(duration ? { duration } : {})
    })
  }
  return tracks
}

export interface InvidiousSearch {
  tracks: Track[]
  instance: string
}

/**
 * Escolhe o melhor stream só de áudio da resposta de /api/v1/videos.
 * AAC (mp4a) vem antes de Opus porque o WebView do Android lida melhor com ele.
 */
export function audioStreamOf(data: unknown): { url: string; duration: number } | null {
  if (!isRecord(data)) return null
  const formats = Array.isArray(data.adaptiveFormats) ? data.adaptiveFormats : []
  let best: { url: string; bitrate: number; rank: number } | null = null
  for (const format of formats) {
    if (!isRecord(format)) continue
    const type = typeof format.type === 'string' ? format.type : ''
    if (!type.startsWith('audio/')) continue
    const url = typeof format.url === 'string' ? format.url : ''
    if (!url.startsWith('https://')) continue
    const rank = type.includes('mp4a') ? 2 : type.includes('opus') ? 1 : 0
    const bitrate = typeof format.bitrate === 'number' && Number.isFinite(format.bitrate) ? format.bitrate : 0
    if (!best || rank > best.rank || (rank === best.rank && bitrate > best.bitrate)) best = { url, bitrate, rank }
  }
  if (!best) return null
  const seconds = typeof data.lengthSeconds === 'number' ? data.lengthSeconds : 0
  const duration = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0
  return { url: best.url, duration }
}

export function searchUrl(instance: string, query: string, page: number): string {
  const params = new URLSearchParams({
    q: query,
    type: 'video',
    page: String(page),
    sort_by: 'relevance'
  })
  return `${instance}/api/v1/search?${params.toString()}`
}

/**
 * Tenta as instâncias em ordem até uma responder com a lista de vídeos.
 * Instância fora do ar, lenta ou limitando acesso não derruba a busca: só passa para a próxima.
 */
export async function searchInvidiousInstances(
  instances: string[],
  fetchJson: JsonFetcher,
  query: string,
  page: number,
  maxAttempts = 4,
  budgetMs = 12_000
): Promise<InvidiousSearch> {
  let attempts = 0
  let lastFailure = ''
  const start = Date.now()
  for (const instance of instances) {
    if (attempts >= maxAttempts || Date.now() - start > budgetMs) break
    attempts++
    try {
      const data = await fetchJson(searchUrl(instance, query, page))
      if (!Array.isArray(data)) {
        const message = isRecord(data) && typeof data.error === 'string' ? data.error : 'resposta inesperada'
        throw new Error(message)
      }
      return { tracks: mapInvidious(data, instance), instance }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error)
    }
  }
  const detail = lastFailure ? ` Último erro: ${lastFailure}` : ''
  throw new Error(`Nenhuma instância pública do Invidious respondeu.${detail}`)
}
