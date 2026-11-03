import { expect, test } from 'bun:test'
import type { MultiPolygon, Polygon } from 'polygon-clipping'
import { lerp, type Curve } from '../domain/curves'
import { addCurves } from '../domain/network'
import { PathwayNode, type Point } from '../domain/schema'
import { buildOutline } from './outline'
import { laidPavingTiles } from './laid-paving'
import { miteredPavingRegion } from './paving-miters'
import { pavingPolygons } from './paving-polygons'

const line = (a: Point, b: Point): Curve => [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]
const area = (polygons: MultiPolygon) => polygons.reduce((sum, polygon) => sum + polygon.reduce((s, ring, index) => {
  const signed = ring.reduce((a, p, i) => {
    const q = ring[(i + 1) % ring.length]!
    return a + p[0] * q[1] - q[0] * p[1]
  }, 0) / 2
  return s + Math.abs(signed) * (index === 0 ? 1 : -1)
}, 0), 0)

for (const finish of ['laidStone', 'concreteSlabs'] as const)
for (const angle of [30, 45, 90, 120]) test(`${finish}: ${angle} degree bend has a shared miter and is independent of drawing order`, () => {
  const radians = angle * Math.PI / 180
  const end: Point = [4 * Math.cos(radians), 4 * Math.sin(radians)]
  const graph = addCurves({ vertices: [], edges: [] }, [line([-4, 0], [0, 0]), line([0, 0], end)], 1.8)
  const node = PathwayNode.parse({ ...graph, finish })
  const footprint = buildOutline(node)
  const regions = node.edges.map((edge) => miteredPavingRegion(node, edge, footprint))
  expect(area(pavingPolygons.intersection(regions[0]!, regions[1]!))).toBe(0)
  const normal: Point = [-1 - Math.cos(radians), -Math.sin(radians)]
  const length = Math.hypot(...normal)
  for (const polygon of regions[0]!) for (const ring of polygon) for (const p of ring)
    expect((p[0] * normal[0] + p[1] * normal[1]) / length).toBeGreaterThanOrEqual(0.01498)
  const polygons = (n: PathwayNode): Polygon[] => laidPavingTiles(n)
    .filter((tile) => !tile.border).map((tile) => [tile.ring, ...(tile.holes ?? [])])
  const forward = polygons(node), reverse = polygons({ ...node, edges: [...node.edges].reverse() })
  expect(forward.length).toBeGreaterThan(0)
  for (let i = 0; i < forward.length; i++) {
    expect(area(pavingPolygons.difference(forward[i]!, footprint))).toBeLessThan(0.0001)
    for (let j = i + 1; j < forward.length; j++)
      expect(area(pavingPolygons.intersection(forward[i]!, forward[j]!))).toBeLessThan(0.0001)
  }
  const forwardUnion = pavingPolygons.union(forward[0]!, ...forward.slice(1))
  const reverseUnion = pavingPolygons.union(reverse[0]!, ...reverse.slice(1))
  expect(area(pavingPolygons.difference(forwardUnion, reverseUnion))).toBeLessThan(0.0001)
  expect(area(pavingPolygons.difference(reverseUnion, forwardUnion))).toBeLessThan(0.0001)
})

test('insetting the extrusion footprint leaves room for its bevel', () => {
  const stone: Polygon = [[[0, 0], [0.5, 0], [0.5, 0.29], [0, 0.29]]]
  const inset = pavingPolygons.inset(stone, 0.006)
  const points = inset[0]![0]!
  expect(Math.min(...points.map((p) => p[0]))).toBeCloseTo(0.006, 5)
  expect(Math.max(...points.map((p) => p[0]))).toBeCloseTo(0.494, 5)
})
