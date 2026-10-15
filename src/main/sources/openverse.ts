/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Track } from '../../shared/types'
import { getJson } from './http'
import { licenseFromCode } from './licenses'

// Openverse: catálogo de mídia com licença aberta (Creative Commons / domínio público).
// Acesso anônimo, sem chave (com limite de uso). Cada resultado já traz a licença.
const BASE = 'https://api.openverse.org/v1/audio/'
const https = (u: unknown): string | undefined =>
  typeof u === 'string' && u ? u.replace(/^http:\/\//, 'https://') : undefined

export function mapOpenverse(d: any): Track[] {
  const out: Track[] = []
  for (const r of Array.isArray(d?.results) ? d.results : []) {
    const uri = https(r?.url)
    if (!r?.id || !uri) continue
    if (r.category && r.category !== 'music') continue // ignora efeitos sonoros, podcasts etc.
    out.push({
      id: 'ov:' + r.id,
      title: String(r.title ?? 'Sem título'),
      artist: String(r.creator ?? ''),
      album: typeof r.audio_set?.title === 'string' ? r.audio_set.title : undefined,
      cover: https(r.thumbnail),
      source: 'openverse',
      uri,
      // a API informa a duração em milissegundos
      duration: typeof r.duration === 'number' && r.duration > 0 ? Math.round(r.duration / 1000) : undefined,
      license: licenseFromCode(r.license, r.license_version)
    })
  }
  return out
}

export async function searchOpenverse(q: string): Promise<Track[]> {
  const base = { q, page_size: '20' }
  try {
    return mapOpenverse(await getJson(BASE + '?' + new URLSearchParams({ ...base, category: 'music' })))
  } catch {
    // Se a API recusar o filtro de categoria, tenta sem ele (mapOpenverse ainda descarta o que não for música).
    return mapOpenverse(await getJson(BASE + '?' + new URLSearchParams(base)))
  }
}
