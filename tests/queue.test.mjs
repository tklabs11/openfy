import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { insertNext, keepCurrentQueueItem, moveQueueItem, removeQueueItem } = await importTypeScript('../src/renderer/src/queue.ts')

const queue = ['a', 'b', 'c', 'd']

test('inserts a track after the current track without changing the current index', () => {
  assert.deepEqual(insertNext(queue, 1, 'x'), { queue: ['a', 'b', 'x', 'c', 'd'], index: 1 })
})

test('removing a track before the current one preserves the current item', () => {
  assert.deepEqual(removeQueueItem(queue, 2, 0), { queue: ['b', 'c', 'd'], index: 1 })
})

test('removing the current track selects the next available item', () => {
  assert.deepEqual(removeQueueItem(queue, 1, 1), { queue: ['a', 'c', 'd'], index: 1 })
})

test('removing the only queue item produces an empty queue', () => {
  assert.deepEqual(removeQueueItem(['a'], 0, 0), { queue: [], index: -1 })
})

test('reordering items keeps the current track selected', () => {
  assert.deepEqual(moveQueueItem(queue, 1, 0, 3), { queue: ['b', 'c', 'd', 'a'], index: 0 })
})

test('clearing upcoming tracks keeps the currently playing item', () => {
  assert.deepEqual(keepCurrentQueueItem(queue, 2), { queue: ['c'], index: 0 })
  assert.deepEqual(keepCurrentQueueItem(queue, -1), { queue: [], index: -1 })
})
