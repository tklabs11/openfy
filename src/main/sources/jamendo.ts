/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Track } from '../../shared/types'
import { getJson } from './http'
import { licenseFromUrl } from './licenses'

const BASE = 'https://api.jamendo.com/v3.0/tracks/'
const https = (u: unknown): string | undefined =>
  typeof u === 'string' && u ? u.replace(/^http:\/\//, 'https://') : undefined

export function mapJamendo(d: any): Track[] {
  const out: Track[] = []
  for (const r of Array.isArray(d?.results) ? d.results : []) {
    const uri = https(r?.audio)
    if (!r?.id || !uri) continue
    out.push({
      id: 'jm:' + r.id,
      title: String(r.name ?? 'Sem título'),
      artist: String(r.artist_name ?? ''),
      album: typeof r.album_name === 'string' ? r.album_name : undefined,
      cover: https(r.image),
      source: 'jamendo',
      uri,
      duration: typeof r.duration === 'number' ? r.duration : undefined,
      license: licenseFromUrl(r.license_ccurl)
    })
  }
  return out
}

/** `q` vazio + `extra.order` serve para listar os mais ouvidos. */
export async function searchJamendo(
  q: string,
  clientId: string,
  extra: Record<string, string> = {}
): Promise<Track[]> {
  const p = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '15',
    audioformat: 'mp32',
    ...extra
  })
  if (q) p.set('search', q)
  return mapJamendo(await getJson(BASE + '?' + p))
}
