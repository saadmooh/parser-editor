import type { IrrigationHeadNode } from './schema'
import polygonClipping from 'polygon-clipping'
import { coverageOutline } from './geometry'
import { type DriplineNode, driplineMetrics } from './dripline'
export function irrigationZones(heads: readonly IrrigationHeadNode[], driplines: readonly DriplineNode[] = []) {
  const zones = new Map<string, { name: string; heads: IrrigationHeadNode[]; driplines: DriplineNode[]; flow: number }>()
  for (const head of heads) {
    const name = head.zone.trim()
    const zone = zones.get(name) ?? { name, heads: [], driplines: [], flow: 0 }
    zone.heads.push(head)
    zone.flow += head.flow
    zones.set(name, zone)
  }
  for (const line of driplines) {
    const name = line.zone.trim()
    const zone = zones.get(name) ?? { name, heads: [], driplines: [], flow: 0 }
    zone.driplines.push(line); zone.flow += driplineMetrics(line).flow; zones.set(name, zone)
  }
  return [...zones.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Same-parent plan union. Nested parent transforms require a world-space resolver. */
export function zoneReachArea(heads: readonly IrrigationHeadNode[]): number | null {
  if (!heads.length) return 0
  if (new Set(heads.map((head) => head.parentId)).size > 1) return null
  const polygons = heads.map((head) => [coverageOutline(head).map(([x, z]) => [Math.round(x * 1e6) / 1e6, Math.round(z * 1e6) / 1e6] as [number, number])])
  let union: ReturnType<typeof polygonClipping.union>
  try { union = polygonClipping.union(polygons[0]!, ...polygons.slice(1)) }
  catch { return null } // A numerical clipping failure must not unload the watering panel.
  const ringArea = (ring: number[][]) => Math.abs(ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]!
    return sum + point[0]! * next[1]! - next[0]! * point[1]!
  }, 0)) / 2
  return union.reduce((total, polygon) => total + ringArea(polygon[0]!) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0), 0)
}
