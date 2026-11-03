import { describe, expect, test } from 'bun:test'
import { Box3, Mesh } from 'three'
import {
  distance,
  edgeCurve,
  evaluate,
  lerp,
  throughPoint,
  type Curve,
} from './curves'
import { addCurves, moveJunction, removeEdge, snapToNetwork } from './network'
import { PathwayNode, type PathGraph, type Point } from './schema'
import { buildOutline } from '../rendering/outline'
import { pavingJoints } from '../rendering/plan-finish'
import {
  buildPathwayGeometry,
  disposePathwayGeometry,
} from '../rendering/geometry'

const empty: PathGraph = { vertices: [], edges: [] }
const line = (a: Point, b: Point): Curve => [
  a,
  lerp(a, b, 1 / 3),
  lerp(a, b, 2 / 3),
  b,
]
const degreeAt = (graph: PathGraph, p: Point) => {
  const v = graph.vertices.find((v) => distance(v.point, p) < 1e-4)
  return graph.edges.filter((e) => e.from === v?.id || e.to === v?.id).length
}
const area = (graph: PathGraph) =>
  buildOutline(graph).reduce(
    (total, polygon) =>
      total +
      polygon.reduce((sum, ring, i) => {
        const signed =
          ring.reduce((a, p, j) => {
            const q = ring[(j + 1) % ring.length]!
            return a + p[0] * q[1] - q[0] * p[1]
          }, 0) / 2
        return sum + (i === 0 ? 1 : -1) * Math.abs(signed)
      }, 0),
    0,
  )

