import { expect, test } from 'bun:test'
import { addCurves } from './network'
import { edgeCurve, lerp } from './curves'
import type { Curve } from './curves'
import { movePathJunction, movePathTerminal, pathTerminalEnds } from './terminals'
import type { PathGraph, Point } from './schema'

const segment = (a: Point, b: Point) =>
  [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b] as Curve

test('extension arrows appear only at open ends, and moving one keeps the junction fixed', () => {
  let graph: PathGraph = addCurves({ vertices: [], edges: [] }, [segment([0, 0], [4, 0])], 1)
  graph = addCurves(graph, [segment([4, 0], [4, 4]), segment([4, 0], [8, 0])], 1)
  const ends = pathTerminalEnds(graph)
  expect(ends).toHaveLength(3)
  expect(ends.map((end) => end.point)).toEqual(expect.arrayContaining([[0, 0], [4, 4], [8, 0]]))
  const end = ends.find((item) => item.point[0] === 8)!
  expect(end.direction).toEqual([1, 0])
  const moved = movePathTerminal(graph, end.vertexId, [10, 0])!
  expect(moved.vertices.find((vertex) => vertex.id === end.vertexId)?.point).toEqual([10, 0])
  expect(moved.vertices.find((vertex) => vertex.point[0] === 4 && vertex.point[1] === 0)).toBeDefined()
  expect(movePathTerminal(graph, graph.vertices.find((vertex) => vertex.point[0] === 4 && vertex.point[1] === 0)!.id, [5, 0])).toBeNull()
})

test('curved end arrow follows its local tangent', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [[
    [0, 0], [1, 0], [3, 3], [4, 3],
  ]], 1)
  const end = pathTerminalEnds(graph).find((item) => item.point[0] === 4)!
  expect(end.direction).toEqual([1, 0])
})

test('moving an L bend or T junction reshapes every attached leg', () => {
  let graph: PathGraph = addCurves({ vertices: [], edges: [] }, [
    segment([0, 0], [4, 0]), segment([4, 0], [4, 4]),
    segment([4, 0], [8, 0]),
  ], 1)
  const center = graph.vertices.find((vertex) => vertex.point[0] === 4 && vertex.point[1] === 0)!
  graph = movePathJunction(graph, center.id, [5, 1])!
  expect(graph.vertices.find((vertex) => vertex.id === center.id)?.point).toEqual([5, 1])
  expect(graph.edges.filter((edge) => edge.from === center.id || edge.to === center.id)).toHaveLength(3)
  expect(graph.vertices.find((vertex) => vertex.point[0] === 0 && vertex.point[1] === 1)).toBeDefined()
  expect(graph.vertices.find((vertex) => vertex.point[0] === 5 && vertex.point[1] === 4)).toBeDefined()
  for (const edge of graph.edges) {
    const curve = edgeCurve(graph, edge)
    expect(curve[1]).toEqual(lerp(curve[0], curve[3], 1 / 3))
    expect(curve[2]).toEqual(lerp(curve[0], curve[3], 2 / 3))
  }
  expect(movePathJunction(graph, center.id, [0, 1])).toBeNull()
})

test('moving a spline point keeps its Bézier bend and does not carry the far end', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [[
    [0, 0], [1, 2], [3, 2], [4, 0],
  ]], 1)
  const start = graph.vertices.find((vertex) => vertex.point[0] === 0)!
  const moved = movePathJunction(graph, start.id, [0, 1])!
  const curve = edgeCurve(moved, moved.edges[0]!)
  expect(curve[0]).toEqual([0, 1])
  expect(curve[1]).toEqual([1, 3])
  expect(curve[2]).toEqual([3, 2])
  expect(curve[3]).toEqual([4, 0])
})

test('dragging a straight endpoint across the run carries connected straight legs', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [
    segment([0, 0], [4, 0]), segment([4, 0], [4, 4]),
  ], 1)
  const start = graph.vertices.find((vertex) => vertex.point[0] === 0)!
  const moved = movePathJunction(graph, start.id, [1, 1])!
  expect(moved.vertices.find((vertex) => vertex.id === start.id)?.point).toEqual([1, 1])
  expect(moved.vertices.find((vertex) => vertex.point[0] === 4 && vertex.point[1] === 1)).toBeDefined()
  expect(moved.vertices.find((vertex) => vertex.point[0] === 4 && vertex.point[1] === 4)).toBeDefined()
  for (const edge of moved.edges) {
    const curve = edgeCurve(moved, edge)
    expect(curve[1]).toEqual(lerp(curve[0], curve[3], 1 / 3))
    expect(curve[2]).toEqual(lerp(curve[0], curve[3], 2 / 3))
  }
  expect(moved.edges.every((edge) => edge.shape === 'straight')).toBe(true)
  const again = movePathJunction(moved, start.id, [2, 2])!
  for (const edge of again.edges) {
    const curve = edgeCurve(again, edge)
    expect(curve[1]).toEqual(lerp(curve[0], curve[3], 1 / 3))
    expect(curve[2]).toEqual(lerp(curve[0], curve[3], 2 / 3))
  }
})

test('a two-point spline keeps local spline editing after its first drag', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [segment([0, 0], [4, 0])], 1, 'spline')
  const start = graph.vertices.find((vertex) => vertex.point[0] === 0)!
  const moved = movePathJunction(graph, start.id, [0, 1])!
  const curve = edgeCurve(moved, moved.edges[0]!)
  expect(moved.edges[0]!.shape).toBe('spline')
  expect(curve[1]).toEqual([4 / 3, 1])
  expect(curve[3]).toEqual([4, 0])
})
