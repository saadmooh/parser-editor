import type { GroundAreaNode } from '../ground-areas/domain/schema'
import { IrrigationHeadNode } from './schema'
import { DriplineNode } from './dripline'
import type { Point } from './ports'
import type { WateringMethod } from './method'

type PlanPoint = [number, number]
export type LayoutOptions = { method: WateringMethod; zone: string; zoneId?: string; radius: number; fullCircleFlow: number; rowSpacing: number; emitterSpacing: number; emitterFlow: number; profile?: 'custom' | 'hunter-mp1000' }
export type AreaLayout = { devices: (IrrigationHeadNode | DriplineNode)[]; uncovered: PlanPoint[]; coveragePercent: number; sampleSpacing: number; notes: string[] }
export function insideArea(point: PlanPoint, polygon: readonly PlanPoint[]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0])
    if (Math.abs(cross) < 1e-7 && point[0] >= Math.min(a[0], b[0]) - 1e-7 && point[0] <= Math.max(a[0], b[0]) + 1e-7 && point[1] >= Math.min(a[1], b[1]) - 1e-7 && point[1] <= Math.max(a[1], b[1]) + 1e-7) return true
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}
export function sprinklerCovers(head: IrrigationHeadNode, point: PlanPoint) {
  const dx = point[0] - head.position[0], dz = point[1] - head.position[2]
  if (Math.hypot(dx, dz) > head.radius + 1e-6) return false
  if (Math.hypot(dx, dz) < 1e-7 || head.arc >= 359.9) return true
  const angle = ((Math.atan2(dx, dz) - head.rotation[1]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  return angle <= head.arc * Math.PI / 180 + 1e-6
}
function sector(point: PlanPoint, outline: PlanPoint[], radius: number) {
  const n = 72, epsilon = Math.min(.05, radius / 20)
  const inside = Array.from({ length: n }, (_, i) => insideArea([point[0] + Math.sin(i * 2 * Math.PI / n) * epsilon, point[1] + Math.cos(i * 2 * Math.PI / n) * epsilon], outline))
  if (inside.every(Boolean)) return { arc: 360, rotation: 0 }
  let best = 0, start = 0
  for (let i = 0; i < n; i++) {
    let length = 0
    while (length < n && inside[(i + length) % n]) length++
    if (length > best) { best = length; start = i }
  }
  return { arc: Math.max(5, (best - 1) * 5), rotation: start * 2 * Math.PI / n }
}
/** Bounded, deterministic draft layout. Coverage is geometric, not water uniformity. */
export function layoutWateringArea(area: GroundAreaNode, options: LayoutOptions): AreaLayout {
  const polygon = area.outline.filter((p, i, all) => i === 0 || p[0] !== all[i - 1]![0] || p[1] !== all[i - 1]![1])
  if (!area.parentId || polygon.length < 3) throw new Error('Choose a completed area on a level.')
  const signedArea = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]!; return sum + p[0] * q[1] - q[0] * p[1] }, 0) / 2
  if (Math.abs(signedArea) < .01) throw new Error('Choose an area with a nonzero footprint.')
  const xs = polygon.map(p => p[0]), zs = polygon.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const width = maxX - minX, height = maxZ - minZ
  if (width * height > 250000) throw new Error('Split this area into smaller watering areas.')
  const devices: AreaLayout['devices'] = [], notes: string[] = []
  const common = { parentId: area.parentId, zone: options.zone, zoneId: options.zoneId }
  if (options.method === 'sprinkler') {
    if (!Number.isFinite(options.radius) || options.radius < .5 || options.radius > 30 || options.fullCircleFlow <= 0) throw new Error('Enter a reach of 0.5–30 m and positive sprinkler flow.')
    const points: PlanPoint[] = []
    const add = (point: PlanPoint) => { if (!points.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < .08)) points.push(point); if (points.length > 128) throw new Error('This layout needs more than 128 heads. Use a larger reach or split the area.') }
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!
      const segments = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / options.radius))
      if (segments > 128) throw new Error('Split the area or use a larger reach.')
      for (let j = 0; j < segments; j++) add([a[0] + (b[0] - a[0]) * j / segments, a[1] + (b[1] - a[1]) * j / segments])
    }
    const nx = Math.max(1, Math.ceil(width / options.radius)), nz = Math.max(1, Math.ceil(height / options.radius))
    if (nx * nz > 1024) throw new Error('Split the area or use a larger reach.')
    for (let x = 1; x < nx; x++) for (let z = 1; z < nz; z++) {
      const p: PlanPoint = [minX + width * x / nx, minZ + height * z / nz]
      if (insideArea(p, polygon) && !points.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < options.radius * .65)) add(p)
    }
    for (const [index, point] of points.entries()) {
      const { arc, rotation } = sector(point, polygon, options.radius)
      devices.push(IrrigationHeadNode.parse({ ...common, name: `${area.name || 'Lawn'} head ${index + 1}`, position: [point[0], area.elevation, point[1]], rotation: [0, rotation, 0], arc, radius: options.radius,
        flow: options.fullCircleFlow * arc / 360, profile: options.profile || 'custom', requiredPressureBar: options.profile === 'hunter-mp1000' ? 2.8 : 2.1 }))
    }
  } else {
    if (!Number.isFinite(options.rowSpacing) || options.rowSpacing < .1 || options.rowSpacing > 5) throw new Error('Use drip rows spaced 0.1–5 m apart.')
    const rows = Math.max(1, Math.ceil(height / options.rowSpacing))
    if (rows > 256) throw new Error('Split the bed into smaller drip areas.')
    for (let row = 0; row < rows; row++) {
      const z = minZ + height * (row + .5) / rows, cuts: number[] = []
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!
        if ((a[1] > z) !== (b[1] > z)) cuts.push(a[0] + (z - a[1]) / (b[1] - a[1]) * (b[0] - a[0]))
      }
      cuts.sort((a, b) => a - b)
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const length = cuts[i + 1]! - cuts[i]!, inset = Math.min(.1, length / 10)
        const segments = Math.ceil(length / 60)
        for (let segment = 0; segment < segments; segment++) {
          const x1 = cuts[i]! + length * segment / segments + inset, x2 = cuts[i]! + length * (segment + 1) / segments - inset
          if (x2 - x1 < .1) continue
          devices.push(DriplineNode.parse({ ...common, name: `${area.name || 'Bed'} drip row ${devices.length + 1}`, path: [[x1, area.elevation, z], [x2, area.elevation, z]], emitterSpacing: options.emitterSpacing, emitterFlow: options.emitterFlow }))
          if (devices.length > 256) throw new Error('Split the bed into smaller drip areas.')
        }
      }
    }
    notes.push('Rows are clipped to the bed. Wetting width and maximum lateral length need confirmation for your soil and tubing.')
  }
  if (!devices.length) throw new Error('No watering devices fit this area.')
  const spacing = Math.max(.15, Math.sqrt(width * height / 1600)), uncovered: PlanPoint[] = []
  let tested = 0
  const heads = devices.filter((d): d is IrrigationHeadNode => d.type === 'landscape:irrigation-head')
  for (let x = minX + spacing / 2; x < maxX; x += spacing) for (let z = minZ + spacing / 2; z < maxZ; z += spacing) {
    const p: PlanPoint = [x, z]
    if (!insideArea(p, polygon)) continue
    tested++
    if (heads.length && !heads.some(h => sprinklerCovers(h, p))) uncovered.push(p)
  }
  return { devices, uncovered, coveragePercent: heads.length && tested ? 100 * (1 - uncovered.length / tested) : 0, sampleSpacing: spacing, notes }
}
