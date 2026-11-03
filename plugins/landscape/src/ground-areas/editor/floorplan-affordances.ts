import type { AnyNode, AnyNodeId, FloorplanAffordance, FloorplanAffordanceSession } from '@pascal-app/core'
import { useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { getSegmentGridStep, resolveSlabEdgeBandSnap, resolveSlabPlanPointSnap, snapPointToGrid, snapScalarToGrid } from '@pascal-app/editor'
import { groundAreaEditPatch } from '../domain/edit'
import { GROUND_AREA_KIND, GroundAreaNode, type Point } from '../domain/schema'
import { freehandCurveAffordance } from './curve-affordance'

type Operation = 'move-vertex' | 'add-vertex' | 'move-edge'
type Payload = { vertexIndex?: number; edgeIndex?: number }

function snap(node: GroundAreaNode, raw: Point): Point {
  const fallback: Point = [...snapPointToGrid(raw, getSegmentGridStep())]
  return resolveSlabPlanPointSnap({ rawPoint: raw, fallbackPoint: fallback,
    levelId: node.parentId, excludeId: node.id }).point
}

function dragAffordance(operation: Operation): FloorplanAffordance<GroundAreaNode> {
  return {
    start({ node: raw, payload, initialPlanPoint }): FloorplanAffordanceSession {
      const node = GroundAreaNode.parse(raw)
      const id = node.id as AnyNodeId
      const outline = node.outline
      const { vertexIndex, edgeIndex } = payload as Payload
      const index = operation === 'move-vertex' ? vertexIndex : edgeIndex
      let finalPatch: ReturnType<typeof groundAreaEditPatch> = null
      let moved = false
      const preview = (points: Point[]) => {
        const patch = groundAreaEditPatch(points)
        if (!patch) return
        finalPatch = patch
        useLiveNodeOverrides.getState().set(id, patch)
        useScene.getState().markDirty(id)
      }
      return {
        affectedIds: [id],
        apply({ planPoint }) {
          if (index === undefined || index < 0 || index >= outline.length) return
          const point: Point = [planPoint[0], planPoint[1]]
          moved ||= Math.hypot(point[0] - initialPlanPoint[0], point[1] - initialPlanPoint[1]) > 0.01
          const next = outline.map(([x, z]): Point => [x, z])
          if (operation === 'move-vertex') next[index] = snap(node, point)
          if (operation === 'add-vertex') next.splice(index + 1, 0, snap(node, point))
          if (operation === 'move-edge') {
            const a = outline[index]!, b = outline[(index + 1) % outline.length]!
            const dx = b[0] - a[0], dz = b[1] - a[1]
            const length = Math.hypot(dx, dz)
            if (length < 1e-6) return
            const nx = -dz / length, nz = dx / length
            let travel = snapScalarToGrid(
              (point[0] - initialPlanPoint[0]) * nx + (point[1] - initialPlanPoint[1]) * nz,
              getSegmentGridStep(),
            )
            const candidate: [Point, Point] = [
              [a[0] + nx * travel, a[1] + nz * travel],
              [b[0] + nx * travel, b[1] + nz * travel],
            ]
            const edgeSnap = resolveSlabEdgeBandSnap({ edge: candidate,
              levelId: node.parentId, referencePoint: point })
            if (edgeSnap) travel = (edgeSnap.edge[0][0] - a[0]) * nx +
              (edgeSnap.edge[0][1] - a[1]) * nz
            next[index] = [a[0] + nx * travel, a[1] + nz * travel]
            next[(index + 1) % outline.length] = [b[0] + nx * travel, b[1] + nz * travel]
          }
          preview(next)
        },
        canCommit() { return moved && finalPatch !== null },
        commit() {
          if (!finalPatch) return
          useLiveNodeOverrides.getState().clear(id)
          useScene.getState().updateNode(id, finalPatch as Partial<AnyNode>)
          useScene.getState().markDirty(id)
        },
      }
    },
  }
}

const deleteVertex: FloorplanAffordance<GroundAreaNode> = {
  start({ node: raw, payload }) {
    const node = GroundAreaNode.parse(raw)
    const id = node.id as AnyNodeId
    const { vertexIndex } = payload as Payload
    const outline = node.outline
    const next = vertexIndex === undefined ? [] : outline.filter((_, index) => index !== vertexIndex)
    const patch = next.length >= 3 ? groundAreaEditPatch(next) : null
    return {
      affectedIds: [id],
      apply() {},
      canCommit() { return outline.length > 3 && patch !== null && vertexIndex !== undefined &&
        vertexIndex >= 0 && vertexIndex < outline.length },
      commit() {
        if (patch && (useScene.getState().nodes[id]?.type as string | undefined) === GROUND_AREA_KIND)
          useScene.getState().updateNode(id, patch as Partial<AnyNode>)
      },
    }
  },
}

export const groundAreaFloorplanAffordances = {
  'freehand-curve': freehandCurveAffordance,
  'move-vertex': dragAffordance('move-vertex'),
  'add-vertex': dragAffordance('add-vertex'),
  'move-edge': dragAffordance('move-edge'),
  'delete-vertex': deleteVertex,
}
