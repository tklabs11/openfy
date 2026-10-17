// Sem imports: testado isoladamente.

/**
 * Executa `fn` sobre os itens com no máximo `limit` ao mesmo tempo.
 * Passado `budgetMs`, não começa mais itens novos (os que já iniciaram terminam).
 * Itens que falham ou não chegaram a rodar ficam `undefined`.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  budgetMs: number = Infinity
): Promise<(R | undefined)[]> {
  const out: (R | undefined)[] = new Array(items.length).fill(undefined)
  const start = Date.now()
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length && Date.now() - start <= budgetMs) {
      const i = next++
      try {
        out[i] = await fn(items[i], i)
      } catch {
        out[i] = undefined
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return out
}
