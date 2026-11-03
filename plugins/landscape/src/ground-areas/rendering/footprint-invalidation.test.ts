import { expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { affectedGrassAreaIds } from './footprint-invalidation'

const nodes = (values: Record<string, unknown>) => values as Record<string, AnyNode>
const near = { id: 'grass_near', type: 'landscape:ground-area', parentId: 'level_a', surface: 'grass',
  outline: [[-5, -5], [5, -5], [5, 5], [-5, 5]] }
const far = { ...near, id: 'grass_far', position: [100, 0, 0] }
const soil = { id: 'soil', type: 'landscape:ground-area', parentId: 'level_a', surface: 'soil',
  outline: [[-1, -1], [1, -1], [1, 1], [-1, 1]] }

test('grass invalidation follows a changed blocker instead of rebuilding every lawn', () => {
  const before = nodes({ near, far, soil })
  expect(affectedGrassAreaIds(nodes({ near, far, soil: { ...soil, paintedMaterials: { x: {} } } }), before)).toEqual([])
  expect(affectedGrassAreaIds(nodes({ near, far, soil: { ...soil, outline: [[-2, -2], [2, -2], [2, 2], [-2, 2]] } }), before))
    .toEqual(['grass_near'])
  expect(affectedGrassAreaIds(nodes({ near, far, soil: { ...soil, position: [100, 0, 0] } }), before))
    .toEqual(['grass_near', 'grass_far'])
})

test('grass invalidation ignores edits to grass and unrelated levels', () => {
  const before = nodes({ near, far, soil })
  expect(affectedGrassAreaIds(nodes({ near: { ...near, outline: [[-6, -6], [6, -6], [6, 6], [-6, 6]] }, far, soil }), before))
    .toEqual([])
  expect(affectedGrassAreaIds(nodes({ near, far, soil: { ...soil, parentId: 'level_b' } }), before))
    .toEqual(['grass_near'])
})
