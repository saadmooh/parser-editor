import { type AnyNode, type AnyNodeId, type FloorplanAffordance, type FloorplanAffordanceSession,
  useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { getSegmentGridStep, resolveSlabEdgeBandSnap, resolveSlabPlanPointSnap, snapPointToGrid,
  snapScalarToGrid } from '@pascal-app/editor'
import type { Point } from '../../ground-areas/domain/schema'
import { surfaceEditPatch, surfaceLevelOutline, type DrawnSurface } from './outline'
import { drawnAccessItemFor, type DrawnAccessKind } from './items'
import { freehandCurveAffordance } from '../../ground-areas/editor/curve-affordance'

type SurfaceNode = DrawnSurface & { id: string; type: string; parentId: string | null }

type Operation = 'move-vertex' | 'add-vertex' | 'move-edge'
type Payload = { vertexIndex?: number; edgeIndex?: number }

function snap(node: SurfaceNode, raw: Point): Point {
  const fallback: Point = [...snapPointToGrid(raw, getSegmentGridStep())]
  return resolveSlabPlanPointSnap({ rawPoint: raw, fallbackPoint: fallback,
    levelId: node.parentId, excludeId: node.id }).point
}

function dragAffordance(kind: DrawnAccessKind, operation: Operation): FloorplanAffordance<SurfaceNode> {
  return {
    start({ node: raw, payload, initialPlanPoint }): FloorplanAffordanceSession {
      const node = drawnAccessItemFor(kind)!.schema.parse(raw) as SurfaceNode
      const id = node.id as AnyNodeId
      const ring = surfaceLevelOutline(node)
      const { vertexIndex, edgeIndex } = payload as Payload
      const index = operation === 'move-vertex' ? vertexIndex : edgeIndex
      let finalPatch: ReturnType<typeof surfaceEditPatch> = null
      let moved = false
      const preview = (points: Point[]) => {
        const patch = surfaceEditPatch(node, points)
        if (!patch) return
        finalPatch = patch
        useLiveNodeOverrides.getState().set(id, patch)
        useScene.getState().markDirty(id)
      }
      return {
        affectedIds: [id],
        apply({ planPoint }) {
          if (index === undefined || index < 0 || index >= ring.length) return
          const point: Point = [planPoint[0], planPoint[1]]
          moved = moved || Math.hypot(point[0] - initialPlanPoint[0], point[1] - initialPlanPoint[1]) > 0.01
          const next = ring.map(([x, z]): Point => [x, z])
          if (operation === 'move-vertex') next[index] = snap(node, point)
          if (operation === 'add-vertex') next.splice(index + 1, 0, snap(node, point))
          if (operation === 'move-edge') {
            const a = ring[index]!, b = ring[(index + 1) % ring.length]!
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
            next[(index + 1) % ring.length] = [b[0] + nx * travel, b[1] + nz * travel]
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

export function surfaceFloorplanAffordances(kind: DrawnAccessKind) {
  const deleteVertex: FloorplanAffordance<SurfaceNode> = {
    start({ node: raw, payload }) {
      const node = drawnAccessItemFor(kind)!.schema.parse(raw) as SurfaceNode
      const id = node.id as AnyNodeId
      const { vertexIndex } = payload as Payload
      const current = surfaceLevelOutline(node)
      const next = vertexIndex === undefined ? [] : current.filter((_, index) => index !== vertexIndex)
      const patch = next.length >= 3 ? surfaceEditPatch(node, next) : null
      return {
        affectedIds: [id],
        apply() {},
        canCommit() { return current.length > 3 && patch !== null && vertexIndex !== undefined &&
          vertexIndex >= 0 && vertexIndex < current.length },
        commit() {
          if (patch && (useScene.getState().nodes[id]?.type as string | undefined) === kind)
            useScene.getState().updateNode(id, patch as Partial<AnyNode>)
        },
      }
    },
  }
  return {
    'freehand-curve': freehandCurveAffordance,
    'move-vertex': dragAffordance(kind, 'move-vertex'),
    'add-vertex': dragAffordance(kind, 'add-vertex'),
    'move-edge': dragAffordance(kind, 'move-edge'),
    'delete-vertex': deleteVertex,
  }
}
