import type { AnyNode } from '@pascal-app/core'
import type { Point } from '../../ground-areas/domain/schema'
import { surfaceLevelOutline, type DrawnSurface } from './outline'

/** Hardscape outlines that can be joined to while drawing another item. */
export const CONNECTABLE_SURFACE_KINDS = new Set([
  'landscape:patio', 'landscape:deck', 'landscape:concrete-slab', 'landscape:landing',
])

export type HardscapeSnap = { point: Point; kind: 'vertex' | 'edge'; nodeId: string; height: number; edgeDirection?: Point }

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared < 1e-10 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared))
  const snapped: Point = [a[0] + t * dx, a[1] + t * dz]
  return { point: snapped, distance: Math.hypot(point[0] - snapped[0], point[1] - snapped[1]) }
}

function surfaceHeight(node: DrawnSurface & { elevation?: number }, point: Point) {
  let height = node.position[1] + node.thickness + (node.elevation ?? 0)
  if ((node as DrawnSurface & { type?: string }).type === 'landscape:patio') {
    const angle = node.rotation[1]
    const dx = point[0] - node.position[0], dz = point[1] - node.position[2]
    const x = dx * Math.cos(angle) - dz * Math.sin(angle)
    const z = dx * Math.sin(angle) + dz * Math.cos(angle)
    const patio = node as DrawnSurface & { slopePercent?: number; drainDirection?: string }
    const grade = (patio.slopePercent ?? 0) / 100
    const slope = patio.drainDirection === 'front' ? grade * z
      : patio.drainDirection === 'back' ? -grade * z
        : patio.drainDirection === 'left' ? grade * x
          : patio.drainDirection === 'right' ? -grade * x : 0
    height += Math.min(0.045, node.thickness / 3) + slope
  }
  return height
}

/** Snap tightly to corners, then to the nearest edge of a hardscape surface. */
export function snapToHardscape(point: Point, nodes: Readonly<Record<string, AnyNode>>,
  levelId: string, excludeId?: string, radius = 0.24): HardscapeSnap | null {
  let bestVertex: (HardscapeSnap & { distance: number }) | null = null
  let bestEdge: (HardscapeSnap & { distance: number }) | null = null
  const vertices: { point: Point; nodeId: string }[] = []
  const edges: { a: Point; b: Point; nodeId: string }[] = []
  for (const node of Object.values(nodes)) {
    if (node.id === excludeId || node.parentId !== levelId || !CONNECTABLE_SURFACE_KINDS.has(node.type as string)) continue
    const outline = surfaceLevelOutline(node as unknown as DrawnSurface)
    outline.forEach((vertex, index) => {
      vertices.push({ point: vertex, nodeId: node.id })
      edges.push({ a: vertex, b: outline[(index + 1) % outline.length]!, nodeId: node.id })
    })
  }
  const vertexRadius = Math.min(radius, 0.1)
  for (const vertex of vertices) {
    const d = Math.hypot(point[0] - vertex.point[0], point[1] - vertex.point[1])
    if (d <= vertexRadius && (!bestVertex || d < bestVertex.distance))
      bestVertex = { point: vertex.point, distance: d, kind: 'vertex', nodeId: vertex.nodeId,
        height: surfaceHeight(nodes[vertex.nodeId] as unknown as DrawnSurface & { elevation?: number }, vertex.point) }
  }
  if (bestVertex) return bestVertex
  for (const edge of edges) {
    const hit = distanceToSegment(point, edge.a, edge.b)
    if (hit.distance <= radius && (!bestEdge || hit.distance < bestEdge.distance)) {
      const length = Math.hypot(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1])
      bestEdge = { ...hit, kind: 'edge', nodeId: edge.nodeId,
        edgeDirection: length > 1e-8 ? [(edge.b[0] - edge.a[0]) / length, (edge.b[1] - edge.a[1]) / length] as Point : undefined,
        height: surfaceHeight(nodes[edge.nodeId] as unknown as DrawnSurface & { elevation?: number }, hit.point) }
    }
  }
  return bestEdge
}
