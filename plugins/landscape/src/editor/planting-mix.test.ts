import { test, expect } from 'bun:test'
import { normalizePlantMix, setPlantShare, weightedPlantMix } from './planting-mix'

const plants = [{ preset: 'daisy', weight: 50 }, { preset: 'poppy', weight: 30 }, { preset: 'clover', weight: 20 }]
test('allocates multiple species accurately and deterministically', () => {
  const mix = weightedPlantMix(40, plants, 3)
  expect(mix.filter(key => key === 'daisy')).toHaveLength(20)
  expect(mix.filter(key => key === 'poppy')).toHaveLength(12)
  expect(mix.filter(key => key === 'clover')).toHaveLength(8)
  expect(weightedPlantMix(40, plants, 3)).toEqual(mix)
  expect(weightedPlantMix(40, plants, 4)).not.toEqual(mix)
})
test('rounding preserves every position even with more species than plants', () => {
  const equal = Array.from({ length: 12 }, (_, index) => ({ preset: String(index), weight: 1 }))
  for (let count = 1; count <= 500; count++) expect(weightedPlantMix(count, equal, 1)).toHaveLength(count)
  expect(new Set(weightedPlantMix(5, equal, 1)).size).toBe(5)
  expect(weightedPlantMix(3, [{ preset: 'a', weight: 50 }, { preset: 'b', weight: 50 }], 1).filter(key => key === 'a')).toHaveLength(2)
})
test('handles empty, single and zero-share species', () => {
  expect(weightedPlantMix(0, plants, 1)).toEqual([])
  expect(weightedPlantMix(3, [], 1)).toEqual([])
  expect(weightedPlantMix(3, [{ preset: 'a', weight: 100 }], 1)).toEqual(['a', 'a', 'a'])
  expect(weightedPlantMix(3, [{ preset: 'a', weight: 0 }, { preset: 'b', weight: 100 }], 1)).toEqual(['b', 'b', 'b'])
  expect(normalizePlantMix([{ preset: 'a', weight: 0 }, { preset: 'b', weight: 0 }]).map(plant => plant.weight)).toEqual([50, 50])
})
test('editing a share rebalances other plants while preserving their ratio', () => {
  const updated = setPlantShare(plants, 0, 75)
  expect(updated.map(plant => plant.weight)).toEqual([75, 15, 10])
  expect(setPlantShare(updated, 0, 100).map(plant => plant.weight)).toEqual([100, 0, 0])
  expect(setPlantShare(setPlantShare(updated, 0, 100), 0, 50).map(plant => plant.weight)).toEqual([50, 25, 25])
  expect(normalizePlantMix(updated.slice(1)).map(plant => plant.weight)).toEqual([60, 40])
})
