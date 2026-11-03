import {
  derivative,
  distance,
  edgeCurve,
  EPSILON,
  evaluate,
  lerp,
  nearest,
  sample,
  slice,
  type Curve,
} from './curves'
import type { PathEdge, PathGraph, PathVertex, Point } from './schema'
import { edgeElevationOffsetAt } from './grade'

const id = () => crypto.randomUUID()
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]

export class PathwayGradeConflictError extends Error {
  constructor() {
    super('Existing walkways meet at different elevations. Match their junction grades before joining them.')
    this.name = 'PathwayGradeConflictError'
  }
}

function intersections(a: Curve, b: Curve) {
  const hits: [number, number][] = []
  const sa = sample(a),
    sb = sample(b)
  for (let i = 1; i < sa.length; i++) {
    for (let j = 1; j < sb.length; j++) {
      const a0 = sa[i - 1]!,
        a1 = sa[i]!,
        b0 = sb[j - 1]!,
        b1 = sb[j]!
      const r = subtract(a1.point, a0.point),
        s = subtract(b1.point, b0.point)
      const determinant = cross(r, s)
      if (Math.abs(determinant) < 1e-12) continue
      const offset = subtract(b0.point, a0.point)
      const u = cross(offset, s) / determinant,
        v = cross(offset, r) / determinant
      if (u < -EPSILON || u > 1 + EPSILON || v < -EPSILON || v > 1 + EPSILON)
        continue
      let t = a0.t + (a1.t - a0.t) * u,
        q = b0.t + (b1.t - b0.t) * v
      // Refine the polyline hit on the original curves before exact subdivision.
      for (let k = 0; k < 12; k++) {
        const delta = subtract(evaluate(a, t), evaluate(b, q))
        const da = derivative(a, t),
          db = derivative(b, q),
          det = cross(da, db)
        if (Math.abs(det) < 1e-12) break
        t -= cross(delta, db) / det
        q -= cross(delta, da) / det
      }
      if (
        t >= -EPSILON &&
        t <= 1 + EPSILON &&
        q >= -EPSILON &&
        q <= 1 + EPSILON &&
        distance(evaluate(a, t), evaluate(b, q)) < EPSILON
      ) {
        hits.push([Math.max(0, Math.min(1, t)), Math.max(0, Math.min(1, q))])
      }
    }
  }
  // Endpoint-on-edge and collinear overlaps need no line crossing.
  for (const t of [0, 1]) {
    const hit = nearest(b, evaluate(a, t))
    if (hit.distance < EPSILON) hits.push([t, hit.t])
    const other = nearest(a, evaluate(b, t))
    if (other.distance < EPSILON) hits.push([other.t, t])
  }
  return hits
}

export function snapToNetwork(graph: PathGraph, point: Point, radius: number) {
  let best: {
    point: Point
    distance: number
    vertexId?: string
    edgeId?: string
    t?: number
  } | null = null
  for (const vertex of graph.vertices) {
    const d = distance(vertex.point, point)
    if (d <= radius && (!best || d < best.distance))
      best = { point: vertex.point, distance: d, vertexId: vertex.id }
  }
  // Prefer a junction over an adjacent interior target within the capture radius.
  if (best) return best
  for (const edge of graph.edges) {
    const hit = nearest(edgeCurve(graph, edge), point)
    if (hit.distance <= radius && (!best || hit.distance < best.distance))
      best = { ...hit, edgeId: edge.id }
  }
  return best
}

