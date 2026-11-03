import { expect, test } from 'bun:test'
import type { GeometryContext } from '@pascal-app/core'
import polygonClipping from 'polygon-clipping'
import { Raycaster, Vector3 } from 'three'
import { poolCutoutSignature, poolCutoutsFor, subtractPoolCutouts } from './pool-cutouts'
import { buildAccessGeometry } from '../ground-access/shared/geometry'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { buildGroundAreaGeometry } from '../ground-areas/rendering/geometry'
import { PatioNode } from '../ground-access/patio/domain/schema'
import { buildPatioGeometry } from '../ground-access/patio/rendering/geometry'
import { DeckNode } from '../ground-access/deck/domain/schema'
import { buildDeckGeometry } from '../ground-access/deck/rendering/geometry'

const surface = {
  id: 'ground-area_a', type: 'landscape:ground-area', parentId: 'level_a',
  position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number],
}
const pool = {
  id: 'pool_a', type: 'pool:pool', parentId: 'level_a', visible: true,
  position: [1, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number],
  polygon: [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][], copingWidth: 0.2,
}
const context = { sceneNodes: { [pool.id]: pool } } as unknown as GeometryContext

test('only invalidates cutouts when their actual pool opening changes', () => {
  const original = poolCutoutSignature(pool)
  expect(poolCutoutSignature({ ...pool, waterColor: '#ff0000', depth: 2, copingColor: '#ffffff' })).toBe(original)
  expect(poolCutoutSignature({ ...pool, position: [2, 5, 0] })).not.toBe(original)
  expect(poolCutoutSignature({ ...pool, copingStyle: 'rock' })).not.toBe(original)
  expect(poolCutoutSignature({ ...pool, visible: false })).toBeNull()
})

test('pool footprints cut landscape surfaces in their local coordinates', () => {
  const cutouts = poolCutoutsFor(surface, context)
  expect(cutouts).toHaveLength(1)
  expect(Math.min(...cutouts[0]![0]!.map(([x]) => x))).toBeCloseTo(-0.213)

  const result = subtractPoolCutouts([[[[-5, -5], [5, -5], [5, 5], [-5, 5]]]], surface, context)
  const remaining = polygonClipping.difference([[[-5, -5], [5, -5], [5, 5], [-5, 5]]], ...cutouts)
  expect(result).toEqual(remaining)
  expect(result[0]?.[1]).toBeDefined()
})

test('circular patio paving ends beyond the flush pool coping', () => {
  const radius = 3
  const circularPool = {
    ...pool,
    position: [0, 0, 0] as [number, number, number],
    polygon: Array.from({ length: 32 }, (_, index): [number, number] => {
      const angle = index / 32 * Math.PI * 2
      return [Math.cos(angle) * radius, Math.sin(angle) * radius]
    }),
    shellThickness: 0.2,
    openingClearance: 0.02,
    copingWidth: 0.3,
    copingStyle: 'continuous',
    copingProfile: 'square',
  }
  const patio = PatioNode.parse({ id: 'patio_ring', parentId: 'level_a',
    shape: 'circle', width: 8, depth: 8 })
  const geometry = buildPatioGeometry(patio, {
    sceneNodes: { [circularPool.id]: circularPool },
  } as unknown as GeometryContext)
  geometry.updateMatrixWorld(true)
  const rayAt = (x: number) => new Raycaster(new Vector3(x, 1, 0), new Vector3(0, -1, 0))
    .intersectObject(geometry, true)

  expect(rayAt(radius + 0.25)).toHaveLength(0)
  expect(rayAt(radius + 0.5).length).toBeGreaterThan(0)
})

test('ignores pools on other levels and pools that are hidden', () => {
  expect(poolCutoutsFor(surface, { sceneNodes: { [pool.id]: { ...pool, parentId: 'level_b' } } } as unknown as GeometryContext)).toHaveLength(0)
  expect(poolCutoutsFor(surface, { sceneNodes: { [pool.id]: { ...pool, visible: false } } } as unknown as GeometryContext)).toHaveLength(0)
})

test.each(['patio', 'deck', 'concrete-slab', 'landing'] as const)('%s geometry has an opening through the pool footprint', (kind) => {
  const node = {
    ...surface, width: 10, depth: 10, thickness: 0.2,
    position: [0, 0, 0] as [number, number, number],
  }
  const geometry = buildAccessGeometry(node as never, kind, context)
  const ray = new Raycaster(new Vector3(1, 1, 0), new Vector3(0, -1, 0))
  geometry.updateMatrixWorld(true)
  expect(ray.intersectObject(geometry, true)).toHaveLength(0)
})

test('paving and deck detail meshes remain clipped around the pool', () => {
  const patio = buildPatioGeometry(PatioNode.parse({
    id: 'patio_a', parentId: 'level_a', width: 10, depth: 10,
  }), context)
  const deck = buildDeckGeometry(DeckNode.parse({
    id: 'deck_a', parentId: 'level_a', width: 10, depth: 10,
  }), context)
  expect(patio.children.some((object) => object.name === 'patio-paver')).toBe(true)
  expect(deck.children.some((object) => object.name === 'deck-board')).toBe(true)
  const ray = new Raycaster(new Vector3(1, 1, 0), new Vector3(0, -1, 0))
  patio.updateMatrixWorld(true)
  deck.updateMatrixWorld(true)
  expect(ray.intersectObject(patio, true)).toHaveLength(0)
  expect(ray.intersectObject(deck, true)).toHaveLength(0)
})

test.each(['grass', 'soil', 'mulch', 'gravel', 'sand', 'mud'] as const)('%s geometry has an opening through the pool footprint', (surfaceType) => {
  const node = GroundAreaNode.parse({
    id: `ground-area_${surfaceType}`, parentId: 'level_a', surface: surfaceType,
    outline: [[-5, -5], [5, -5], [5, 5], [-5, 5]],
  })
  if (surfaceType === 'mud') {
    // Mud's texture loader needs a browser DOM; verify the exact footprint used
    // by its renderer without invoking that browser-only texture path.
    const footprint = subtractPoolCutouts([[node.outline]], node, context)
    expect(footprint[0]?.[1]).toBeDefined()
    return
  }
  const geometry = buildGroundAreaGeometry(node, context)
  const ray = new Raycaster(new Vector3(1, 1, 0), new Vector3(0, -1, 0))
  geometry.updateMatrixWorld(true)
  expect(ray.intersectObject(geometry, true)).toHaveLength(0)
})
