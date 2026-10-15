import type { Track } from '../../shared/types'
import { JAMENDO_CLIENT_ID } from '../../shared/config'
import { searchAudius, trendingAudius } from './audius'
import { searchJamendo } from './jamendo'
import { searchArchive } from './archive'
import { searchOpenverse } from './openverse'

const jamendoId = (): string => (process.env['OPENFY_JAMENDO_CLIENT_ID'] || JAMENDO_CLIENT_ID).trim()

/** Intercala as listas (1º de cada fonte, 2º de cada fonte...) e remove duplicatas. */
export function mix(lists: Track[][]): Track[] {
  const out: Track[] = []
  const seen = new Set<string>()
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      const t = l[i]
      if (!t) continue
      const key = `${t.title}|${t.artist}`.toLowerCase().replace(/\s+/g, ' ').trim()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(t)
    }
  }
  return out
}

/** Junta os resultados. Só falha se TODAS as fontes ativas falharem. */
async function gather(jobs: Promise<Track[]>[]): Promise<Track[][]> {
  const res = await Promise.allSettled(jobs)
  if (res.length && res.every((r) => r.status === 'rejected')) throw new Error('Sem conexão com as fontes de música.')
  return res.map((r) => (r.status === 'fulfilled' ? r.value : []))
}

// Ordem = prioridade na mistura: Audius, Jamendo, Openverse, Internet Archive.
export async function search(q: string): Promise<Track[]> {
  const id = jamendoId()
  const jobs = [searchAudius(q)]
  if (id) jobs.push(searchJamendo(q, id))
  jobs.push(searchOpenverse(q), searchArchive(q))
  return mix(await gather(jobs))
}

export async function featured(): Promise<Track[]> {
  const id = jamendoId()
  const jobs = [trendingAudius()]
  if (id) jobs.push(searchJamendo('', id, { order: 'popularity_week', limit: '20' }))
  return mix(await gather(jobs)).slice(0, 24)
}