export function addCurves(
  graph: PathGraph,
  curves: Curve[],
  width: number,
  shape?: PathEdge['shape'],
): PathGraph {
  const vertices: PathVertex[] = graph.vertices.map((v) => ({
    ...v,
    point: [...v.point],
  }))
  const vertexAt = (point: Point, elevationOffset?: number) => {
    let vertex = vertices.find((v) => distance(v.point, point) < EPSILON)
    if (!vertex) {
      vertex = { id: id(), point }
      vertices.push(vertex)
    }
    // Existing authored junctions win; a new branch inherits the route it joins.
    if (vertex.elevationOffset === undefined && elevationOffset !== undefined)
      vertex.elevationOffset = elevationOffset
    return vertex.id
  }
  const edges = [...graph.edges]
  for (const c of curves) {
    if (sample(c).every((p) => distance(p.point, c[0]) < EPSILON)) continue
    edges.push({
      id: id(),
      from: vertexAt(c[0]),
      to: vertexAt(c[3]),
      controls: [c[1], c[2]],
      shape: shape ?? (distance(c[1], lerp(c[0], c[3], 1 / 3)) < 1e-6 &&
        distance(c[2], lerp(c[0], c[3], 2 / 3)) < 1e-6 ? 'straight' : 'spline'),
      width,
    })
  }
  const full = { vertices, edges }
  const data = edges.map((edge) => ({
    edge,
    curve: edgeCurve(full, edge),
    cuts: [0, 1],
  }))
  // Freeze profiles before assigning shared junctions so processing order cannot
  // change interpolation on later portions of the same original edge.
  const gradeGraph = { vertices: vertices.map((vertex) => ({ ...vertex })), edges }
  const existingEdges = new Set(graph.edges.map((edge) => edge.id))
  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      for (const [t, u] of intersections(data[i]!.curve, data[j]!.curve)) {
        // The graph has one height per junction: never silently choose one of
        // two previously authored routes when merging their crossing.
        if (existingEdges.has(data[i]!.edge.id) && existingEdges.has(data[j]!.edge.id)) {
          const a = edgeElevationOffsetAt(gradeGraph, data[i]!.edge, t) ?? 0
          const b = edgeElevationOffsetAt(gradeGraph, data[j]!.edge, u) ?? 0
          if (Math.abs(a - b) > 0.01) throw new PathwayGradeConflictError()
        }
        data[i]!.cuts.push(t)
        data[j]!.cuts.push(u)
      }
    }
  }
  const result: PathEdge[] = []
  for (const { edge, curve, cuts } of data) {
    const sorted = cuts
      .sort((a, b) => a - b)
      .filter((t, i, all) => i === 0 || t - all[i - 1]! > 1e-6)
    for (let i = 1; i < sorted.length; i++) {
      const c = slice(curve, sorted[i - 1]!, sorted[i]!)
      if (sample(c).every((p) => distance(p.point, c[0]) < EPSILON)) continue
      const from = vertexAt(c[0], edgeElevationOffsetAt(gradeGraph, edge, sorted[i - 1]!)),
        to = vertexAt(c[3], edgeElevationOffsetAt(gradeGraph, edge, sorted[i]!))
      const existing = result.find((e) => {
        const same = e.from === from && e.to === to
        const reverse = e.from === to && e.to === from
        if (!same && !reverse) return false
        const ec = edgeCurve({ vertices, edges: result }, e)
        return (
          distance(ec[same ? 1 : 2], c[1]) < EPSILON &&
          distance(ec[same ? 2 : 1], c[2]) < EPSILON
        )
      })
      if (existing) existing.width = Math.max(existing.width, edge.width)
      else
        result.push({
          ...edge,
          id: i === 1 ? edge.id : id(),
          from,
          to,
          controls: [c[1], c[2]],
        })
    }
  }
  const used = new Set(result.flatMap((e) => [e.from, e.to]))
  return { vertices: vertices.filter((v) => used.has(v.id)), edges: result }
}

export function moveJunction(
  graph: PathGraph,
  vertexId: string,
  point: Point,
): PathGraph {
  const vertex = graph.vertices.find((v) => v.id === vertexId)
  if (!vertex) return graph
  const original = new Map(graph.vertices.map((v) => [v.id, v.point]))
  const straight = (edge: PathEdge) => {
    if (edge.shape) return edge.shape === 'straight'
    const from = original.get(edge.from), to = original.get(edge.to)
    if (!from || !to) return false
    if (!edge.controls) return true
    return distance(edge.controls[0], lerp(from, to, 1 / 3)) < 1e-6 &&
      distance(edge.controls[1], lerp(from, to, 2 / 3)) < 1e-6
  }
  // Duct-style axis decomposition: an along-leg motion stretches the leg;
  // the across-leg component carries its far joint, then continues outward.
  const deltas = new Map<string, Point>([[vertexId, subtract(point, vertex.point)]])
  const queue = [vertexId]
  while (queue.length) {
    const current = queue.shift()!
    const delta = deltas.get(current)!
    for (const edge of graph.edges) {
      if (!straight(edge) || edge.from !== current && edge.to !== current) continue
      const other = edge.from === current ? edge.to : edge.from
      if (deltas.has(other)) continue
      const a = original.get(current)!, b = original.get(other)!
      const vx = b[0] - a[0], vz = b[1] - a[1]
      const length = Math.hypot(vx, vz)
      if (length < EPSILON) continue
      const ux = vx / length, uz = vz / length
      const along = delta[0] * ux + delta[1] * uz
      deltas.set(other, [delta[0] - along * ux, delta[1] - along * uz])
      queue.push(other)
    }
  }
  const movedPoint = (id: string): Point => {
    const p = original.get(id)!, delta = deltas.get(id) ?? [0, 0]
    return [p[0] + delta[0], p[1] + delta[1]]
  }
  return {
    vertices: graph.vertices.map((v) =>
      deltas.has(v.id) ? { ...v, point: movedPoint(v.id) } : v,
    ),
    edges: graph.edges.map((e) => {
      const from = movedPoint(e.from), to = movedPoint(e.to)
      if (straight(e)) return { ...e, controls: [lerp(from, to, 1 / 3), lerp(from, to, 2 / 3)] as [Point, Point] }
      return { ...e, controls: e.controls ? [
        [e.controls[0][0] + (deltas.get(e.from)?.[0] ?? 0), e.controls[0][1] + (deltas.get(e.from)?.[1] ?? 0)],
        [e.controls[1][0] + (deltas.get(e.to)?.[0] ?? 0), e.controls[1][1] + (deltas.get(e.to)?.[1] ?? 0)],
      ] as [Point, Point] : undefined }
    }),
  }
}

export function removeEdge(graph: PathGraph, edgeId: string): PathGraph {
  const edges = graph.edges.filter((e) => e.id !== edgeId)
  const used = new Set(edges.flatMap((e) => [e.from, e.to]))
  return { edges, vertices: graph.vertices.filter((v) => used.has(v.id)) }
}
