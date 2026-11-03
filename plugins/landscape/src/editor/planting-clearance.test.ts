import { expect, test } from 'bun:test'
import { type AnyNode, BuildingNode, LevelNode } from '@pascal-app/core'
import { PlantNode } from '../plant/domain/schema'
import { TreeNode } from '../tree/domain/schema'
import { plantingClearanceChecks } from './planting-clearance'

const plant = (id: string, x: number, extra: Record<string, unknown> = {}) => PlantNode.parse({ id, preset: 'fab:daisy', position: [x, 0, 0], parentId: 'level_a', ...extra }) as unknown as AnyNode

test('footprint overlap uses scaled spread and reports each pair once', () => {
  const a = plant('plant_a', 0, { scale: 2 })
  const b = plant('plant_b', 0.1)
  const overlaps = plantingClearanceChecks([a, b])
  expect(overlaps).toHaveLength(1)
  expect(overlaps[0]?.relatedId).toBe('plant_b')
  expect(plantingClearanceChecks([a, plant('plant_far', 100)])).toEqual([])
})

test('hidden objects and unrelated parent coordinates do not create false overlap', () => {
  expect(plantingClearanceChecks([plant('plant_a', 0), plant('plant_b', 0, { visible: false })])).toEqual([])
  expect(plantingClearanceChecks([plant('plant_a', 0), plant('plant_b', 0, { parentId: 'level_b' })])).toEqual([])
})

test('schematic tree crowns share the plan footprint and large overlap sets are bounded', () => {
  const tree = TreeNode.parse({ id: 'tree_a', species: 'whiteOak', parentId: 'level_a', controls: { height: 10 } }) as unknown as AnyNode
  expect(plantingClearanceChecks([tree, plant('plant_a', 1)])).toHaveLength(1)
  const crowded = Array.from({ length: 30 }, (_, index) => plant(`plant_${index}`, 0))
  expect(plantingClearanceChecks(crowded, 10)).toHaveLength(10)
})

test('hidden ancestors and cyclic parents exclude planting footprints', () => {
  const a = plant('plant_a', 0), b = plant('plant_b', 0)
  const level = LevelNode.parse({ id: 'level_a', parentId: 'building_a', visible: true })
  const building = BuildingNode.parse({ id: 'building_a', parentId: null, visible: false })
  const nodes = { [a.id]: a, [b.id]: b, [level.id]: level, [building.id]: building }
  expect(plantingClearanceChecks([a, b], 100, nodes)).toEqual([])
  expect(plantingClearanceChecks([a, b], 100, { ...nodes, [building.id]: { ...building, visible: true } })).toHaveLength(1)
  expect(plantingClearanceChecks([a, b], 100, { ...nodes, [building.id]: { ...building, visible: true, parentId: level.id } })).toEqual([])
})
