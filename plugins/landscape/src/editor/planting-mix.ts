export type PlantMixEntry = { preset: string; weight: number }

export function normalizePlantMix(plants: PlantMixEntry[]): PlantMixEntry[] {
  const total = plants.reduce((sum, plant) => sum + Math.max(0, plant.weight), 0)
  return plants.map(plant => ({ ...plant, weight: total ? Math.max(0, plant.weight) / total * 100 : 100 / plants.length }))
}

export function setPlantShare(plants: PlantMixEntry[], index: number, share: number): PlantMixEntry[] {
  if (plants.length === 1) return [{ ...plants[0]!, weight: 100 }]
  const value = Math.max(0, Math.min(100, share))
  const others = plants.reduce((sum, plant, i) => sum + (i === index ? 0 : plant.weight), 0)
  return plants.map((plant, i) => ({ ...plant, weight: i === index ? value : others ? plant.weight / others * (100 - value) : (100 - value) / (plants.length - 1) }))
}

export function weightedPlantMix(count: number, plants: PlantMixEntry[], seed: number): string[] {
  if (!plants.length || count <= 0) return []
  const shares = normalizePlantMix(plants)
  const allocations = shares.map((plant, index) => {
    const exact = count * plant.weight / 100
    return { ...plant, index, count: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = count - allocations.reduce((sum, plant) => sum + plant.count, 0)
  for (const plant of [...allocations].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (remaining-- <= 0) break
    plant.count++
  }
  const keys = allocations.flatMap(plant => Array.from({ length: plant.count }, () => plant.preset))
  let state = seed >>> 0
  for (let index = keys.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const other = Math.floor(state / 4294967296 * (index + 1))
    ;[keys[index], keys[other]] = [keys[other]!, keys[index]!]
  }
  return keys
}
