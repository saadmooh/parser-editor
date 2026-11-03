import { expect, test } from 'bun:test'
import { BoxGeometry, LatheGeometry, Mesh } from 'three'
import type { GeometryContext } from '@pascal-app/core'
import { EdgingNode } from '../domain/schema'
import { edgingRenderPoints } from '../domain/sampling'
import { buildEdgingFloorplan, buildEdgingGeometry } from './geometry'

function hasCorner(mesh: Mesh, x: number, z: number) {
  const positions = mesh.geometry.getAttribute('position')
  return Array.from({ length: positions.count }, (_, index) => index)
    .some((index) => Math.abs(positions.getX(index) - x) < 1e-4 && Math.abs(positions.getZ(index) - z) < 1e-4)
}

test('legacy edging without points renders as a straight run', () => {
  const node = { ...EdgingNode.parse({ width: 3 }), points: undefined } as unknown as EdgingNode
  const group = buildEdgingGeometry(node)
  expect(group.children.length).toBeGreaterThan(0)
  const plan = buildEdgingFloorplan(node, {} as GeometryContext)
  expect(plan.kind).toBe('group')
  if (plan.kind === 'group') expect(plan.children).toHaveLength(1)
})

test('empty edging draft has no segments', () => {
  const node = EdgingNode.parse({ points: [] })
  expect(buildEdgingGeometry(node).children).toHaveLength(0)
  const plan = buildEdgingFloorplan(node, {} as GeometryContext)
  if (plan.kind === 'group') expect(plan.children).toHaveLength(0)
})

test('smooth curve bends through anchors and keeps normal sized separated pieces', () => {
  const node = EdgingNode.parse({ drawMode: 'curve', layout: 'separated',
    points: [[0, 0], [2, 1], [4, 0]], unitLength: 0.5, irregularity: 0 })
  const plan = buildEdgingFloorplan(node, {} as GeometryContext)
  expect(plan.kind).toBe('group')
  if (plan.kind === 'group' && plan.children[0]?.kind === 'path') {
    expect(plan.children[0].d.includes('L')).toBe(true)
    expect(plan.children[0].d.split('L').length).toBeGreaterThan(10)
  }
  const pieces = buildEdgingGeometry(node).children
  expect(pieces.length).toBeGreaterThan(4)
  expect(pieces.length).toBeLessThan(20)
})

test('freehand removes pointer jitter while retaining separated pieces', () => {
  const points = Array.from({ length: 51 }, (_, index): [number, number] =>
    [index * 0.05, index % 2 ? 0.006 : -0.006])
  const node = EdgingNode.parse({ drawMode: 'freehand', points })
  expect(edgingRenderPoints(node)).toHaveLength(2)
  expect(node.layout).toBe('separated')
  expect(buildEdgingGeometry(node).children.length).toBeGreaterThan(1)
})

test('all edging forms build distinct geometry on the same route', () => {
  const points: [number, number][] = [[0, 0], [2, 0]]
  const groups = Object.fromEntries((['strip', 'pavers', 'stone', 'square-posts', 'round-posts', 'capped-wall'] as const)
    .map((form) => [form, buildEdgingGeometry(EdgingNode.parse({ form, points, thickness: 0.6 }))]))
  expect(groups.strip!.getObjectByName('edging-strip')).toBeDefined()
  expect(groups.pavers!.getObjectByName('edging-piece-1-1')).toBeDefined()
  expect(groups.stone!.getObjectByName('edging-stone-1-1')).toBeDefined()
  expect(groups['square-posts']!.getObjectByName('edging-square-posts-1')).toBeDefined()
  expect(groups['round-posts']!.getObjectByName('edging-round-posts-1')).toBeDefined()
  expect((groups['square-posts']!.getObjectByName('edging-square-posts-1') as Mesh).geometry).toBeInstanceOf(BoxGeometry)
  expect((groups['round-posts']!.getObjectByName('edging-round-posts-1') as Mesh).geometry).toBeInstanceOf(LatheGeometry)
  expect((groups.stone!.getObjectByName('edging-stone-1-1') as Mesh).geometry.getAttribute('position').count)
    .toBeGreaterThan((groups.pavers!.getObjectByName('edging-piece-1-1') as Mesh).geometry.getAttribute('position').count)
  expect(groups['capped-wall']!.getObjectByName('edging-wall-course-1')).toBeDefined()
  const cap = groups['capped-wall']!.getObjectByName('edging-wall-cap') as Mesh
  expect(cap.userData.slotId).toBe('edging-cap')
  expect(cap.position.y).toBeGreaterThan(0)
  cap.geometry.computeBoundingBox()
  expect(cap.geometry.boundingBox!.max.z - cap.geometry.boundingBox!.min.z).toBeGreaterThan(0.3)
})

test('posts and capped wall follow a curved route', () => {
  for (const form of ['square-posts', 'round-posts', 'capped-wall'] as const) {
    const node = EdgingNode.parse({ form, drawMode: 'curve', points: [[0, 0], [1, 1], [2, 0]], thickness: 0.6 })
    expect(buildEdgingGeometry(node).children.length).toBeGreaterThan(0)
  }
})

for (const layout of ['separated', 'woven'] as const) {
  test(`${layout} edging cuts both pieces at a bend to the same miter`, () => {
    const node = EdgingNode.parse({ layout, points: [[0, 0], [2, 0], [2, 2]],
      depth: 0.3, unitLength: 1, jointWidth: 0, irregularity: 0 })
    const group = buildEdgingGeometry(node)
    const incoming = group.getObjectByName('edging-piece-1-2') as Mesh
    const outgoing = group.getObjectByName('edging-piece-2-1') as Mesh
    expect(incoming).toBeDefined()
    expect(outgoing).toBeDefined()
    for (const piece of [incoming, outgoing]) {
      expect(hasCorner(piece, 1.85, 0.15)).toBe(true)
      expect(hasCorner(piece, 2.15, -0.15)).toBe(true)
    }
  })
}
