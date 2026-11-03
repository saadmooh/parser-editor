import { expect, test } from 'bun:test'
import { WallNode, type GeometryContext } from '@pascal-app/core'
import { BufferGeometry, Mesh } from 'three'
import { RetainingWallNode } from '../domain/schema'
import { buildRetainingWallGeometry } from './geometry'

test('masonry finish follows a curved wall and adds cap stones above it', () => {
  const wall = WallNode.parse({ id: 'wall_retaining_test', start: [0, 0], end: [4, 0],
    curveOffset: 0.8, height: 0.9, thickness: 0.25 })
  const finish = RetainingWallNode.parse({ hostWallId: wall.id, capOverhang: 0.06 })
  const ctx = { resolve: (id: string) => id === wall.id ? wall : undefined } as GeometryContext
  const group = buildRetainingWallGeometry(finish, ctx)
  const cap = group.getObjectByName('cap-0') as Mesh
  const blocks = group.children.filter((child) => child.name.startsWith('block-'))
  expect(blocks.length).toBeGreaterThan(10)
  expect(cap).toBeDefined()
  const bounds = cap.geometry.boundingBox ?? (cap.geometry.computeBoundingBox(), cap.geometry.boundingBox!)
  expect(bounds.max.y).toBeGreaterThan(wall.height!)
  expect(bounds.max.z - bounds.min.z).toBeGreaterThan(wall.thickness!)
  const mortar = group.getObjectByName('mortar') as Mesh
  mortar.geometry.computeBoundingBox()
  expect(mortar.geometry.boundingBox!.max.z - mortar.geometry.boundingBox!.min.z).toBeGreaterThan(wall.thickness!)
})

test('cap and courses meet at the editor wall miter on a corner', () => {
  const first = WallNode.parse({ id: 'wall_corner_first', parentId: 'level_corner',
    start: [0, 0], end: [2, 0], height: 0.9, thickness: 0.25,
    metadata: { landscapeRetainingWall: true } })
  const second = WallNode.parse({ id: 'wall_corner_second', parentId: 'level_corner',
    start: [2, 0], end: [2, 2], height: 0.9, thickness: 0.25,
    metadata: { landscapeRetainingWall: true } })
  const firstFinish = RetainingWallNode.parse({ hostWallId: first.id, capOverhang: 0.06 })
  const secondFinish = RetainingWallNode.parse({ hostWallId: second.id, capOverhang: 0.1 })
  const nodes = { [first.id]: first, [second.id]: second,
    [firstFinish.id]: firstFinish, [secondFinish.id]: secondFinish }
  const ctx = { sceneNodes: nodes, resolve: (id: string) => nodes[id as keyof typeof nodes] } as GeometryContext
  const firstGroup = buildRetainingWallGeometry(firstFinish, ctx)
  const secondGroup = buildRetainingWallGeometry(secondFinish, ctx)
  const terminal = (group: typeof firstGroup, prefix: string, atEnd: boolean) => {
    const pieces = group.children.filter((child) => child.name.startsWith(prefix)) as Mesh<BufferGeometry>[]
    const piece = atEnd ? pieces.at(-1)! : pieces[0]!
    const positions = piece.geometry.getAttribute('position')
    const points: { x: number; z: number }[] = []
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i)
      if (!points.some((point) => Math.hypot(point.x - x, point.z - z) < 1e-5)) points.push({ x, z })
    }
    return points
  }
  for (const prefix of ['cap-', 'block-0-']) {
    const firstPoints = terminal(firstGroup, prefix, true)
    const secondPoints = terminal(secondGroup, prefix, false)
    const shared = firstPoints.filter((point) => secondPoints.some((other) =>
      Math.hypot(point.x - other.x, point.z - other.z) < 1e-5))
    expect(shared.length).toBeGreaterThanOrEqual(2)
  }
})
