import { expect, test } from 'bun:test'
import { PondNode } from './schema'
import { createPondEditSession } from './edit-session'

test('previews merge without scene writes and release commits once', () => {
  const node = PondNode.parse({})
  const writes: unknown[] = [], previews: unknown[] = [], cleared: string[][] = []
  const session = createPondEditSession({ current: () => node, readOnly: () => false,
    preview: patch => previews.push(patch), clear: fields => cleared.push(fields), commit: patch => writes.push(patch) })
  session.preview({ bankWidth: 1, basinDepth: 1.5 })
  session.preview({ bankWidth: 1.2 })
  expect(writes).toHaveLength(0)
  expect(previews.at(-1)).toEqual({ bankWidth: 1.2, basinDepth: 1.5 })
  session.commit()
  session.commit()
  expect(writes).toEqual([{ bankWidth: 1.2, basinDepth: 1.5 }])
  expect(cleared[0]).toEqual(['bankWidth', 'basinDepth'])
})

test.each(['cancel', 'stale', 'read-only'] as const)('%s edits clear previews without committing', mode => {
  let node = PondNode.parse({}), readOnly = false, writes = 0
  const cleared: string[][] = []
  const session = createPondEditSession({ current: () => node, readOnly: () => readOnly,
    preview() {}, clear: fields => cleared.push(fields), commit() { writes++ } })
  session.preview({ depth: 2 })
  if (mode === 'cancel') session.cancel()
  if (mode === 'stale') node = { ...node, depth: 3 }
  if (mode === 'read-only') readOnly = true
  session.commit()
  expect(writes).toBe(0)
  expect(cleared[0]).toEqual(['depth'])
})
