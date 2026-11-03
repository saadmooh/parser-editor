import { expect, test } from 'bun:test'
import { Box3 } from 'three'
import { lerp, type Curve } from '../domain/curves'
import { addCurves } from '../domain/network'
import { PathwayNode, naturalStoneFinishes, type Point } from '../domain/schema'
import { buildPathwayGeometry, disposePathwayGeometry } from './geometry'
import { naturalStones } from './natural-stones'
import { buildOutline } from './outline'
import { pavingPolygons } from './paving-polygons'
import { derivePathwaySettings } from '../domain/settings'
import { buildPathwayFloorplan } from './floorplan'
import type { GeometryContext } from '@pascal-app/core'

const area = (ring: Point[]) => Math.abs(ring.reduce((sum, p, i) => {
  const next = ring[(i + 1) % ring.length]!
  return sum + p[0] * next[1] - next[0] * p[1]
}, 0)) / 2

const line = (a: Point, b: Point): Curve => [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]

for (const finish of naturalStoneFinishes) test(`${finish} follows straight and curved walkways`, () => {
  for (const route of [
    [line([0, 0], [4, 0])],
    [[[0, 0], [1, 2], [3, -2], [4, 0]] as Curve],
    [line([0, 0], [3, 0]), line([3, 0], [3, 3])],
  ]) {
    const graph = addCurves({ vertices: [], edges: [] }, route, 1.8, 'spline')
    const node = PathwayNode.parse({ ...graph, finish, borderStyle: 'none' })
    const stones = naturalStones(node)
    expect(stones.length).toBeGreaterThan(2)
    expect(naturalStones(PathwayNode.parse(JSON.parse(JSON.stringify(node))))).toEqual(stones)
    const outline = buildOutline(node)
    for (const stone of stones) {
      expect(stone.ring.every((p) => p.every(Number.isFinite))).toBe(true)
      expect(pavingPolygons.difference([stone.ring], outline)
        .reduce((sum, polygon) => sum + area(polygon[0] as Point[]), 0)).toBeLessThan(0.00001)
    }
    const mesh = buildPathwayGeometry(node)
    expect(mesh.userData.pavingTileCount).toBe(stones.length)
    expect(new Box3().setFromObject(mesh).isEmpty()).toBe(false)
    disposePathwayGeometry(mesh)
  }
})

test('stepping stones use one centered row with open gaps', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [line([0, 0], [5, 0])], 1.8)
  const node = PathwayNode.parse({ ...graph, finish: 'steppingStones', borderStyle: 'none' })
  const stones = naturalStones(node)
  expect(stones.length).toBeGreaterThan(3)
  expect(stones.every((stone) => {
    const center = stone.ring.reduce((sum, p) => sum + p[1], 0) / stone.ring.length
    return Math.abs(center) < 0.25
  })).toBe(true)
  const mesh = buildPathwayGeometry(node)
  expect(mesh.children.length).toBeLessThanOrEqual(4)
  disposePathwayGeometry(mesh)
  const plan = buildPathwayFloorplan(node, {} as GeometryContext)
  expect(plan.kind).toBe('group')
  if (plan.kind === 'group') expect(plan.children.length).toBe(stones.length)
  const wide = PathwayNode.parse({ ...node,
    defaultWidth: 3, edges: node.edges.map((edge) => ({ ...edge, width: 3 })) })
  const widthOf = (ring: Point[]) => Math.max(...ring.map((p) => p[1])) - Math.min(...ring.map((p) => p[1]))
  expect(widthOf(naturalStones(wide)[0]!.ring)).toBeGreaterThan(widthOf(stones[0]!.ring))
})

test('river stones render without a full backing slab in 3D or floorplan', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [line([0, 0], [4, 0])], 1.8)
  const node = PathwayNode.parse({ ...graph, finish: 'riverStones', borderStyle: 'none' })
  const stones = naturalStones(node)
  const mesh = buildPathwayGeometry(node)
  // One merged mesh per shade; a fifth full-width mesh would be the old slab.
  expect(mesh.children.length).toBeLessThanOrEqual(4)
  expect(mesh.children.some((child) => child.name === 'pathway-backing')).toBe(false)
  expect(mesh.userData.pavingTileCount).toBe(stones.length)
  disposePathwayGeometry(mesh)
  const plan = buildPathwayFloorplan(node, {} as GeometryContext)
  expect(plan.kind).toBe('group')
  if (plan.kind === 'group') expect(plan.children.length).toBe(stones.length)
})

test('retired curved cobbles open as river stones without a backing slab', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [
    [[0, 0], [1, 1], [3, 1], [4, 0]],
  ], 1.8, 'spline')
  const saved = { ...PathwayNode.parse({ ...graph }), finish: 'curvedCobbles',
    borderStyle: 'stone', naturalEdgeHeight: 0.4 } as unknown as PathwayNode
  const restored = PathwayNode.parse(saved)
  expect(restored.finish).toBe('riverStones')
  const stones = naturalStones(saved)
  expect(stones.length).toBeGreaterThan(10)
  const mesh = buildPathwayGeometry(saved)
  expect(mesh.children.some((child) => child.name === 'pathway-backing')).toBe(false)
  expect(mesh.children.some((child) => child.name === 'pathway-border')).toBe(false)
  expect(mesh.userData.pavingTileCount).toBe(stones.length)
  disposePathwayGeometry(mesh)
  const plan = buildPathwayFloorplan(saved, {} as GeometryContext)
  expect(plan.kind).toBe('group')
  if (plan.kind === 'group') expect(plan.children.length).toBe(stones.length)
})

test('each available natural finish selects its own layout defaults', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [line([0, 0], [4, 0])], 1.8)
  const base = PathwayNode.parse({ ...graph })
  for (const finish of naturalStoneFinishes) {
    const patch = derivePathwaySettings({ ...base, finish }, { finish })
    expect(patch.naturalStoneSize).toBeGreaterThan(0)
    expect(patch.naturalStoneGap).toBeGreaterThan(0)
    expect(patch.borderStyle).toBe('none')
  }
})

test('natural stones remain separate at a curved junction after changing the pattern seed', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [
    line([-2, 0], [0, 0]), [[0, 0], [1, 0], [1, 2], [2, 2]],
  ], 1.8, 'spline')
  for (const finish of naturalStoneFinishes) {
    const node = PathwayNode.parse({ ...graph, finish, borderStyle: 'none' })
    const stones = naturalStones(node)
    expect(naturalStones({ ...node, naturalStoneSeed: 2 })).not.toEqual(stones)
    for (let i = 0; i < stones.length; i++) for (let j = i + 1; j < stones.length; j++) {
      const overlap = pavingPolygons.intersection([stones[i]!.ring], [stones[j]!.ring])
      expect(overlap.reduce((sum, polygon) => sum + area(polygon[0] as Point[]), 0)).toBeLessThan(0.00001)
    }
  }
})
