export interface QueueChange<T> {
  queue: T[]
  index: number
}

export function insertNext<T>(queue: T[], index: number, track: T): QueueChange<T> {
  if (index < 0 || index >= queue.length) return { queue: [...queue, track], index: queue.length }
  const next = [...queue]
  next.splice(index + 1, 0, track)
  return { queue: next, index }
}

export function removeQueueItem<T>(queue: T[], index: number, removeIndex: number): QueueChange<T> {
  if (removeIndex < 0 || removeIndex >= queue.length) return { queue, index }
  const next = queue.filter((_, i) => i !== removeIndex)
  if (!next.length) return { queue: next, index: -1 }
  if (removeIndex === index) return { queue: next, index: Math.min(index, next.length - 1) }
  return { queue: next, index: removeIndex < index ? index - 1 : index }
}

export function moveQueueItem<T>(queue: T[], index: number, from: number, to: number): QueueChange<T> {
  if (from < 0 || from >= queue.length || to < 0 || to >= queue.length || from === to) {
    return { queue, index }
  }
  const next = [...queue]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  const nextIndex = index === from
    ? to
    : from < index && to >= index
      ? index - 1
      : from > index && to <= index
        ? index + 1
        : index
  return { queue: next, index: nextIndex }
}

export function keepCurrentQueueItem<T>(queue: T[], index: number): QueueChange<T> {
  const current = queue[index]
  return current === undefined ? { queue: [], index: -1 } : { queue: [current], index: 0 }
}
