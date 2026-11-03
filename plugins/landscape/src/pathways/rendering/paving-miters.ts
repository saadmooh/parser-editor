import type { MultiPolygon, Polygon } from 'polygon-clipping'
import { derivative, edgeCurve } from '../domain/curves'
import type { PathEdge, PathwayNode, Point } from '../domain/schema'
import { pavingPolygons } from './paving-polygons'

function outwardDirection(node: PathwayNode, edge: PathEdge, vertexId: string): Point {
  const d = derivative(edgeCurve(node, edge), edge.from === vertexId ? 0 : 1)
  const length = Math.hypot(...d) || 1
  const sign = edge.from === vertexId ? 1 : -1
  return [sign * d[0] / length, sign * d[1] / length]
}

export function pavingMiterExtension(node: PathwayNode, edge: PathEdge, vertexId: string): number {
  const a = outwardDirection(node, edge, vertexId)
  let extension = 0
  for (const other of node.edges) {
    if (other.id === edge.id || other.from !== vertexId && other.to !== vertexId) continue
    const b = outwardDirection(node, other, vertexId)
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))
    const width = Math.max(edge.width, other.width)
    const reach = width / 2 * Math.sqrt((1 + dot) / Math.max(1e-6, 1 - dot))
    extension = Math.max(extension, Math.min(width * 2, reach + 0.03))
  }
  return extension
}

/** Partition adjoining runs at their tangent bisector, leaving an expansion joint. */
export function miteredPavingRegion(node: PathwayNode, edge: PathEdge, footprint: MultiPolygon, jointWidth = 0.03): MultiPolygon {
  let region = footprint
  for (const id of [edge.from, edge.to]) {
    const vertex = node.vertices.find((v) => v.id === id)!
    const attached = node.edges.filter((e) => e.from === id || e.to === id)
    if (attached.length < 2) continue
    const a = outwardDirection(node, edge, id)
    const radius = Math.max(...attached.map((e) => e.width)) * 4
    for (const other of attached) {
      if (other.id === edge.id) continue
      const b = outwardDirection(node, other, id)
      const delta: Point = [a[0] - b[0], a[1] - b[1]]
      const length = Math.hypot(...delta)
      if (length < 1e-6) continue
      const n: Point = [delta[0] / length, delta[1] / length]
      const at = (along: number, across: number): Point => [
        vertex.point[0] + n[0] * along - n[1] * across,
        vertex.point[1] + n[1] * along + n[0] * across,
      ]
      // Local mask: a distant section of a winding spline can cross the plane
      // without being cut. The radius covers the outline's miter limit.
      const forbidden: Polygon = [[at(-radius, -radius), at(jointWidth / 2, -radius),
        at(jointWidth / 2, radius), at(-radius, radius)]]
      region = pavingPolygons.difference(region, forbidden)
    }
  }
  return region
}
