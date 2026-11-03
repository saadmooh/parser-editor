import type { AnyNode, MovableParentFrame } from '@pascal-app/core'
import { pergolaPointFromSupport, pergolaPointOnSupport, pergolaSupportPose } from '../domain/support-surface'

export const pergolaParentFrame: MovableParentFrame & { independent: boolean } = {
  independent: true,
  floorplanLiveTransform: ({ node, live }) => ({
    ...node, position: live.position, rotation: [0, live.rotation, 0],
  } as AnyNode),
  resolveParent: (node, nodes) => {
    const parent = node.parentId ? nodes[node.parentId] : undefined
    return parent && (node as AnyNode & { supportSurfaceId?: string }).supportSurfaceId === parent.id ? parent : null
  },
  parentRotationY: (parent) => pergolaSupportPose(parent).yaw,
  localToPlan: (parent, local) => {
    const [x, z] = pergolaPointFromSupport(parent, [local[0], local[2]])
    return [x, local[1] + ((parent as AnyNode & { position?: [number, number, number] }).position?.[1] ?? 0), z]
  },
  planToLocal: (parent, x, localY, z) => {
    const [localX, localZ] = pergolaPointOnSupport(parent, [x, z])
    return [localX, localY, localZ]
  },
}
