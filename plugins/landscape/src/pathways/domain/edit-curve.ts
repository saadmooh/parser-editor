import { distance, edgeCurve, evaluate, lerp, split } from './curves'
import { edgeElevationOffsetAt } from './grade'
import type { PathEdge, PathGraph, PathVertex, Point } from './schema'

export type CurveSide = 'from' | 'to'

export function isCurvedPathEdge(graph: PathGraph, edge: PathEdge): boolean {
  if (edge.shape) return edge.shape === 'spline'
  const curve = edgeCurve(graph, edge)
  return distance(curve[1], lerp(curve[0], curve[3], 1 / 3)) > 1e-6 ||
    distance(curve[2], lerp(curve[0], curve[3], 2 / 3)) > 1e-6
}

/** Keep controls legible when automatic intersections create many tiny edges. */
export function showPathEdgeControls(graph: PathGraph & { showAllEditPoints?: boolean }, edge: PathEdge): boolean {
  if (graph.showAllEditPoints) return true
  const curve = edgeCurve(graph, edge)
  return distance(curve[0], curve[3]) >= Math.max(0.35, edge.width * 0.35)
}

/** Leave endpoints and branches visible, and space controls in dense networks. */
export function visiblePathVertices(graph: PathGraph & { showAllEditPoints?: boolean }): PathVertex[] {
  if (graph.showAllEditPoints || graph.vertices.length <= 12) return graph.vertices
  const degree = (id: string) => graph.edges.filter((edge) => edge.from === id || edge.to === id).length
  const important = graph.vertices.filter((vertex) => degree(vertex.id) !== 2)
  const visible = [...important]
  for (const vertex of graph.vertices) {
    if (degree(vertex.id) !== 2) continue
    if (visible.every((shown) => distance(shown.point, vertex.point) >= 0.75)) visible.push(vertex)
  }
  return visible
}

/** Edit one cubic arm without disturbing the other arms of a branch. */
export function movePathCurveHandle(graph: PathGraph, edgeId: string, side: CurveSide, point: Point): PathGraph | null {
  const edge = graph.edges.find((item) => item.id === edgeId)
  if (!edge || !isCurvedPathEdge(graph, edge) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null
  const curve = edgeCurve(graph, edge)
  const vertexId = side === 'from' ? edge.from : edge.to
  const anchor = graph.vertices.find((vertex) => vertex.id === vertexId)!
  const incident = graph.edges.filter((item) => item.from === vertexId || item.to === vertexId)
  const opposite = incident.length === 2 && anchor.curveMode !== 'corner'
    ? incident.find((item) => item.id !== edge.id && isCurvedPathEdge(graph, item)) : undefined
  return { vertices: graph.vertices, edges: graph.edges.map((item) => {
    if (item.id === edgeId) return { ...item, controls: [
      side === 'from' ? point : curve[1], side === 'to' ? point : curve[2],
    ] as [Point, Point], shape: 'spline' as const }
    if (item.id !== opposite?.id) return item
    const old = edgeCurve(graph, item)
    const otherSide = item.from === vertexId ? 'from' : 'to'
    const oldControl = otherSide === 'from' ? old[1] : old[2]
    const length = Math.hypot(oldControl[0] - anchor.point[0], oldControl[1] - anchor.point[1])
    const dx = point[0] - anchor.point[0], dz = point[1] - anchor.point[1]
    const size = Math.hypot(dx, dz)
    if (size < 1e-8) return item
    const reflected: Point = [anchor.point[0] - dx * length / size, anchor.point[1] - dz * length / size]
    return { ...item, controls: [
      otherSide === 'from' ? reflected : old[1], otherSide === 'to' ? reflected : old[2],
    ] as [Point, Point] }
  }) }
}

export function setPathJunctionMode(graph: PathGraph, vertexId: string, mode: 'smooth' | 'corner'): PathGraph {
  const next = { vertices: graph.vertices.map((vertex) => vertex.id === vertexId
    ? { ...vertex, curveMode: mode } : vertex), edges: graph.edges }
  if (mode !== 'smooth') return next
  const incident = graph.edges.filter((edge) => edge.from === vertexId || edge.to === vertexId)
  if (incident.length !== 2 || incident.some((edge) => !isCurvedPathEdge(graph, edge))) return next
  const reference = incident[0]!
  const side = reference.from === vertexId ? 'from' : 'to'
  const curve = edgeCurve(next, reference)
  return movePathCurveHandle(next, reference.id, side, side === 'from' ? curve[1] : curve[2]) ?? next
}

/** De Casteljau subdivision preserves the visible route when adding an anchor. */
export function insertPathCurvePoint(graph: PathGraph, edgeId: string, t = 0.5): PathGraph | null {
  const edge = graph.edges.find((item) => item.id === edgeId)
  if (!edge || t <= 0 || t >= 1) return null
  const [left, right] = split(edgeCurve(graph, edge), t)
  const vertexId = crypto.randomUUID()
  const shape = isCurvedPathEdge(graph, edge) ? 'spline' : 'straight'
  return {
    vertices: [...graph.vertices, { id: vertexId, point: evaluate(edgeCurve(graph, edge), t), elevationOffset: edgeElevationOffsetAt(graph, edge, t) }],
    edges: graph.edges.flatMap((item) => item.id !== edgeId ? [item] : [
      { ...item, to: vertexId, controls: [left[1], left[2]] as [Point, Point] },
      { ...item, id: crypto.randomUUID(), from: vertexId, controls: [right[1], right[2]] as [Point, Point], shape },
    ]),
  }
}

/** Drag a newly inserted anchor locally, without propagating through straight legs. */
export function moveInsertedPathPoint(graph: PathGraph, vertexId: string, point: Point): PathGraph | null {
  const vertex = graph.vertices.find((item) => item.id === vertexId)
  if (!vertex) return null
  const delta: Point = [point[0] - vertex.point[0], point[1] - vertex.point[1]]
  const vertices = graph.vertices.map((item) => item.id === vertexId ? { ...item, point } : item)
  const moved = { ...graph, vertices }
  return { vertices, edges: graph.edges.map((edge) => {
    if (edge.from !== vertexId && edge.to !== vertexId) return edge
    if (!isCurvedPathEdge(graph, edge)) {
      const curve = edgeCurve(moved, edge)
      return { ...edge, controls: [lerp(curve[0], curve[3], 1 / 3),
        lerp(curve[0], curve[3], 2 / 3)] as [Point, Point], shape: 'straight' as const }
    }
    const curve = edgeCurve(graph, edge)
    return { ...edge, controls: [
      edge.from === vertexId ? [curve[1][0] + delta[0], curve[1][1] + delta[1]] : curve[1],
      edge.to === vertexId ? [curve[2][0] + delta[0], curve[2][1] + delta[1]] : curve[2],
    ] as [Point, Point] }
  }) }
}
