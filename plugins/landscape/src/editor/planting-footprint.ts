import type { PlantNode } from '../plant/domain/schema'
import { PLANT_PRESET_BY_KEY } from '../plant/domain/catalog'
import type { TreeNode } from '../tree/domain/schema'
import { treeControls } from '../tree/domain/species'

export function plantPlanRadius(node: PlantNode) {
  return Math.max(0.1, (PLANT_PRESET_BY_KEY[node.preset]?.spread ?? 1) * node.scale / 2)
}

export function treePlanRadius(node: TreeNode) {
  const rawHeight = node.controls.height ?? treeControls(node.species).height
  const height = typeof rawHeight === 'number' && Number.isFinite(rawHeight) ? rawHeight : 7
  // SeedThree does not expose canopy bounds. Keep checks consistent with the schematic plan crown.
  return Math.max(0.5, height * 0.28)
}
