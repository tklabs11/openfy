import type { LyricsSearchResult, TrackLyrics } from '../shared/types'

const DEFAULT_RETRY_AFTER_MS = 60_000
const MAX_RETRY_AFTER_MS = 60 * 60 * 1_000

function retryAfterMs(header: string | null, now: number): number {
  if (!header) return DEFAULT_RETRY_AFTER_MS
  const seconds = Number(header)
  const retryAt = Number.isFinite(seconds) && seconds >= 0
    ? now + seconds * 1_000
    : Date.parse(header)
  if (!Number.isFinite(retryAt)) return DEFAULT_RETRY_AFTER_MS
  return Math.max(1_000, Math.min(retryAt - now, MAX_RETRY_AFTER_MS))
}

export function mapTrackLyrics(value: unknown): TrackLyrics | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const response = value as Record<string, unknown>
  const plainLyrics = typeof response.plainLyrics === 'string' ? response.plainLyrics.trim() : ''
  const syncedLyrics = typeof response.syncedLyrics === 'string' ? response.syncedLyrics.trim() : ''
  if (!plainLyrics && !syncedLyrics) return null
  return {
    ...(plainLyrics ? { plainLyrics: plainLyrics.slice(0, 100_000) } : {}),
    ...(syncedLyrics ? { syncedLyrics: syncedLyrics.slice(0, 100_000) } : {})
  }
}

export async function mapLyricsResponse(response: Response, now = Date.now()): Promise<LyricsSearchResult> {
  if (response.status === 404) return { status: 'not-found' }
  if (response.status === 429) {
    return { status: 'rate-limited', retryAfterMs: retryAfterMs(response.headers.get('retry-after'), now) }
  }
  if (!response.ok) throw new Error(`LRCLIB respondeu com HTTP ${response.status}.`)

  const lyrics = mapTrackLyrics(await response.json())
  return lyrics ? { status: 'found', lyrics } : { status: 'not-found' }
}
