import { expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { affectedPoolCutoutSurfaceIds } from './pool-cutout-invalidation'

const nodes = (values: Record<string, unknown>) => values as Record<string, AnyNode>
const pool = { id: 'pool', type: 'pool:pool', parentId: 'level_a', position: [0, 0, 0],
  length: 8, width: 4, copingWidth: 0.3 }
const near = { id: 'near', type: 'landscape:patio', parentId: 'level_a', position: [0, 0, 0], width: 12, depth: 8 }
const far = { ...near, id: 'far', position: [100, 0, 0] }
const path = { id: 'path', type: 'landscape:pathway', parentId: 'level_a',
  vertices: [{ point: [95, 0] }, { point: [105, 0] }], edges: [{ width: 2 }] }

test('pool cutouts rebuild only surfaces near the old or new footprint', () => {
  const before = nodes({ pool, near, far, path })
  expect(affectedPoolCutoutSurfaceIds(nodes({ pool: { ...pool, waterColor: '#ffffff' }, near, far, path }), before)).toEqual([])
  expect(affectedPoolCutoutSurfaceIds(nodes({ pool: { ...pool, copingWidth: 0.4 }, near, far, path }), before)).toEqual(['near'])
  expect(affectedPoolCutoutSurfaceIds(nodes({ pool: { ...pool, position: [100, 0, 0] }, near, far, path }), before))
    .toEqual(['near', 'far', 'path'])
})

test('hiding a pool only updates surfaces around its previous opening', () => {
  const before = nodes({ pool, near, far, path })
  expect(affectedPoolCutoutSurfaceIds(nodes({ pool: { ...pool, visible: false }, near, far, path }), before))
    .toEqual(['near'])
})
