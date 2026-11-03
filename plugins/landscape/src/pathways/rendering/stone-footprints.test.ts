import { expect, test } from 'bun:test'
import type { GeometryContext } from '@pascal-app/core'
import { PathwayNode } from '../domain/schema'
import { pathwayStoneFootprints } from './stone-footprints'
import { poolCutoutsFor, type PoolCutoutSurface } from '../../shared/pool-cutouts'
import { pavingPolygons } from './paving-polygons'
import { buildPathwayFloorplan } from './floorplan'
import { buildPathwayGeometry, disposePathwayGeometry } from './geometry'

test('pool clipping removes individual stone footprints in both rendering modes', () => {
  for (const finish of ['laidStone', 'grassFlagstones', 'riverStones', 'steppingStones'] as const) {
    const path = PathwayNode.parse({ finish, parentId: 'level_a', borderStyle: 'none',
      vertices: [{ id: 'a', point: [0, 0] }, { id: 'b', point: [4, 0] }],
      edges: [{ id: 'ab', from: 'a', to: 'b', width: 1.8 }] })
    const pool = { id: 'pool_a', type: 'pool:pool', parentId: 'level_a',
      polygon: [[1, -2], [3, -2], [3, 2], [1, 2]] }
    const partial = { sceneNodes: { pool_a: pool } } as unknown as GeometryContext
    const stones = pathwayStoneFootprints(path, partial)
    expect(stones.length).toBeGreaterThan(0)
    const cutouts = poolCutoutsFor(path as unknown as PoolCutoutSurface, partial)
    for (const stone of stones) {
      expect(pavingPolygons.intersection([stone.ring, ...(stone.holes ?? [])], cutouts)).toHaveLength(0)
    }
    const covered = { sceneNodes: { pool_a: { ...pool,
      polygon: [[-2, -2], [6, -2], [6, 2], [-2, 2]] } } } as unknown as GeometryContext
    expect(pathwayStoneFootprints(path, covered)).toHaveLength(0)
    expect(buildPathwayFloorplan(path, covered)).toEqual({ kind: 'group', children: [] })
    const geometry = buildPathwayGeometry(path, covered)
    try { expect(geometry.children).toHaveLength(0) }
    finally { disposePathwayGeometry(geometry) }
  }
})
