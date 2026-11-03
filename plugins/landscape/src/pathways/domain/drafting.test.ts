import { expect, test } from 'bun:test'
import { CatmullRomCurve3, Vector3 } from 'three'
import { distance, evaluate, splineCurves, type Curve } from './curves'
import type { Point } from './schema'
import { addCurves } from './network'
import { snapAlongAngle } from './drafting'

test('spline matches Streetscape centripetal Catmull-Rom through any number of clicks', () => {
  const clicks: Point[] = [[0, 0], [2, 3], [5, 2], [8, 6], [10, 5]]
  const expected = new CatmullRomCurve3(clicks.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal')
  const segments = splineCurves(clicks)
  expect(segments).toHaveLength(clicks.length - 1)
  for (let i = 0; i < segments.length; i++) {
    expect(segments[i]![0]).toEqual(clicks[i]!)
    expect(segments[i]![3]).toEqual(clicks[i + 1]!)
    for (const t of [0.12, 0.37, 0.61, 0.89]) {
      const p = expected.getPoint((i + t) / segments.length)
      expect(distance(evaluate(segments[i]!, t), [p.x, p.z])).toBeLessThan(1e-5)
    }
  }
})

test('successive straight clicks commit connected legs incrementally', () => {
  const p: Point[] = [[0, 0], [4, 0], [4, 3]]
  let graph = { vertices: [], edges: [] } as ReturnType<typeof addCurves>
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!, b = p[i]!
    const line: Curve = [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
      [a[0] + 2 * (b[0] - a[0]) / 3, a[1] + 2 * (b[1] - a[1]) / 3], b]
    graph = addCurves(graph, [line], 1)
  }
  expect(graph.edges).toHaveLength(2)
  expect(graph.vertices).toHaveLength(3)
})

test('angle mode locks the endpoint to a 15-degree ray and quantized length', () => {
  const point = snapAlongAngle([0, 0], [4, 1.2], 0.5)
  expect(Math.atan2(point[1], point[0]) * 180 / Math.PI).toBeCloseTo(15, 4)
  expect(Math.hypot(...point)).toBeCloseTo(4, 4)
})
