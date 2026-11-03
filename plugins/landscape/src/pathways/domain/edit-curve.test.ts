import { expect, test } from 'bun:test'
import { addCurves } from './network'
import { distance, edgeCurve, evaluate, throughPoint } from './curves'
import { insertPathCurvePoint, moveInsertedPathPoint, movePathCurveHandle,
  setPathJunctionMode, visiblePathVertices } from './edit-curve'
import { buildPathwayFloorplan } from '../rendering/floorplan'
import { PathwayNode } from './schema'
import type { GeometryContext } from '@pascal-app/core'

const empty = { vertices: [], edges: [] }

test('moving one pathway curve handle changes only that cubic arm', () => {
  const graph = addCurves(empty, [throughPoint([0, 0], [2, 2], [4, 0])], 1, 'spline')
  const edge = graph.edges[0]!
  const before = edgeCurve(graph, edge)
  const moved = movePathCurveHandle(graph, edge.id, 'from', [0.5, 3])!
  const after = edgeCurve(moved, moved.edges[0]!)
  expect(after[0]).toEqual(before[0])
  expect(after[1]).toEqual([0.5, 3])
  expect(after[2]).toEqual(before[2])
  expect(after[3]).toEqual(before[3])
})

test('inserting a pathway anchor preserves a cubic and its width', () => {
  const graph = addCurves(empty, [throughPoint([0, 0], [2, 2], [4, 0])], 1.4, 'spline')
  const original = edgeCurve(graph, graph.edges[0]!)
  const inserted = insertPathCurvePoint(graph, graph.edges[0]!.id)!
  expect(inserted.edges).toHaveLength(2)
  expect(inserted.edges.map((edge) => edge.width)).toEqual([1.4, 1.4])
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const part = t <= 0.5 ? edgeCurve(inserted, inserted.edges[0]!) : edgeCurve(inserted, inserted.edges[1]!)
    expect(distance(evaluate(original, t), evaluate(part, t <= 0.5 ? t * 2 : (t - 0.5) * 2))).toBeLessThan(1e-8)
  }
})

test('smooth curve junction mirrors the neighboring arm; corner leaves it free', () => {
  const graph = addCurves(empty, [
    throughPoint([0, 0], [1, 1], [2, 0]),
    throughPoint([2, 0], [3, -1], [4, 0]),
  ], 1, 'spline')
  const middle = graph.vertices.find((vertex) => vertex.point[0] === 2)!
  const arriving = graph.edges.find((edge) => edge.to === middle.id)!
  const leaving = graph.edges.find((edge) => edge.from === middle.id)!
  const smooth = movePathCurveHandle(graph, arriving.id, 'to', [1.5, 2])!
  const other = edgeCurve(smooth, smooth.edges.find((edge) => edge.id === leaving.id)!)
  expect(other[1][0]).toBeGreaterThan(2)
  expect(other[1][1]).toBeLessThan(0)
  const corner = setPathJunctionMode(graph, middle.id, 'corner')
  const moved = movePathCurveHandle(corner, arriving.id, 'to', [1.5, 2])!
  expect(moved.edges.find((edge) => edge.id === leaving.id)?.controls).toEqual(leaving.controls)
})

test('selected walkway exposes curve arms and insertion in plan view', () => {
  const graph = addCurves(empty, [throughPoint([0, 0], [2, 2], [4, 0])], 1, 'spline')
  const plan = buildPathwayFloorplan(PathwayNode.parse(graph),
    { viewState: { selected: true } } as GeometryContext)
  const rendered = JSON.stringify(plan)
  expect(rendered).toContain('pathway-move-curve-handle')
  expect(rendered).toContain('pathway-insert-point')
})

test('dragging an inserted straight point bends only its two adjacent legs', () => {
  const graph = addCurves(empty, [[[0, 0], [1, 0], [2, 0], [3, 0]]], 1, 'straight')
  const inserted = insertPathCurvePoint(graph, graph.edges[0]!.id)!
  const vertex = inserted.vertices.at(-1)!
  const moved = moveInsertedPathPoint(inserted, vertex.id, [vertex.point[0], 1])!
  expect(moved.vertices.find((item) => item.id === graph.vertices[0]!.id)?.point).toEqual([0, 0])
  expect(moved.vertices.find((item) => item.id === graph.vertices[1]!.id)?.point).toEqual([3, 0])
  expect(moved.vertices.find((item) => item.id === vertex.id)?.point).toEqual([1.5, 1])
  expect(moved.edges.every((edge) => edge.shape === 'straight')).toBe(true)
})

test('dense connected routes keep their ends visible without flooding the canvas', () => {
  const vertices = Array.from({ length: 30 }, (_, index) => ({ id: String(index), point: [index * 0.1, 0] as [number, number] }))
  const edges = vertices.slice(1).map((_, index) => ({ id: `e${index}`, from: String(index),
    to: String(index + 1), width: 1, shape: 'straight' as const }))
  const shown = visiblePathVertices({ vertices, edges })
  expect(shown.some((vertex) => vertex.id === '0')).toBe(true)
  expect(shown.some((vertex) => vertex.id === '29')).toBe(true)
  expect(shown.length).toBeLessThan(10)
  expect(visiblePathVertices({ vertices, edges, showAllEditPoints: true })).toHaveLength(30)
})
