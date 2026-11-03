import { getSegmentGridStep, type PolygonEditorPlanPointSnapContext,
  resolveSlabEdgeBandSnap, resolveSlabPlanPointSnap, snapScalarToGrid } from '@pascal-app/editor'
import type { Point } from '../domain/schema'

type EditableBoundary = { id: string; parentId: string | null }

export function resolveBoundaryEditPoint(context: PolygonEditorPlanPointSnapContext, node: EditableBoundary): Point {
  if (context.mode === 'edge' && context.edgeIndex !== undefined) {
    const a = context.initialPolygon[context.edgeIndex]
    const b = context.initialPolygon[(context.edgeIndex + 1) % context.initialPolygon.length]
    if (a && b) {
      const dx = b[0] - a[0], dz = b[1] - a[1]
      const length = Math.hypot(dx, dz)
      if (length > 1e-6) {
        const nx = -dz / length, nz = dx / length
        const travel = snapScalarToGrid(
          (context.rawPoint[0] - context.initialPosition[0]) * nx +
          (context.rawPoint[1] - context.initialPosition[1]) * nz,
          getSegmentGridStep(),
        )
        const edge: [Point, Point] = [
          [a[0] + nx * travel, a[1] + nz * travel],
          [b[0] + nx * travel, b[1] + nz * travel],
        ]
        const snapped = resolveSlabEdgeBandSnap({ edge, levelId: node.parentId,
          referencePoint: context.rawPoint })
        const distance = snapped
          ? (snapped.edge[0][0] - a[0]) * nx + (snapped.edge[0][1] - a[1]) * nz
          : travel
        return [context.initialPosition[0] + nx * distance,
          context.initialPosition[1] + nz * distance]
      }
    }
  }
  return resolveSlabPlanPointSnap({ rawPoint: context.rawPoint,
    fallbackPoint: context.gridPoint, levelId: node.parentId, excludeId: node.id }).point
}
