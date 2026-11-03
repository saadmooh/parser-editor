import { expect, test } from 'bun:test'
import type { MultiPolygon, Polygon } from 'polygon-clipping'
import { pavingPolygons } from './paving-polygons'

const square = (low: number, high: number): Polygon => [[
  [low, low], [high, low], [high, high], [low, high], [low, low],
]]
const area = (polygons: MultiPolygon) => polygons.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => {
  const signed = ring.reduce((a, p, i) => {
    const q = ring[(i + 1) % ring.length]!
    return a + p[0] * q[1] - q[0] * p[1]
  }, 0) / 2
  return total + Math.abs(signed) * (index === 0 ? 1 : -1)
}, 0), 0)

test('integer paving clipping preserves holes and islands regardless of winding', () => {
  const outer = square(0, 4)
  const hole = square(1, 3)
  const donut = pavingPolygons.difference(outer, hole)
  expect(area(donut)).toBeCloseTo(12)
  expect(donut[0]).toHaveLength(2)
  const reversed = donut.map((polygon) => polygon.map((ring) => [...ring].reverse()))
  const withIsland = pavingPolygons.union(reversed, square(1.5, 2.5))
  expect(withIsland).toHaveLength(2)
  expect(area(withIsland)).toBeCloseTo(13)
})

test('repeated cuts with almost coincident edges stay closed and do not overlap', () => {
  let remaining: MultiPolygon = [square(0, 4)]
  for (let i = 0; i < 30; i++) {
    remaining = pavingPolygons.difference(remaining, square(1 + i * 1e-9, 3 - i * 1e-9))
    expect(area(remaining)).toBeCloseTo(12, 4)
    expect(remaining.every((polygon) => polygon.every((ring) =>
      ring.length >= 4 && JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1))))).toBe(true)
  }
  expect(pavingPolygons.intersection(remaining, square(1, 3))).toEqual([])
})
