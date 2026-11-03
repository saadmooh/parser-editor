import { expect, test } from 'bun:test'
import type { GeometryContext } from '@pascal-app/core'
import { addCurves } from '../../pathways/domain/network'
import { PathwayNode, pathwayFinishes } from '../../pathways/domain/schema'
import { GroundAreaNode } from '../domain/schema'
import { visibleGrassFootprint } from './footprint'

test('all walkway finishes leave the grass surface intact beneath them', () => {
  const outline: [number, number][] = [[-2, -2], [6, -2], [6, 2], [-2, 2]]
  const grass = GroundAreaNode.parse({ outline, surface: 'grass', parentId: 'level_demo' })
  const graph = addCurves({ vertices: [], edges: [] }, [
    [[0, 0], [4 / 3, 0], [8 / 3, 0], [4, 0]],
  ], 1.8)
  for (const finish of pathwayFinishes) {
    const path = PathwayNode.parse({ ...graph, finish, parentId: grass.parentId })
    const ctx = { sceneNodes: { [path.id]: path } } as unknown as GeometryContext
    expect(visibleGrassFootprint(grass, ctx)).toEqual([[outline]])
  }
})

test('a slab still cuts grass where it occupies the same surface', () => {
  const outline: [number, number][] = [[-2, -2], [6, -2], [6, 2], [-2, 2]]
  const grass = GroundAreaNode.parse({ outline, surface: 'grass', parentId: 'level_demo' })
  const slab = {
    id: 'slab_test', type: 'slab', parentId: grass.parentId, visible: true,
    elevation: 0.1, thickness: 0.1,
    polygon: [[0, -1], [4, -1], [4, 1], [0, 1]], holes: [],
  }
  const ctx = { sceneNodes: { [slab.id]: slab } } as unknown as GeometryContext
  const footprint = visibleGrassFootprint(grass, ctx)
  expect(footprint[0]?.length).toBe(2)
})
