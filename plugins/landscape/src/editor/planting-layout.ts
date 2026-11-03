import type { Point, PathwayNode } from '../pathways/domain/schema'
import { distance, edgeCurve, lerp, projectSegment, sample } from '../pathways/domain/curves'
import { edgeGradeProfile } from '../pathways/domain/grade'

export type PlantingOptions = { spacing: number; setback: number; seed: number; natural: boolean; limit: number }
export type PlantingLayout = { points: Point[]; truncated: boolean; elevationOffsets?: number[] }

export function containsPoint(point: Point, outline: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function collector(options: PlantingOptions, occupied: readonly Point[]) {
  const spacing = Math.max(0.25, options.spacing)
  const points: Point[] = []
  // Spatial bins avoid quadratic collision checks for dense beds.
  const bins = new Map<string, Point[]>()
  const key = (x: number, z: number) => `${x}:${z}`
  const insert = (point: Point) => {
    const id = key(Math.floor(point[0] / spacing), Math.floor(point[1] / spacing))
    const bucket = bins.get(id) ?? []; bucket.push(point); bins.set(id, bucket)
  }
  occupied.forEach(insert)
  const add = (point: Point) => {
    const x = Math.floor(point[0] / spacing), z = Math.floor(point[1] / spacing)
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (bins.get(key(x + dx, z + dz))?.some((other) => distance(point, other) < spacing - 1e-8)) return false
    }
    points.push(point); insert(point); return true
  }
  return { spacing, points, add }
}

function random(seed: number) {
  let value = seed >>> 0
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296 }
}

export function areaPlanting(outline: readonly Point[], options: PlantingOptions, occupied: readonly Point[] = []): PlantingLayout {
  if (outline.length < 3) return { points: [], truncated: false }
  const { spacing, points, add } = collector(options, occupied)
  const xs = outline.map((point) => point[0]), zs = outline.map((point) => point[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const rng = random(options.seed)
  let attempts = 0
  for (let z = minZ + spacing / 2; z < maxZ; z += spacing) for (let x = minX + spacing / 2; x < maxX; x += spacing) {
    if (++attempts > 100000) return { points, truncated: true }
    const point: Point = options.natural ? [x + (rng() - 0.5) * spacing * 0.7, z + (rng() - 0.5) * spacing * 0.7] : [x, z]
    if (!containsPoint(point, outline) || outline.some((a, index) => distance(point, projectSegment(point, a, outline[(index + 1) % outline.length]!).point) < options.setback)) continue
    if (points.length >= options.limit) return { points, truncated: true }
    add(point)
  }
  return { points, truncated: false }
}

export function pathPlanting(path: PathwayNode, options: PlantingOptions, side: 'left' | 'right' | 'both', occupied: readonly Point[] = []): PlantingLayout {
  const { spacing, points, add } = collector(options, occupied)
  const elevationOffsets: number[] = []
  const result = (truncated: boolean): PlantingLayout => ({ points, truncated, elevationOffsets })
  let attempts = 0
  for (const edge of path.edges) {
    const grade = edgeGradeProfile(path, edge)
    const line = sample(edgeCurve(path, edge)).map((entry) => entry.point)
    let next = spacing / 2, traversed = 0
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!, b = line[i]!, length = distance(a, b)
      if (length < 1e-8) continue
      while (next <= traversed + length) {
        if (++attempts > 100000) return result(true)
        const center = lerp(a, b, (next - traversed) / length)
        const offset = edge.width / 2 + Math.max(0, options.setback)
        for (const sign of side === 'both' ? [1, -1] : [side === 'left' ? 1 : -1]) {
          if (points.length >= options.limit) return result(true)
          if (add([center[0] - (b[1] - a[1]) / length * offset * sign, center[1] + (b[0] - a[0]) / length * offset * sign]))
            elevationOffsets.push((grade.samples[0]?.elevation ?? path.elevation) - path.elevation + grade.rise * next / Math.max(1e-8, grade.length))
        }
        next += spacing
      }
      traversed += length
    }
  }
  return result(false)
}
