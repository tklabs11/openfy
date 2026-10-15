/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Track } from '../../shared/types'
import { getJson } from './http'

const BASE = 'https://api.audius.co'
const APP = 'Openfy'

export function mapAudius(d: any): Track[] {
  return (Array.isArray(d?.data) ? d.data : [])
    .filter((t: any) => t?.id && t.is_streamable !== false && !t.is_delete)
    .map(
      (t: any): Track => ({
        id: 'au:' + t.id,
        title: String(t.title ?? 'Sem título'),
        artist: String(t.user?.name ?? ''),
        cover: t.artwork?.['480x480'] ?? t.artwork?.['150x150'],
        source: 'audius',
        uri: `${BASE}/v1/tracks/${t.id}/stream?app_name=${APP}`,
        duration: typeof t.duration === 'number' ? t.duration : undefined
      })
    )
}

const url = (path: string, params: Record<string, string>): string =>
  `${BASE}${path}?${new URLSearchParams({ app_name: APP, ...params })}`

export const searchAudius = async (q: string): Promise<Track[]> =>
  mapAudius(await getJson(url('/v1/tracks/search', { query: q, limit: '15' })))

export const trendingAudius = async (): Promise<Track[]> =>
  mapAudius(await getJson(url('/v1/tracks/trending', { limit: '20' })))
