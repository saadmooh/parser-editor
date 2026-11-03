import { type AnyNode, type AnyNodeId, getFloorStackedPosition } from '@pascal-app/core'
import { PergolaNode } from './schema'
import { findPergolaSupportSurface, pergolaPointFromSupport, pergolaPointOnSupport, pergolaSupportPose, pergolaSupportSurfaceTop } from './support-surface'

export function resolvePergolaSupportPatch(raw: AnyNode, nodes: Record<string, AnyNode>): Partial<PergolaNode> | null {
  const pergola = PergolaNode.parse(raw)
  const parent = pergola.parentId ? nodes[pergola.parentId as AnyNodeId] : undefined
  const hosted = !!parent && parent.id === pergola.supportSurfaceId
  const host = hosted ? parent as unknown as Parameters<typeof pergolaPointFromSupport>[0] : null
  const [x, z] = hosted
    ? pergolaPointFromSupport(host!, [pergola.position[0], pergola.position[2]])
    : [pergola.position[0], pergola.position[2]]
  const levelId = hosted ? parent!.parentId : pergola.parentId
  const worldYaw = pergola.rotation[1] + (hosted ? pergolaSupportPose(host!).yaw : 0)
  const planNode = PergolaNode.parse({ ...pergola, parentId: levelId,
    position: [x, 0, z], rotation: [0, worldYaw, 0] })
  const support = findPergolaSupportSurface(planNode, nodes, hosted ? parent!.id : pergola.supportSurfaceId ?? undefined)

  if (support) {
    const [localX, localZ] = pergolaPointOnSupport(support, [x, z])
    const localY = pergolaSupportSurfaceTop(support, [x, z]) - (support.position?.[1] ?? 0)
    const localYaw = worldYaw - pergolaSupportPose(support).yaw
    if (hosted && support.id === parent!.id &&
      Math.abs(pergola.position[1] - localY) < 1e-6) return null
    if (!hosted && !pergola.supportSurfaceId) {
      const visualY = getFloorStackedPosition({ node: raw, nodes, position: pergola.position })[1]
      if (visualY > pergolaSupportSurfaceTop(support, [x, z]) + 0.02) return null
    }
    return {
      parentId: support.id,
      supportSurfaceId: support.id,
      supportSlabId: undefined,
      position: [localX, localY, localZ],
      rotation: [0, localYaw, 0],
    } as Partial<PergolaNode>
  } else if (pergola.supportSurfaceId) {
    // The pergola was dragged beyond its parent surface's footprint.
    return {
      parentId: levelId,
      supportSurfaceId: null,
      supportSlabId: undefined,
      position: [x, 0, z],
      rotation: [0, worldYaw, 0],
    } as Partial<PergolaNode>
  }
  return null
}
