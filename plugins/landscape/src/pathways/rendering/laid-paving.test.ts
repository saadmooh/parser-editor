import { expect, test } from 'bun:test'
import { Box3 } from 'three'
import { lerp, type Curve } from '../domain/curves'
import { addCurves, moveJunction } from '../domain/network'
import { PathwayNode, type Point } from '../domain/schema'
import { buildPathwayGeometry, disposePathwayGeometry } from './geometry'
import { laidPavingTiles } from './laid-paving'
import { buildOutline } from './outline'
import { pavingPolygons } from './paving-polygons'

const line = (a: Point, b: Point): Curve => [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]

test('laid stone follows a moved curved centerline and concrete uses broad panels', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [[
    [0, 0], [1, 1], [3, 1], [4, 0],
  ]], 1.5, 'spline')
  const stone = PathwayNode.parse({ ...graph, finish: 'laidStone' })
  const tiles = laidPavingTiles(stone)
  expect(tiles.length).toBeGreaterThan(20)
  expect(new Set(tiles.map((tile) => tile.shade)).size).toBeGreaterThan(1)
  const moved = moveJunction(stone, stone.vertices[0]!.id, [0, 1])
  expect(laidPavingTiles({ ...stone, ...moved })[0]!.ring).not.toEqual(tiles[0]!.ring)
  const concrete = PathwayNode.parse({ ...graph, finish: 'concreteSlabs' })
  expect(laidPavingTiles(concrete).length).toBeLessThan(tiles.length)
  const mesh = buildPathwayGeometry(stone)
  expect(mesh.userData.pavingTileCount).toBe(tiles.length)
  expect(mesh.children.length).toBeLessThanOrEqual(5)
  expect(new Box3().setFromObject(mesh).isEmpty()).toBe(false)
  disposePathwayGeometry(mesh)
})

test('long routes keep individual stone dimensions along the full length', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [line([0, 0], [100, 0])], 1.5)
  const tiles = laidPavingTiles(PathwayNode.parse({ ...graph, finish: 'laidStone' }))
  const centers = tiles.filter((tile) => !tile.border)
  expect(centers.length).toBeGreaterThan(600)
  expect(Math.max(...centers.at(-1)!.ring.map(([x]) => x))).toBeGreaterThan(99)
  expect(centers.every((tile) => Math.max(...tile.ring.map(([x]) => x)) - Math.min(...tile.ring.map(([x]) => x)) < 0.35)).toBe(true)
})

test('an L bend is paved with separate center and border stones, without a backing slab', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [
    line([0, 0], [4, 0]), line([4, 0], [4, 4]),
  ], 1.5)
  const node = PathwayNode.parse({ ...graph, finish: 'laidStone' })
  const tiles = laidPavingTiles(node)
  const area = (ring: Point[]) => Math.abs(ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length]!
    return sum + p[0] * q[1] - q[0] * p[1]
  }, 0)) / 2
  const paved = tiles.reduce((sum, tile) => sum + area(tile.ring), 0)
  const footprint = buildOutline(node).reduce((sum, polygon) => sum + area(polygon[0]! as Point[]), 0)
  expect(paved / footprint).toBeGreaterThan(0.85)
  expect(tiles.some((tile) => tile.border)).toBe(true)
  expect(tiles.some((tile) => !tile.border)).toBe(true)
  // The joined center must not acquire a strip of edging across the walkway.
  expect(tiles.filter((tile) => tile.border).every((tile) =>
    tile.ring.every(([x, z]) => Math.hypot(x - 4, z) > 0.55))).toBe(true)
  const mesh = buildPathwayGeometry(node)
  expect(mesh.userData.pavingTileCount).toBe(tiles.length)
  expect(mesh.children.length).toBeLessThanOrEqual(5)
  disposePathwayGeometry(mesh)
})

test('reference S curve retains square ends and its requested width', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [[
    [-0.6, 0], [-0.6, 2], [1.2, 3], [1.2, 6],
  ]], 1.8)
  const node = PathwayNode.parse({ ...graph, finish: 'laidStone' })
  const outline = buildOutline(node).flatMap((polygon) => polygon[0]!)
  expect(Math.min(...outline.map((p) => p[1]))).toBeCloseTo(0, 5)
  expect(Math.max(...outline.map((p) => p[1]))).toBeCloseTo(6, 5)
  const start = outline.filter((p) => Math.abs(p[1]) < 1e-5)
  expect(Math.max(...start.map((p) => p[0])) - Math.min(...start.map((p) => p[0]))).toBeCloseTo(1.8, 5)
  const tiles = laidPavingTiles(node)
  expect(tiles.length).toBeGreaterThan(100)
  expect(tiles.filter((tile) => !tile.border).every((tile) => tile.ring.every((p) => p.every(Number.isFinite)))).toBe(true)
})

