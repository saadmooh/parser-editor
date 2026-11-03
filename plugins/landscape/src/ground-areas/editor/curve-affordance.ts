import { type AnyNode, type AnyNodeId, type FloorplanAffordance, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { CURVE_ARM_SCALE, curveEditPatch, curveInLevel, type CurveNode } from '../domain/curve-edit'
import { curveAt, editCurve, type CurveAction } from '../domain/freehand-curve'
import type { Point } from '../domain/schema'

export const freehandCurveAffordance: FloorplanAffordance<CurveNode> = {
  start({ node, payload }) {
    const { index, action } = payload as { index: number; action: CurveAction }
    const curve = curveInLevel(node), id = node.id as AnyNodeId
    const valid = Number.isInteger(index) && !!curve[index] && ['anchor', 'incoming', 'outgoing', 'insert'].includes(action)
      && !(node.closed === false && action === 'insert' && index === curve.length - 1)
    let patch = valid && action === 'insert' ? curveEditPatch(node, editCurve(curve, index, action, curveAt(curve, index, 0.5))) : null
    return {
      affectedIds: [id],
      apply({ planPoint }) {
        if (!valid) return
        const anchor = curve[index]!.anchor
        const point: Point = action === 'incoming' || action === 'outgoing'
          ? [anchor[0] + (planPoint[0] - anchor[0]) / CURVE_ARM_SCALE, anchor[1] + (planPoint[1] - anchor[1]) / CURVE_ARM_SCALE]
          : [planPoint[0], planPoint[1]]
        const next = curveEditPatch(node, editCurve(curve, index, action, point))
        if (!next) return
        patch = next
        useLiveNodeOverrides.getState().set(id, next)
        useScene.getState().markDirty(id)
      },
      canCommit() { return patch !== null },
      commit() {
        useLiveNodeOverrides.getState().clear(id)
        if (patch) useScene.getState().updateNode(id, patch as Partial<AnyNode>)
      },
    }
  },
}
