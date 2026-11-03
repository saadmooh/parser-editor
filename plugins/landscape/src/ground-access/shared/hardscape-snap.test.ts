import { expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { PatioNode } from '../patio/domain/schema'
import { DeckNode } from '../deck/domain/schema'
import { snapToHardscape } from './hardscape-snap'

test('hardscape snap targets rotated surface vertices and edges, and excludes the edited surface', () => {
  const patio = PatioNode.parse({ id: 'patio_1', parentId: 'level_1', width: 4, depth: 2,
    position: [3, 0, 1], rotation: [0, Math.PI / 2, 0] })
  const deck = DeckNode.parse({ id: 'deck_1', parentId: 'level_2', position: [10, 0, 10] })
  const nodes = { [patio.id]: patio as unknown as AnyNode, [deck.id]: deck as unknown as AnyNode }
  const corner = snapToHardscape([2.05, -1.05], nodes, 'level_1')
  expect(corner?.kind).toBe('vertex')
  expect(corner?.point[0]).toBeCloseTo(2)
  expect(corner?.point[1]).toBeCloseTo(-1)
  expect(corner?.nodeId).toBe(patio.id)
  const edge = snapToHardscape([2.05, 0], nodes, 'level_1')
  expect(edge?.kind).toBe('edge')
  expect(edge?.point[0]).toBeCloseTo(2)
  expect(edge?.point[1]).toBeCloseTo(0)
  expect(snapToHardscape([2.05, -1.05], nodes, 'level_1', patio.id)).toBeNull()
  expect(snapToHardscape([10, 10], nodes, 'level_1')).toBeNull()
})
