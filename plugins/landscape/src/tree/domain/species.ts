import { defaultControls, listSpecies, SPECIES } from '../vendor/api/seedthree.js'

export type TreeSpecies = { key: string; name: string; latin: string | null;
  biome: string | null; foliageType: string; cactus: boolean }

export const TREE_SPECIES = listSpecies() as TreeSpecies[]
export const TREE_SPECIES_BY_KEY = Object.fromEntries(TREE_SPECIES.map((species) => [species.key, species])) as Record<string, TreeSpecies>

export function isTreeSpecies(key: string): boolean { return key in SPECIES }
export function treeControls(species: string): Record<string, unknown> {
  return defaultControls(species) as Record<string, unknown>
}
