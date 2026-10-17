import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { fold, tokenize, queryTokens, recallTerms, scoreTrack, rankTracks, selectTracks, filterByQuery, minScore } =
  await importTypeScript('../src/main/sources/archive-rank.ts')
const { mapPool } = await importTypeScript('../src/main/sources/pool.ts')
const { buildArchiveQuery } = await importTypeScript('../src/main/sources/archive-query.ts')

const t = (title, artist = 'Orochi', album = 'Orochi - Lobo (2021)') => ({ title, artist, album })

test('fold removes accents and case', () => {
  assert.equal(fold('Balão'), 'balao')
  assert.deepEqual(tokenize('Orochi - Balão 2'), ['orochi', 'balao', '2'])
  assert.deepEqual(queryTokens('orochi Balão  balão 2'), ['orochi', 'balao', '2'])
})

test('recall terms drop short words and reserved words, keep accent variants', () => {
  assert.deepEqual(recallTerms('orochi balão 2'), ['orochi', 'balão', 'balao'])
  assert.deepEqual(recallTerms('2'), ['2'])
  assert.deepEqual(recallTerms('rock AND roll'), ['rock', 'roll'])
})

test('the song name is found even though it is only in the file, not in the album title', () => {
  const terms = queryTokens('orochi balão 2')
  const tracks = [t('Lobo'), t('Balão 2'), t('Balão'), t('Intro')]
  const ranked = rankTracks(tracks, terms)
  assert.equal(ranked[0].title, 'Balão 2')
  assert.equal(scoreTrack(terms, ranked[0]), 3)
  assert.equal(scoreTrack(terms, t('Lobo')), 1) // só "orochi" (do álbum)
})

test('short numeric term only matches whole tokens (2 does not match 2021)', () => {
  assert.equal(scoreTrack(['2'], t('Faixa', 'X', 'Disco (2021)')), 0)
  assert.equal(scoreTrack(['2'], t('Faixa 2', 'X', 'Disco')), 1)
})

test('prefix match works for terms with 3+ letters', () => {
  assert.equal(scoreTrack(['bal'], t('Balão')), 1)
})

test('selectTracks keeps matching tracks from long albums and falls back to the first 3', () => {
  const album = Array.from({ length: 20 }, (_, i) => t('Faixa ' + (i + 1), 'X', 'Disco'))
  album[17] = t('Balão 2', 'X', 'Disco')
  assert.equal(selectTracks(album, queryTokens('balão 2'))[0].title, 'Balão 2')
  assert.equal(selectTracks(album, queryTokens('inexistente')).length, 3)
})

test('buildArchiveQuery joins terms with OR and keeps the license filter by default', () => {
  const q = buildArchiveQuery(['orochi', 'balão'])
  assert.match(q, /title:\(orochi OR balão\)/)
  assert.match(q, /creativecommons\.org/)
  assert.doesNotMatch(buildArchiveQuery(['orochi'], false), /creativecommons/)
})

test('mapPool respects the concurrency limit and survives failures', async () => {
  let running = 0, peak = 0
  const out = await mapPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
    running++; peak = Math.max(peak, running)
    await new Promise((r) => setTimeout(r, 5))
    running--
    if (n === 3) throw new Error('falhou')
    return n * 10
  })
  assert.ok(peak <= 2)
  assert.deepEqual(out, [10, 20, undefined, 40, 50, 60])
})

test('mapPool stops starting new work after the budget', async () => {
  const out = await mapPool([1, 2, 3, 4], 1, async (n) => {
    await new Promise((r) => setTimeout(r, 30))
    return n
  }, 40)
  assert.ok(out[0] === 1 && out[3] === undefined)
})

test('linking words do not count as search terms', () => {
  assert.deepEqual(queryTokens('mc cabelinho voz do coração'), ['mc', 'cabelinho', 'voz', 'coracao'])
  assert.deepEqual(queryTokens('de a'), ['de', 'a']) // busca só de palavras de ligação continua valendo
  assert.deepEqual(recallTerms('mc cabelinho voz do coração'), ['cabelinho', 'voz', 'coração', 'coracao'])
})

test('long searches match the WHOLE search, not isolated words', () => {
  const terms = queryTokens('mc cabelinho voz do coração')
  assert.equal(minScore(terms.length), 2)
  const tracks = [
    { title: '02 - Coração de pedra', artist: 'Coração De Pedra', album: 'É Pra Beber e Amar' },
    { title: 'El Corazón de un lector', artist: 'Radio', album: 'portugal no coração' },
    { title: 'Voz', artist: 'Outro', album: 'Disco' },
    { title: 'Vai dar ruim', artist: 'MC Cabelinho', album: 'Single' },
    { title: 'Voz do Coração', artist: 'MC Cabelinho', album: 'Single' }
  ]
  const out = filterByQuery(tracks, terms).map((t) => t.title)
  assert.deepEqual(out, ['Voz do Coração', 'Vai dar ruim'])
})

test('short searches keep partial matches but rank the full match first', () => {
  const terms = queryTokens('orochi balão')
  const out = filterByQuery([t('Lobo'), t('Balão')], terms).map((x) => x.title)
  assert.deepEqual(out, ['Balão', 'Lobo'])
})

test('a word split by a stray space in the title still matches ("BALÃ O" = balão)', () => {
  const terms = queryTokens('orochi balão 2')
  const item = { title: 'Y 2mate.com Orochi BALÃ O Prod Dallass', artist: '', album: '' }
  assert.equal(scoreTrack(terms, item), 2)
  assert.equal(filterByQuery([item], terms).length, 1)
  // não vira falso positivo: junção só vale com pedaços seguidos
  assert.equal(scoreTrack(['balao'], { title: 'bala casa o', artist: '', album: '' }), 0)
})

test('hyphenated file names match term by term', () => {
  const terms = queryTokens('orochi balão 2')
  assert.equal(scoreTrack(terms, { title: 'orochi-balao-prod-dallass', artist: 'aaa', album: '' }), 2)
})
