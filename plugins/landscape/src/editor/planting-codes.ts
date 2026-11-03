import { PLANT_PRESETS } from '../plant/domain/catalog'
import { TREE_SPECIES } from '../tree/domain/species'

function catalogCodes(prefix: string, entries: readonly { key: string; name: string }[]) {
  const groups = new Map<string, string[]>()
  for (const entry of entries) {
    const words = entry.name.toUpperCase().match(/[A-Z0-9]+/g) ?? ['PLANT']
    const abbreviation = words.length > 1 ? words.map((word) => word[0]).join('').slice(0, 4) : words[0]!.slice(0, 3)
    const base = `${prefix}-${abbreviation}`
    groups.set(base, [...(groups.get(base) ?? []), entry.key])
  }
  return new Map([...groups].flatMap(([base, keys]) => keys.sort().map((key, index) =>
    [key, keys.length === 1 ? base : `${base}-${index + 1}`] as const)))
}

const plants = catalogCodes('P', PLANT_PRESETS)
const trees = catalogCodes('T', TREE_SPECIES)

export function plantingCode(node: { species?: string; preset?: string }) {
  return node.species ? trees.get(node.species) ?? `T-${node.species.toUpperCase()}`
    : node.preset ? plants.get(node.preset) ?? `P-${node.preset.toUpperCase()}` : 'P-UNKNOWN'
}
