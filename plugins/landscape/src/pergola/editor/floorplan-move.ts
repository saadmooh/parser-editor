import { type AnyNode, type AnyNodeId, type FloorplanMoveTarget, snapPointToGrid, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { isGridSnapActive, useEditor } from '@pascal-app/editor'
import type { PergolaNode } from '../domain/schema'
import { resolvePergolaSupportPatch } from '../domain/support-state'
import { pergolaParentFrame } from './parent-frame'

export const pergolaFloorplanMoveTarget: FloorplanMoveTarget<PergolaNode> = ({ node, nodes }) => {
  const id = node.id as AnyNodeId
  const parent = pergolaParentFrame.resolveParent(node as unknown as AnyNode, nodes)
  let patch: Partial<PergolaNode> | null = null
  return {
    affectedIds: [id],
    apply({ planPoint, modifiers }) {
      const [x, z] = isGridSnapActive() && !modifiers.altKey
        ? snapPointToGrid(planPoint, useEditor.getState().gridSnapStep)
        : planPoint
      const position = parent
        ? pergolaParentFrame.planToLocal(parent, x, node.position[1], z)
        : [x, node.position[1], z] as [number, number, number]
      const moved = { ...node, position }
      patch = { position, ...resolvePergolaSupportPatch(moved as unknown as AnyNode, useScene.getState().nodes) }
      useLiveNodeOverrides.getState().set(id, patch as Partial<AnyNode>)
    },
    canCommit: () => patch !== null && !!useScene.getState().nodes[id],
    commit() {
      useLiveNodeOverrides.getState().clear(id)
      if (patch) useScene.getState().updateNode(id, patch as Partial<AnyNode>)
    },
  }
}