describe('Pathway connections', () => {
  test('an interior branch inherits the existing route grade without flattening its split', () => {
    const first = addCurves(empty, [line([0, 0], [10, 0])], 1)
    first.vertices[0]!.elevationOffset = 2
    first.vertices[1]!.elevationOffset = 4
    const joined = addCurves(first, [line([2.5, 3], [2.5, 0])], 1)
    const joint = joined.vertices.find((vertex) => distance(vertex.point, [2.5, 0]) < 1e-4)!
    expect(joint.elevationOffset).toBeCloseTo(2.5, 5)
    expect(degreeAt(joined, joint.point)).toBe(3)
    expect(first.vertices).toHaveLength(2)
    expect(joined.vertices.find((vertex) => vertex.id === first.vertices[1]!.id)?.elevationOffset).toBe(4)
    expect(moveJunction(joined, joint.id, [3, 0]).vertices.find((vertex) => vertex.id === joint.id)?.elevationOffset).toBe(2.5)
  })
  test('square corners have flush caps and a mitered outside turn', () => {
    const graph = addCurves(empty, [line([0, 0], [2, 0]), line([2, 0], [2, 2])], 1)
    const rounded = buildOutline({ ...graph, cornerStyle: 'round' })[0]![0]!
    const square = buildOutline({ ...graph, cornerStyle: 'square' })[0]![0]!
    expect(Math.min(...rounded.map((p) => p[0]))).toBeLessThan(-0.4)
    expect(Math.min(...square.map((p) => p[0]))).toBeCloseTo(0, 5)
    expect(square.some((p) => distance(p, [2.5, -0.5]) < 1e-4)).toBe(true)
    expect(pavingJoints(buildOutline({ ...graph, cornerStyle: 'square' }), 'brick')).not.toBe('')
    const longPath = addCurves(empty, [line([0, 0], [12, 0]), line([12, 0], [12, 8])], 1.2)
    expect(pavingJoints(buildOutline({ ...longPath, cornerStyle: 'square' }), 'brick')).not.toBe('')
  })
  test('new finish settings round-trip and legacy paths retain defaults', () => {
    const graph = addCurves(empty, [line([0, 0], [3, 0])], 1)
    const styled = PathwayNode.parse({ ...graph, finish: 'brick', cornerStyle: 'square' })
    expect(PathwayNode.parse(JSON.parse(JSON.stringify(styled))).finish).toBe('brick')
    const legacy = PathwayNode.parse(graph)
    expect(legacy.finish).toBe('concrete')
    expect(legacy.cornerStyle).toBe('square')
    expect(PathwayNode.parse({ ...graph, cornerStyle: 'round' }).cornerStyle).toBe('round')
    expect(legacy.defaultWidth).toBe(1.2)
  })
  test('separately drawn paths make one T junction and merged paving', () => {
    const first = addCurves(empty, [line([-4, 0], [4, 0])], 1)
    const joined = addCurves(first, [line([0, 4], [0, 0])], 1)
    expect(joined.edges).toHaveLength(3)
    expect(degreeAt(joined, [0, 0])).toBe(3)
    expect(buildOutline(joined)).toHaveLength(1)
    expect(area(joined)).toBeLessThan(
      area(first) + area(addCurves(empty, [line([0, 4], [0, 0])], 1)),
    )
  })
  test('Y branches of unequal widths share one junction', () => {
    let graph = addCurves(empty, [line([0, -4], [0, 0])], 2)
    graph = addCurves(graph, [line([0, 0], [-3, 4]), line([0, 0], [3, 4])], 0.8)
    expect(degreeAt(graph, [0, 0])).toBe(3)
    expect(buildOutline(graph)).toHaveLength(1)
    expect(new Set(graph.edges.map((e) => e.width)).size).toBe(2)
  })
  test('crossings split both routes', () => {
    const graph = addCurves(
      empty,
      [line([-3, 0], [3, 0]), line([0, -3], [0, 3])],
      1.2,
    )
    expect(graph.edges).toHaveLength(4)
    expect(degreeAt(graph, [0, 0])).toBe(4)
  })
  test('curved interior attachment preserves the original curve', () => {
    const curve = throughPoint([-4, 0], [0, 3], [4, 0])
    const graph = addCurves(empty, [curve], 1)
    const hit = snapToNetwork(graph, [0, 3.08], 0.2)!
    expect(distance(hit.point, [0, 3])).toBeLessThan(1e-4)
    const joined = addCurves(graph, [line([0, 6], hit.point)], 1)
    expect(degreeAt(joined, [0, 3])).toBe(3)
    const left = joined.edges.find(
      (e) => joined.vertices.find((v) => v.id === e.from)?.point[0] === -4,
    )!
    expect(
      distance(evaluate(edgeCurve(joined, left), 0.5), evaluate(curve, 0.25)),
    ).toBeLessThan(1e-4)
  })
  test('curved-to-curved crossing is refined on the original curves', () => {
    const a = throughPoint([-4, 0], [0, 3], [4, 0])
    const b = throughPoint([0, -2], [1, 1], [0, 5])
    const graph = addCurves(empty, [a, b], 0.7)
    expect(graph.edges).toHaveLength(4)
    const joint = graph.vertices.find((v) => degreeAt(graph, v.point) === 4)
    expect(joint).toBeDefined()
  })
  test('overlapping and reversed straight routes do not duplicate edges or area', () => {
    const first = addCurves(empty, [line([0, 0], [6, 0])], 1)
    const duplicate = addCurves(first, [line([6, 0], [0, 0])], 1)
    expect(duplicate.edges).toHaveLength(1)
    expect(area(duplicate)).toBeCloseTo(area(first), 5)
    const overlap = addCurves(first, [line([2, 0], [8, 0])], 1)
    expect(overlap.edges).toHaveLength(3)
    expect(buildOutline(overlap)).toHaveLength(1)
  })
  test('loop keeps its central hole', () => {
    const p: Point[] = [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
      [0, 0],
    ]
    const graph = addCurves(
      empty,
      p.slice(1).map((b, i) => line(p[i]!, b)),
      1,
    )
    expect(buildOutline(graph)).toHaveLength(1)
    expect(buildOutline(graph)[0]).toHaveLength(2)
  })
  test('nearby parallel routes do not acquire graph connections', () => {
    const graph = addCurves(
      empty,
      [line([0, 0], [5, 0]), line([0, 0.8], [5, 0.8])],
      0.5,
    )
    expect(graph.vertices).toHaveLength(4)
    expect(buildOutline(graph)).toHaveLength(2)
    expect(snapToNetwork(graph, [2, 2], 0.2)).toBeNull()
  })
  test('moving a shared junction updates all branches and removing one prunes unused vertices', () => {
    const graph = addCurves(
      empty,
      [line([-3, 0], [3, 0]), line([0, 3], [0, 0])],
      1,
    )
    const joint = graph.vertices.find((v) => degreeAt(graph, v.point) === 3)!
    const moved = moveJunction(graph, joint.id, [1, 1])
    expect(degreeAt(moved, [1, 1])).toBe(3)
    expect(degreeAt(graph, [0, 0])).toBe(3)
    const removed = removeEdge(moved, moved.edges.at(-1)!.id)
    expect(removed.edges).toHaveLength(2)
    expect(removed.vertices).toHaveLength(3)
  })
  test('zero-length input is ignored; tight curves and acute Y shapes remain finite', () => {
    expect(addCurves(empty, [line([0, 0], [0, 0])], 1).edges).toHaveLength(0)
    const graph = addCurves(
      empty,
      [
        throughPoint([0, 0], [0.3, 0.2], [0.6, 0]),
        line([0, 0], [4, 0.02]),
        line([0, 0], [4, -0.02]),
      ],
      2,
    )
    expect(buildOutline(graph).flat(3).every(Number.isFinite)).toBe(true)
  })
})

test('saved graph round-trips, and generated mesh matches footprint and elevation', () => {
  const node = PathwayNode.parse({
    ...addCurves(empty, [line([2, 3], [7, 3])], 1),
    elevation: 2,
    thickness: 0.1,
  })
  const restored = PathwayNode.parse(JSON.parse(JSON.stringify(node)))
  expect(restored).toEqual(node)
  const geometry = buildPathwayGeometry(restored)
  // The border cap deliberately projects beyond the paving by 8 mm.
  // Check the paving mesh itself against the authored footprint.
  const bounds = new Box3().setFromObject(geometry.children[0]!)
  expect(bounds.min.x).toBeCloseTo(2, 2)
  expect(bounds.min.z).toBeCloseTo(2.5, 2)
  expect(bounds.min.y).toBeCloseTo(2.005, 3)
  expect(bounds.max.y).toBeCloseTo(2.105, 3)
  geometry.traverse((object) => {
    if (object instanceof Mesh)
      expect(
        Array.from(object.geometry.getAttribute('position').array).every(
          Number.isFinite,
        ),
      ).toBe(true)
  })
  disposePathwayGeometry(geometry)
})
