import { expect, test } from 'bun:test'
import { edgingEditIndices, moveEdgingControls } from './edit'
import type { Point } from './route'

test('a sampled straight-to-curve join has sparse controls without changing its geometry', () => {
  const points: Point[] = [[-4, 0], ...Array.from({ length: 301 }, (_, i): Point => {
    const angle = i / 300 * Math.PI / 2
    return [4 * Math.sin(angle), 4 * (1 - Math.cos(angle))]
  })]
  const original = structuredClone(points)
  const controls = edgingEditIndices({ points, drawMode: 'freehand', closed: false })
  expect(controls.length).toBeLessThan(15)
  expect(controls[0]).toBe(0)
  expect(controls.at(-1)).toBe(points.length - 1)
  expect(points).toEqual(original)
})

test('authored curve anchors and sharp joins remain editable', () => {
  const points: Point[] = [[0, 0], [2, 0], [2, 2], [4, 2]]
  for (const drawMode of ['straight', 'curve', 'freehand'] as const)
    expect(edgingEditIndices({ points, drawMode, closed: false })).toEqual([0, 1, 2, 3])
})

test('moving a control carries nearby samples and leaves other anchors fixed', () => {
  const points: Point[] = Array.from({ length: 101 }, (_, i) => [i / 10, 0])
  const next = moveEdgingControls(points, [0, 50, 100], false, new Map([[50, [0, 2]]]))
  expect(next[50]).toEqual([5, 2])
  expect(next[0]).toEqual(points[0])
  expect(next[100]).toEqual(points[100])
  expect(next[49]![1]).toBeGreaterThan(1.99)
  expect(next[25]![1]).toBeCloseTo(1)
  expect(points[50]).toEqual([5, 0])
})

test('closed sampled loops retain a sparse circular set of controls', () => {
  const points: Point[] = Array.from({ length: 360 }, (_, i) =>
    [5 * Math.cos(i * Math.PI / 180), 5 * Math.sin(i * Math.PI / 180)])
  const controls = edgingEditIndices({ points, drawMode: 'freehand', closed: true })
  expect(controls.length).toBeGreaterThanOrEqual(3)
  expect(controls.length).toBeLessThan(40)
  const moved = moveEdgingControls(points, controls, true, new Map([[0, [1, 0]]]))
  expect(moved[0]).toEqual([6, 0])
  expect(moved.at(-1)![0]).toBeGreaterThan(points.at(-1)![0] + 0.9)
})
