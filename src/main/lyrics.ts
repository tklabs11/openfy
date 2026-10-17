import { net } from 'electron'
import type { LyricsSearchResult } from '../shared/types'
import { mapLyricsResponse } from './lyrics-mapper'

const API = 'https://lrclib.net/api/get'
const REQUEST_INTERVAL_MS = 1_000
const CACHE_LIMIT = 100

const cache = new Map<string, LyricsSearchResult>()
const inFlight = new Map<string, Promise<LyricsSearchResult>>()
let nextRequestAt = 0
let rateLimitedUntil = 0

function remember(key: string, result: LyricsSearchResult): void {
  cache.set(key, result)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
}

function rateLimitedResult(now: number): LyricsSearchResult {
  return { status: 'rate-limited', retryAfterMs: Math.max(1_000, rateLimitedUntil - now) }
}

export function getLyrics(title: string, artist: string, duration?: number): Promise<LyricsSearchResult> {
  const params = new URLSearchParams({ track_name: title, artist_name: artist })
  if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
    params.set('duration', String(Math.round(duration)))
  }
  const key = `${title.trim().toLocaleLowerCase()}|${artist.trim().toLocaleLowerCase()}|${params.get('duration') ?? ''}`
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = inFlight.get(key)
  if (pending) return pending

  const now = Date.now()
  if (now < rateLimitedUntil || now < nextRequestAt) {
    return Promise.resolve(rateLimitedResult(now))
  }
  nextRequestAt = now + REQUEST_INTERVAL_MS

  const request = (async (): Promise<LyricsSearchResult> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await net.fetch(`${API}?${params}`, { signal: controller.signal })
      const result = await mapLyricsResponse(response)
      if (result.status === 'rate-limited') {
        rateLimitedUntil = Date.now() + result.retryAfterMs
      } else {
        remember(key, result)
      }
      return result
    } catch (error) {
      console.error('Falha ao consultar letras no LRCLIB:', error)
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro inesperado ao consultar LRCLIB.'
      }
    } finally {
      clearTimeout(timeout)
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, request)
  return request
}