test('stone borders and center pieces survive width changes on curved and joined routes', () => {
  const routes: Curve[][] = [
    [[[-0.6, 0], [-0.6, 2], [1.2, 3], [1.2, 6]]],
    [line([-3, 0], [3, 0]), line([0, 0], [0, 4])],
  ]
  for (const width of [0.3, 1.2, 1.8, 3]) for (const route of routes) {
    const graph = addCurves({ vertices: [], edges: [] }, route, width)
    const tiles = laidPavingTiles(PathwayNode.parse({ ...graph, finish: 'laidStone', defaultWidth: width }))
    expect(tiles.some((tile) => tile.border)).toBe(true)
    expect(tiles.some((tile) => !tile.border)).toBe(true)
    expect(tiles.every((tile) => tile.ring.every((p) => p.every(Number.isFinite)))).toBe(true)
  }
})

test('overlapping curved cells remain renderable while the endpoint is dragged', () => {
  // Reproduced the old floating-point sweep-line / incomplete-ring failure.
  const curve: Curve = [
    [1.7630374236032367, -2.7160689854063094],
    [3.6072746235877275, 0.03960308339446783],
    [0.8079505423083901, 0.7605233080685139],
    [0.28190167527645826, 3.2839310145936906],
  ]
  const graph = addCurves({ vertices: [], edges: [] }, [curve], 2.2388364781625567, 'spline')
  const node = PathwayNode.parse({ ...graph, finish: 'laidStone' })
  for (let step = 0; step < 32; step++) {
    const moved = moveJunction(node, node.vertices[0]!.id,
      [curve[0][0] + step * 0.013, curve[0][1] - step * 0.007])
    const tiles = laidPavingTiles({ ...node, ...moved })
    expect(tiles.filter((tile) => !tile.border).length).toBeGreaterThan(20)
    expect(tiles.every((tile) => tile.ring.every((p) => p.every(Number.isFinite)))).toBe(true)
  }
})

test('stone layout controls change size and joints without random jumps or overlaps', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [line([0, 0], [3, 0])], 1.8)
  const base = PathwayNode.parse({ ...graph, finish: 'laidStone', borderStyle: 'none' })
  const original = laidPavingTiles(base).filter((tile) => !tile.border)
  const customized = PathwayNode.parse({ ...base, stoneLength: 0.5, stoneJoint: 0.05, stoneVariation: 0.8 })
  const varied = laidPavingTiles(customized).filter((tile) => !tile.border)
  expect(varied.length).toBeLessThan(original.length)
  expect(laidPavingTiles(PathwayNode.parse(JSON.parse(JSON.stringify(customized))))).toEqual(laidPavingTiles(customized))
  const lengths = varied.map((tile) =>
    Math.max(...tile.ring.map(([x]) => x)) - Math.min(...tile.ring.map(([x]) => x)))
  expect(new Set(lengths.map((length) => length.toFixed(3))).size).toBeGreaterThan(3)
  const polygons = varied.map((tile) => [tile.ring, ...(tile.holes ?? [])])
  for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++)
    expect(pavingPolygons.intersection(polygons[i]!, polygons[j]!)).toEqual([])
})

test('previously saved laid stone paths render before new layout fields are populated', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [line([0, 0], [3, 0])], 1.8)
  const current = PathwayNode.parse({ ...graph, finish: 'laidStone' })
  const legacy = { ...current } as Partial<PathwayNode>
  delete legacy.stoneLength
  delete legacy.stoneJoint
  delete legacy.stoneVariation
  delete legacy.stoneEdge
  delete legacy.borderEdge
  const saved = legacy as PathwayNode
  const tiles = laidPavingTiles(saved)
  expect(tiles.filter((tile) => !tile.border).length).toBeGreaterThan(20)
  expect(tiles).toEqual(laidPavingTiles(current))
  const mesh = buildPathwayGeometry(saved)
  expect(mesh.userData.pavingTileCount).toBe(tiles.length)
  expect(new Box3().setFromObject(mesh).isEmpty()).toBe(false)
  disposePathwayGeometry(mesh)
})
