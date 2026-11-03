import type { AnyNode } from '@pascal-app/core'
import { PlantNode } from '../plant/domain/schema'
import { TreeNode } from '../tree/domain/schema'
import { PLANT_PRESET_BY_KEY } from '../plant/domain/catalog'
import { TREE_SPECIES_BY_KEY } from '../tree/domain/species'
import { sceneVisibility } from './scene-visibility'
import { plantPlanRadius, treePlanRadius } from './planting-footprint'

export type PlantingOverlap = { nodeId: string; relatedId: string; message: string }
type Footprint = { id: string; parentId: string | null; x: number; z: number; radius: number; label: string }

export function plantingClearanceChecks(nodes: readonly AnyNode[], limit = 100,
  sceneNodes: Readonly<Record<string, AnyNode>> = Object.fromEntries(nodes.map((node) => [node.id, node]))): PlantingOverlap[] {
  const isVisible = sceneVisibility(sceneNodes)
  const footprints: Footprint[] = []
  for (const node of nodes) {
    if (!isVisible(node)) continue
    if ((node.type as string) === 'landscape:plant') {
      const parsed = PlantNode.safeParse(node)
      if (!parsed.success) continue
      const plant = parsed.data
      footprints.push({ id: node.id, parentId: node.parentId, x: plant.position[0], z: plant.position[2],
        radius: plantPlanRadius(plant), label: node.name || PLANT_PRESET_BY_KEY[plant.preset]!.name })
    } else if ((node.type as string) === 'landscape:tree') {
      const parsed = TreeNode.safeParse(node)
      if (!parsed.success) continue
      const tree = parsed.data
      footprints.push({ id: node.id, parentId: node.parentId, x: tree.position[0], z: tree.position[2],
        radius: treePlanRadius(tree), label: node.name || TREE_SPECIES_BY_KEY[tree.species]!.name })
    }
  }
  // Sweep plan bounding boxes; separated objects need no pairwise circle check.
  footprints.sort((a, b) => a.x - a.radius - (b.x - b.radius) || a.id.localeCompare(b.id))
  const overlaps: PlantingOverlap[] = []
  for (let i = 0; i < footprints.length && overlaps.length < limit; i++) {
    const a = footprints[i]!
    for (let j = i + 1; j < footprints.length && overlaps.length < limit; j++) {
      const b = footprints[j]!
      if (b.x - b.radius > a.x + a.radius) break
      if (a.parentId !== b.parentId || Math.abs(a.z - b.z) > a.radius + b.radius) continue
      const overlap = a.radius + b.radius - Math.hypot(a.x - b.x, a.z - b.z)
      if (overlap <= 0.03) continue
      overlaps.push({ nodeId: a.id, relatedId: b.id,
        message: `${a.label} and ${b.label}: plan footprints overlap by ${overlap.toFixed(2)} m. Confirm this spacing is intentional.` })
    }
  }
  return overlaps
}
