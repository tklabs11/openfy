import type { Track } from '@shared/types'

export interface TasteEvent { track: Track; completed: boolean; at: number }
const KEY = 'openfy-taste-v1'
const OPT = 'openfy-taste-enabled'
export const tasteEnabled = (): boolean => localStorage.getItem(OPT) !== 'false'
export const setTasteEnabled = (enabled: boolean): void => { localStorage.setItem(OPT, String(enabled)); window.dispatchEvent(new Event('openfy-taste-change')) }
export function getTaste(): TasteEvent[] {
  try { const items = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(items) ? items.filter((e: TasteEvent) => e?.track?.id && typeof e.at === 'number').slice(0, 300) : [] } catch { return [] }
}
export function clearTaste(): void { localStorage.removeItem(KEY); window.dispatchEvent(new Event('openfy-taste-change')) }
export function recordTaste(track: Track, completed = false): void {
  if (!tasteEnabled()) return
  const events = getTaste(); events.unshift({track, completed, at: Date.now()})
  try { localStorage.setItem(KEY, JSON.stringify(events.slice(0, 300))) } catch { /* quota exceeded */ }
  window.dispatchEvent(new Event('openfy-taste-change'))
}
export function tasteScores(events: TasteEvent[]): Map<string, number> {
  const scores = new Map<string, number>()
  for (const e of events) {
    const age = Math.max(0, (Date.now() - e.at) / 86400000)
    const weight = (e.completed ? 2 : 0.65) * Math.exp(-age / 60)
    const artist = e.track.artist.toLocaleLowerCase().trim()
    if (artist) scores.set(artist, (scores.get(artist) || 0) + weight)
  }
  return scores
}
export function rankForYou(tracks: Track[], events: TasteEvent[], liked: string[]): Track[] {
  const scores = tasteScores(events)
  const heard = new Set(events.slice(0, 12).map(e => e.track.id))
  return [...tracks].sort((a,b) => {
    const score = (t: Track) => (scores.get(t.artist.toLocaleLowerCase().trim()) || 0) * 3 + (liked.includes(t.id) ? 4 : 0) - (heard.has(t.id) ? 0.8 : 0)
    return score(b) - score(a)
  })
}
