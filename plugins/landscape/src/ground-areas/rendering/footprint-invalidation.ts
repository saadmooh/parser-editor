import type { AnyNode } from '@pascal-app/core'
import { GROUND_AREA_KIND } from '../domain/schema'
import { boundsIntersect, worldBounds, type Bounds2D } from '../../shared/spatial-bounds'

type SceneNodes = Readonly<Record<string, AnyNode>>
type Blocker = {
  id: string; type: string; parentId: string | null
  outline?: number[][]; polygon?: number[][]; holes?: number[][][]
  position?: number[]; rotation?: number | number[]; elevation?: number
  thickness?: number; surface?: string; visible?: boolean
}

function blockerSignature(value: AnyNode | undefined) {
  const node = value as unknown as Blocker | undefined
  if (!node || node.visible === false) return null
  if (node.type === GROUND_AREA_KIND && node.surface !== 'grass' && node.surface !== 'grass2')
    return JSON.stringify([node.parentId, node.position, node.rotation, node.outline, node.elevation, node.surface])
  if (node.type === 'slab')
    return JSON.stringify([node.parentId, node.position, node.rotation, node.polygon, node.holes, node.elevation, node.thickness])
  return null
}

function blockerBounds(value: AnyNode): Bounds2D | null {
  const node = value as unknown as Blocker
  return worldBounds(node.type === 'slab' ? node.polygon ?? [] : node.outline ?? [], node)
}

/** Grass geometry only changes when a nearby slab or non-grass area changes its footprint. */
export function affectedGrassAreaIds(current: SceneNodes, previous: SceneNodes): string[] {
  const changed: { parentId: string | null; bounds: Bounds2D | null }[] = []
  for (const id of new Set([...Object.keys(current), ...Object.keys(previous)])) {
    const before = previous[id], after = current[id]
    if (before === after || blockerSignature(before) === blockerSignature(after)) continue
    for (const value of [before, after]) {
      if (!value || blockerSignature(value) === null) continue
      changed.push({ parentId: value.parentId, bounds: blockerBounds(value) })
    }
  }
  if (!changed.length) return []
  const result: string[] = []
  for (const value of Object.values(current)) {
    const area = value as unknown as Blocker
    if (area.type !== GROUND_AREA_KIND || (area.surface !== 'grass' && area.surface !== 'grass2')) continue
    const bounds = worldBounds(area.outline ?? [], area)
    if (changed.some((blocker) => blocker.parentId === area.parentId &&
      (!bounds || !blocker.bounds || boundsIntersect(bounds, blocker.bounds)))) result.push(area.id)
  }
  return result
}
