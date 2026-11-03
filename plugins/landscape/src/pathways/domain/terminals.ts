import { derivative, distance, edgeCurve, sample } from './curves'
import { moveJunction } from './network'
import type { PathGraph, Point } from './schema'

export type PathTerminal = {
  vertexId: string
  edgeId: string
  point: Point
  direction: Point
  angle: number
  maxRetraction: number
}

/** Only degree-one graph vertices are extendable; junctions are never arrows. */
export function pathTerminalEnds(graph: PathGraph): PathTerminal[] {
  return graph.vertices.flatMap((vertex) => {
    const incident = graph.edges.filter((edge) => edge.from === vertex.id || edge.to === vertex.id)
    if (incident.length !== 1) return []
    const edge = incident[0]!
    const atStart = edge.from === vertex.id
    const curve = edgeCurve(graph, edge)
    const tangent = derivative(curve, atStart ? 0 : 1)
    const outward: Point = atStart ? [-tangent[0], -tangent[1]] : tangent
    let magnitude = Math.hypot(...outward)
    if (magnitude < 1e-6) {
      const samples = sample(curve)
      const toward = atStart ? samples[1]?.point : samples.at(-2)?.point
      if (!toward) return []
      outward[0] = vertex.point[0] - toward[0]
      outward[1] = vertex.point[1] - toward[1]
      magnitude = Math.hypot(...outward)
    }
    if (magnitude < 1e-6) return []
    const direction: Point = [outward[0] / magnitude, outward[1] / magnitude]
    const points = sample(curve)
    const length = points.slice(1).reduce((total, current, index) =>
      total + distance(points[index]!.point, current.point), 0)
    return [{ vertexId: vertex.id, edgeId: edge.id, point: vertex.point,
      direction, angle: Math.atan2(direction[1], direction[0]),
      maxRetraction: Math.max(0, length - 0.1) }]
  })
}

/** Preserve the edge and its tangent controls while moving one free end. */
export function movePathTerminal(graph: PathGraph, vertexId: string, point: Point): PathGraph | null {
  if (!pathTerminalEnds(graph).some((terminal) => terminal.vertexId === vertexId)) return null
  return moveJunction(graph, vertexId, point)
}

/** Turn a snapped endpoint so its final approach meets the hardscape edge squarely. */
export function alignPathTerminalToEdge(graph: PathGraph, vertexId: string,
  edgeDirection: Point): PathGraph {
  const vertex = graph.vertices.find((candidate) => candidate.id === vertexId)
  const edge = graph.edges.find((candidate) => candidate.from === vertexId || candidate.to === vertexId)
  if (!vertex || !edge) return graph
  const controls = edgeCurve(graph, edge)
  const handleIndex = edge.from === vertexId ? 1 : 2
  const handle = controls[handleIndex]!
  const normal: Point = [-edgeDirection[1], edgeDirection[0]]
  const amount = (handle[0] - vertex.point[0]) * normal[0] +
    (handle[1] - vertex.point[1]) * normal[1]
  const aligned: Point = [vertex.point[0] + normal[0] * amount,
    vertex.point[1] + normal[1] * amount]
  const nextControls: [Point, Point] = [controls[1], controls[2]]
  nextControls[handleIndex - 1] = aligned
  return { ...graph, edges: graph.edges.map((candidate) =>
    candidate.id === edge.id ? { ...candidate, controls: nextControls } : candidate) }
}

/** Reshape an end, bend, or branch while keeping every incident edge attached. */
export function movePathJunction(graph: PathGraph, vertexId: string, point: Point): PathGraph | null {
  const vertex = graph.vertices.find((item) => item.id === vertexId)
  if (!vertex || !graph.edges.some((edge) => edge.from === vertexId || edge.to === vertexId)) return null
  for (const edge of graph.edges) {
    if (edge.from !== vertexId && edge.to !== vertexId) continue
    const otherId = edge.from === vertexId ? edge.to : edge.from
    const other = graph.vertices.find((item) => item.id === otherId)
    if (!other || distance(point, other.point) < 0.1) return null
  }
  return moveJunction(graph, vertexId, point)
}
