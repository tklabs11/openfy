// Sem imports: testado isoladamente.
// Relevância da busca (usada pelo Archive e também pela mistura final de todas as fontes).
// O Internet Archive só indexa o ÁLBUM (item). O nome de cada música fica nos arquivos do item.
// Por isso a busca acha os itens com os termos "soltos" (OR) e a relevância real é calculada aqui,
// sobre título + artista + álbum de cada faixa.

export interface Rankable {
  title: string
  artist: string
  album?: string
}

/** Minúsculas e sem acentos: "Balão" -> "balao". */
export const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const tokenize = (s: string): string[] => fold(s).split(/[^a-z0-9]+/).filter(Boolean)

/** Palavras de ligação (pt/en/es). Não contam para a pontuação: "do" casaria com quase tudo. */
const STOP = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por', 'pra', 'que',
  'the', 'of', 'and', 'in', 'on', 'to', 'an', 'for', 'with',
  'el', 'la', 'los', 'las', 'del', 'y', 'un', 'una', 'con'
])

/** Termos da busca, sem acento, sem repetição e sem palavras de ligação (a menos que a busca seja só isso). */
export function queryTokens(q: string): string[] {
  const all = [...new Set(tokenize(q))]
  const significant = all.filter((t) => !STOP.has(t))
  return (significant.length ? significant : all).slice(0, 8)
}

const RESERVED = new Set(['and', 'or', 'not', 'to'])

/**
 * Termos para achar os ITENS no Archive. Ignora palavras curtas ("2", "de") para não trazer o site inteiro
 * e palavras reservadas da sintaxe de busca. Inclui a forma com e sem acento.
 */
export function recallTerms(q: string): string[] {
  const words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !RESERVED.has(w) && !STOP.has(fold(w)))
  const long = words.filter((w) => w.length >= 3)
  const base = long.length ? long : words
  return [...new Set(base.flatMap((w) => [w, fold(w)]))].slice(0, 10)
}

/** Palavra cortada por espaço no título ("BALÃ O"): o termo é a junção de 2 ou 3 pedaços seguidos. */
const joined = (term: string, hay: string[]): boolean => {
  for (let i = 0; i < hay.length - 1; i++) {
    let acc = ''
    for (let j = i; j < Math.min(i + 3, hay.length); j++) {
      acc += hay[j]
      if (acc === term && j > i) return true
      if (acc.length >= term.length) break
    }
  }
  return false
}

const matches = (term: string, hay: string[]): boolean =>
  hay.some((h) => h === term || (term.length >= 3 && h.startsWith(term))) || (term.length >= 4 && joined(term, hay))

/** Quantos termos da busca aparecem no título, artista ou álbum. */
export function scoreTrack(terms: string[], t: Rankable): number {
  const hay = tokenize(`${t.title} ${t.artist} ${t.album ?? ''}`)
  return terms.filter((q) => matches(q, hay)).length
}

const titleScore = (terms: string[], t: Rankable): number => {
  const hay = tokenize(t.title)
  return terms.filter((q) => matches(q, hay)).length
}

/** Ordena por pontuação (mais termos primeiro); em empate, quem tem o termo no título; depois a ordem original. */
export function rankTracks<T extends Rankable>(tracks: T[], terms: string[]): T[] {
  return tracks
    .map((t, i) => ({ t, i, s: scoreTrack(terms, t), ts: titleScore(terms, t) }))
    .sort((a, b) => b.s - a.s || b.ts - a.ts || a.i - b.i)
    .map((x) => x.t)
}

/**
 * Das faixas de UM item: as que combinam com a busca (até `perItem`); se nenhuma combinar
 * (o item entrou por descrição/assunto), só as primeiras 3.
 */
export function selectTracks<T extends Rankable>(tracks: T[], terms: string[], perItem = 12): T[] {
  const hit = rankTracks(tracks, terms).filter((t) => scoreTrack(terms, t) > 0)
  return hit.length ? hit.slice(0, perItem) : tracks.slice(0, 3)
}

/** Quantos termos uma faixa precisa ter para entrar: 1 em buscas de até 2 termos, metade (arredondada pra cima) nas maiores. */
export const minScore = (n: number): number => (n <= 2 ? 1 : Math.ceil(n / 2))

/**
 * Resultado final da busca: ordena pela pontuação (faixas que casam com a busca INTEIRA primeiro).
 * Em buscas com 3+ termos, descarta faixas que só casam com uma palavra solta da busca.
 */
export function filterByQuery<T extends Rankable>(tracks: T[], terms: string[]): T[] {
  const ranked = rankTracks(tracks, terms)
  if (terms.length <= 2) return ranked
  const need = minScore(terms.length)
  return ranked.filter((t) => scoreTrack(terms, t) >= need)
}
