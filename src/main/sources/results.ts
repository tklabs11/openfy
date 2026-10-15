export async function gatherSourceResults<T>(jobs: Promise<T[]>[]): Promise<T[][]> {
  const results = await Promise.allSettled(jobs)
  if (results.length && results.every((result) => result.status === 'rejected')) {
    throw new Error('Sem conexão com as fontes de música.')
  }
  return results.map((result) => result.status === 'fulfilled' ? result.value : [])
}
