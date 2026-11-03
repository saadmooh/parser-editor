import { expect, test } from 'bun:test'
import { type AnyNode, LevelNode } from '@pascal-app/core'
import { PlantNode } from '../plant/domain/schema'
import { initialPlantingBatch, PlantingBatchSettings } from './planting-batches'

const level = LevelNode.parse({})
function plant(batchId: string, sourceId: string, parentId = level.id) {
  return PlantNode.parse({ parentId, metadata: { landscapePlanting: {
    batchId, sourceId, preset: 'fab:daisy', mix: '', primaryShare: 75,
    spacing: 1.5, setback: .5, seed: 7, natural: true, side: 'both',
  } } }) as unknown as AnyNode
}

test('reopens a sole saved layout with its original generation settings', () => {
  const nodes = [plant('a', 'area-a'), plant('a', 'area-a')]
  expect(initialPlantingBatch(nodes, level.id, [])).toMatchObject({ batchId: 'a', spacing: 1.5, plants: [{ preset: 'fab:daisy', weight: 100 }], seed: 7 })
})
test('uses the selected plant or source area when several layouts exist', () => {
  const nodes = [plant('a', 'area-a'), plant('b', 'area-b')]
  expect(initialPlantingBatch(nodes, level.id, [nodes[1]!.id])?.batchId).toBe('b')
  expect(initialPlantingBatch(nodes, level.id, ['area-a'])?.batchId).toBe('a')
})
test('requires a choice when saved layouts or selected batches are ambiguous', () => {
  const nodes = [plant('a', 'area-a'), plant('b', 'area-b')]
  expect(initialPlantingBatch(nodes, level.id, [])).toBeNull()
  expect(initialPlantingBatch(nodes, level.id, nodes.map(node => node.id))).toBeNull()
})
test('ignores layouts on other levels', () => {
  const otherLevel = LevelNode.parse({})
  const nodes = [plant('a', 'area-a', otherLevel.id)]
  expect(initialPlantingBatch(nodes, level.id, [nodes[0]!.id])).toBeNull()
})

test('converts saved two-plant settings to the plant list', () => {
  const legacy = plant('a', 'area-a').metadata!.landscapePlanting as Record<string, unknown>
  expect(PlantingBatchSettings.parse({ ...legacy, mix: 'fab:poppy' }).plants).toEqual([
    { preset: 'fab:daisy', weight: 75 }, { preset: 'fab:poppy', weight: 25 },
  ])
})
test('stores larger mixes and rejects invalid species lists', () => {
  const legacy = plant('a', 'area-a').metadata!.landscapePlanting as Record<string, unknown>
  const { preset, mix, primaryShare, ...settings } = legacy
  const plants = [{ preset: 'fab:daisy', weight: 50 }, { preset: 'fab:poppy', weight: 30 }, { preset: 'claude:nanohana', weight: 20 }]
  expect(PlantingBatchSettings.parse({ ...settings, plants }).plants).toEqual(plants)
  for (const invalid of [[], [plants[0], plants[0]], [{ preset: 'unknown', weight: 100 }], plants.map(plant => ({ ...plant, weight: 0 }))]) {
    expect(PlantingBatchSettings.safeParse({ ...settings, plants: invalid }).success).toBe(false)
  }
})
