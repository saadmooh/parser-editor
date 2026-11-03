import type { AnyNode, AnyNodeId, GeometryContext } from '@pascal-app/core'
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping'
import { GROUND_AREA_KIND, type GroundAreaNode, type Point } from '../domain/schema'

type Positioned = { position?: [number, number, number]; rotation?: number | [number, number, number] }
type SurfaceNode = AnyNode & Positioned

function yaw(node: Positioned) {
  return typeof node.rotation === 'number' ? node.rotation : node.rotation?.[1] ?? 0
}

function inAreaSpace(point: readonly number[], source: Positioned, area: Positioned): Point {
  const sourceAngle = yaw(source)
  const x = point[0]! * Math.cos(sourceAngle) + point[1]! * Math.sin(sourceAngle) + (source.position?.[0] ?? 0)
  const z = -point[0]! * Math.sin(sourceAngle) + point[1]! * Math.cos(sourceAngle) + (source.position?.[2] ?? 0)
  const dx = x - (area.position?.[0] ?? 0)
  const dz = z - (area.position?.[2] ?? 0)
  const areaAngle = yaw(area)
  return [dx * Math.cos(areaAngle) - dz * Math.sin(areaAngle), dx * Math.sin(areaAngle) + dz * Math.cos(areaAngle)]
}

function blockerFootprint(node: SurfaceNode, area: GroundAreaNode): MultiPolygon {
  // Access surfaces sit on top of the ground; only overlapping ground areas
  // and editor slabs subtract from the grass footprint.
  if (node.visible === false) return []
  const localHeight = (node.position?.[1] ?? 0) - ((area as Positioned).position?.[1] ?? 0)
  let footprint: MultiPolygon = []
  if ((node.type as string) === GROUND_AREA_KIND) {
    const other = node as unknown as GroundAreaNode
    if (other.id === area.id || other.surface === 'grass' || other.surface === 'grass2' || other.outline.length < 3 ||
        Math.abs(other.elevation + localHeight - area.elevation) > 0.18) return []
    footprint = [[other.outline]]
  } else if (node.type === 'slab') {
    if (node.elevation + localHeight < area.elevation + 0.015 ||
        node.elevation - node.thickness + localHeight > area.elevation + 0.18) return []
    footprint = [[node.polygon, ...node.holes]]
  }
  if (!footprint.length) return []
  return footprint.map((polygon) => polygon.map((ring) =>
    ring.map((point) => inAreaSpace(point, node, area as unknown as Positioned))))
}

export function visibleGrassFootprint(node: GroundAreaNode, ctx?: GeometryContext): MultiPolygon {
  if (node.outline.length < 3) return []
  const original: MultiPolygon = [[node.outline]]
  const parentIds = ctx?.parent && 'children' in ctx.parent ? ctx.parent.children : undefined
  const candidates = parentIds && Array.isArray(parentIds)
    ? parentIds.map((id) => ctx!.resolve(id as AnyNodeId)).filter((candidate): candidate is AnyNode => Boolean(candidate))
    : Object.values(ctx?.sceneNodes ?? {}).filter((candidate) => candidate.parentId === node.parentId)
  const blockers = candidates.flatMap((candidate) => blockerFootprint(candidate as SurfaceNode, node))
  if (!blockers.length) return original
  return polygonClipping.difference(original, ...blockers)
}

function insideRing(ring: readonly number[][], x: number, z: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!
    if ((a[1]! > z) !== (b[1]! > z) && x < ((b[0]! - a[0]!) * (z - a[1]!)) / (b[1]! - a[1]!) + a[0]!)
      inside = !inside
  }
  return inside
}

export function grassContainsPoint(footprint: MultiPolygon, x: number, z: number) {
  const clearanceSquared = 0.07 * 0.07
  return footprint.some((polygon: Polygon) => {
    if (!insideRing(polygon[0]!, x, z) || polygon.slice(1).some((hole) => insideRing(hole, x, z))) return false
    // Keep the short blades a little inside cut edges so they do not lean
    // through the paving or the next ground surface.
    for (const ring of polygon) for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!, b = ring[(i + 1) % ring.length]!
      const dx = b[0]! - a[0]!, dz = b[1]! - a[1]!
      const lengthSquared = dx * dx + dz * dz
      const t = lengthSquared
        ? Math.max(0, Math.min(1, ((x - a[0]!) * dx + (z - a[1]!) * dz) / lengthSquared))
        : 0
      if ((x - a[0]! - t * dx) ** 2 + (z - a[1]! - t * dz) ** 2 < clearanceSquared) return false
    }
    return true
  })
}
