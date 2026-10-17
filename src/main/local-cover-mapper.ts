export interface ITunesCoverResult {
  trackName?: unknown
  artistName?: unknown
  artworkUrl100?: unknown
}

export function retryAfterMilliseconds(header: string | null, now = Date.now()): number {
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(30 * 60_000, Math.max(1_000, seconds * 1_000))
    const date = Date.parse(header)
    if (Number.isFinite(date)) return Math.min(30 * 60_000, Math.max(1_000, date - now))
  }
  return 60_000
}

const normalizedTokens = (value: string): string[] =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !['the', 'and', 'feat', 'featuring', 'remaster', 'remastered', 'version'].includes(token))

function overlap(query: string[], candidate: string[]): number {
  if (!query.length || !candidate.length) return 0
  const tokens = new Set(candidate)
  return query.filter((token) => tokens.has(token)).length / query.length
}

function artworkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.replace(/\/\d+x\d+bb\./, '/600x600bb.'))
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function matchITunesCover(
  results: unknown,
  title: string,
  artist: string
): string | null {
  if (!Array.isArray(results)) return null
  const titleTokens = normalizedTokens(title)
  const knownArtist = artist.trim() !== '' && !/^artista desconhecido$/i.test(artist.trim())
  const artistTokens = knownArtist ? normalizedTokens(artist) : []
  if (titleTokens.length === 0) return null

  const candidates = results.flatMap((result): { cover: string; score: number }[] => {
    if (!result || typeof result !== 'object') return []
    const item = result as ITunesCoverResult
    if (typeof item.trackName !== 'string' || typeof item.artistName !== 'string') return []
    const titleScore = overlap(titleTokens, normalizedTokens(item.trackName))
    const artistScore = knownArtist ? overlap(artistTokens, normalizedTokens(item.artistName)) : 0
    const minimumTitleScore = titleTokens.length === 1 ? 1 : knownArtist ? 0.6 : 0.85
    if (titleScore < minimumTitleScore || (knownArtist && artistScore < 0.5) || (!knownArtist && titleTokens.length < 2)) return []
    const cover = artworkUrl(item.artworkUrl100)
    return cover ? [{ cover, score: titleScore * 2 + artistScore }] : []
  })
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.cover ?? null
}
