import { net } from 'electron'
import type { Track } from '../../shared/types'
import { mapYouTube, youtubeErrorMessage } from '../../shared/youtube'

const SEARCH = 'https://www.googleapis.com/youtube/v3/search'
const VIDEOS = 'https://www.googleapis.com/youtube/v3/videos'
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000
const MAX_CACHE_ENTRIES = 100

let lastError: string | null = null
export const youtubeLastError = (): string | null => lastError

const resultCache = new Map<string, { at: number; tracks: Track[] }>()
const nextTokens = new Map<string, string[]>()

async function call(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await net.fetch(url, { signal: controller.signal })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // Preserve the HTTP status message when the server response has no JSON body.
    }
    if (!response.ok) throw new Error(youtubeErrorMessage(response.status, body))
    return body
  } catch (error) {
    if (error instanceof Error && /^(A cota|Muitas buscas|A chave|Chave|A YouTube Data API|Erro do YouTube)/.test(error.message)) throw error
    throw new Error('Não foi possível falar com o YouTube. Verifique sua conexão.')
  } finally {
    clearTimeout(timeout)
  }
}

function trim<K, V>(map: Map<K, V>): void {
  while (map.size > MAX_CACHE_ENTRIES) {
    const oldest = map.keys().next()
    if (oldest.done) break
    map.delete(oldest.value)
  }
}

/** search.list custa 100 unidades da cota diária padrão de 10.000. */
export async function searchYouTube(query: string, key: string, page = 1): Promise<Track[]> {
  const normalized = query.trim().toLowerCase()
  const cacheKey = `${normalized}|${page}`
  const hit = resultCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tracks

  let pageToken: string | undefined
  if (page > 1) {
    pageToken = nextTokens.get(normalized)?.[page - 2]
    if (!pageToken) return []
  }
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    videoEmbeddable: 'true',
    maxResults: '15',
    q: query,
    key
  })
  if (pageToken) params.set('pageToken', pageToken)

  try {
    const data = await call(`${SEARCH}?${params}`)
    lastError = null
    const tokens = nextTokens.get(normalized) ?? []
    if (data && typeof data === 'object' && 'nextPageToken' in data && typeof data.nextPageToken === 'string') {
      tokens[page - 1] = data.nextPageToken
    }
    nextTokens.set(normalized, tokens)
    trim(nextTokens)
    const tracks = mapYouTube(data)
    resultCache.set(cacheKey, { at: Date.now(), tracks })
    trim(resultCache)
    return tracks
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    throw error
  }
}

export async function checkYouTubeKey(key: string): Promise<string | null> {
  try {
    await call(`${VIDEOS}?${new URLSearchParams({ part: 'id', id: 'M7lc1UVf-VE', key })}`)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
