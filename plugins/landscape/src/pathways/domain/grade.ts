import { distance, edgeCurve, sample, slice } from './curves'
import type { PathEdge, PathGraph, PathwayNode } from './schema'

/** Junction offsets are relative to the path's existing base elevation. */
export function edgeGradeProfile(path: PathwayNode, edge: PathEdge) {
  const start = path.vertices.find((vertex) => vertex.id === edge.from)
  const end = path.vertices.find((vertex) => vertex.id === edge.to)
  if (!start || !end) throw new Error('Pathway grade has a missing junction')
  const points = sample(edgeCurve(path, edge)).map((entry) => entry.point)
  const stations = [0]
  for (let index = 1; index < points.length; index++) stations.push(stations[index - 1]! + distance(points[index - 1]!, points[index]!))
  const length = stations[stations.length - 1] ?? 0
  const from = path.elevation + (start.elevationOffset ?? 0)
  const to = path.elevation + (end.elevationOffset ?? 0)
  const dx = end.point[0] - start.point[0], dz = end.point[1] - start.point[1]
  const bearingDegrees = Math.hypot(dx, dz) > 1e-5 ? ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 : null
  return {
    bearingDegrees,
    length, rise: to - from, slopePercent: length > 1e-5 ? 100 * (to - from) / length : null,
    samples: points.map((point, index) => ({ point, station: stations[index]!, elevation: from + (to - from) * (length > 1e-5 ? stations[index]! / length : 0) })),
  }
}

export function edgeElevationOffsetAt(graph: PathGraph, edge: PathEdge, t: number): number | undefined {
  const from = graph.vertices.find((vertex) => vertex.id === edge.from)?.elevationOffset
  const to = graph.vertices.find((vertex) => vertex.id === edge.to)?.elevationOffset
  if (from === undefined && to === undefined) return undefined
  const curve = edgeCurve(graph, edge)
  const lengthOf = (points: ReturnType<typeof sample>) => points.slice(1).reduce((total, entry, index) => total + distance(points[index]!.point, entry.point), 0)
  const length = lengthOf(sample(curve))
  const station = t <= 0 ? 0 : t >= 1 ? length : lengthOf(sample(slice(curve, 0, t)))
  return (from ?? 0) + ((to ?? 0) - (from ?? 0)) * (length > 1e-5 ? station / length : 0)
}
