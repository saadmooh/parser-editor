import type { AnyNode } from '@pascal-app/core'
import { boundsIntersect, worldBounds, type Bounds2D } from './spatial-bounds'
import { isWaterOpening, poolCutoutSignature, poolCutoutWorldBounds } from './pool-cutouts'

type SceneNodes = Readonly<Record<string, AnyNode>>
const CUTOUT_SURFACE_KINDS = new Set([
  'landscape:ground-area', 'landscape:pathway', 'landscape:patio',
  'landscape:deck', 'landscape:concrete-slab', 'landscape:landing',
])

function surfaceBounds(value: AnyNode): Bounds2D | null {
  const node = value as unknown as {
    type: string; position?: number[]; rotation?: number | number[]
    outline?: number[][]; width?: number; depth?: number
    vertices?: { point: number[] }[]; edges?: { width: number; controls?: number[][] }[]
  }
  if (node.type === 'landscape:ground-area') return worldBounds(node.outline ?? [], node)
  if (node.type === 'landscape:pathway') {
    const points = [...(node.vertices ?? []).map((vertex) => vertex.point),
      ...(node.edges ?? []).flatMap((edge) => edge.controls ?? [])]
    const widest = Math.max(0, ...(node.edges ?? []).map((edge) => edge.width))
    return worldBounds(points, node, widest / 2 + 1)
  }
  if (typeof node.width !== 'number' || typeof node.depth !== 'number') return null
  const rectangle = [[-node.width / 2, -node.depth / 2], [node.width / 2, -node.depth / 2],
    [node.width / 2, node.depth / 2], [-node.width / 2, node.depth / 2]]
  const custom = (node.outline ?? []).map(([x, z]) => [x! * node.width!, z! * node.depth!])
  return worldBounds([...rectangle, ...custom], node, 1)
}

/** Conservative overlap: unknown geometry still rebuilds, distant known surfaces do not. */
export function affectedPoolCutoutSurfaceIds(current: SceneNodes, previous: SceneNodes): string[] {
  const changed: { parentId: string | null; bounds: Bounds2D | null }[] = []
  for (const id of new Set([...Object.keys(current), ...Object.keys(previous)])) {
    const before = previous[id], after = current[id]
    if (before === after || poolCutoutSignature(before) === poolCutoutSignature(after)) continue
    for (const value of [before, after]) {
      if (value && isWaterOpening(value) && poolCutoutSignature(value) !== null) changed.push({
        parentId: value.parentId,
        bounds: poolCutoutWorldBounds(value),
      })
    }
  }
  if (!changed.length) return []
  const result: string[] = []
  for (const value of Object.values(current)) {
    if (!CUTOUT_SURFACE_KINDS.has(value.type)) continue
    const bounds = surfaceBounds(value)
    if (changed.some((pool) => pool.parentId === value.parentId &&
      (!pool.bounds || !bounds || boundsIntersect(pool.bounds, bounds)))) result.push(value.id)
  }
  return result
}
