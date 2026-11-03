import { expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { DeckNode } from '../../ground-access/deck/domain/schema'
import { PergolaNode } from './schema'
import { resolvePergolaSupportPatch } from './support-state'
import { pergolaPointFromSupport, pergolaPointOnSupport } from './support-surface'

test('a hosted pergola moves locally and detaches outside a rotated deck without moving the deck', () => {
  const deck = DeckNode.parse({ position: [10, 0, 20], rotation: [0, Math.PI / 2, 0], width: 6, depth: 6 })
  const nodes = { [deck.id]: deck as unknown as AnyNode }
  const before = structuredClone(deck)
  const pergola = PergolaNode.parse({ parentId: deck.id, supportSurfaceId: deck.id,
    position: [1, deck.thickness + 0.01, 1], rotation: [0, 0.3, 0] })
  expect(resolvePergolaSupportPatch(pergola as unknown as AnyNode, nodes)).toBeNull()
  const outside = { ...pergola, position: [5, pergola.position[1], 1] as [number, number, number] }
  const detached = resolvePergolaSupportPatch(outside as unknown as AnyNode, nodes)!
  expect(detached.parentId).toBe(deck.parentId)
  expect(detached.supportSurfaceId).toBeNull()
  expect(detached.position![0]).toBeCloseTo(11)
  expect(detached.position![2]).toBeCloseTo(15)
  expect(detached.rotation![1]).toBeCloseTo(Math.PI / 2 + 0.3)
  expect<unknown>(nodes[deck.id]).toEqual(before)
  const local = pergolaPointOnSupport(deck, pergolaPointFromSupport(deck, [2, 1]))
  expect(local[0]).toBeCloseTo(2)
  expect(local[1]).toBeCloseTo(1)
})
