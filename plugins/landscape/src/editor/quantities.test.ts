import { expect, test } from 'bun:test'
import type { AnyNode, GeometryContext } from '@pascal-app/core'
import { DeckNode } from '../ground-access/deck/domain/schema'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { PathwayNode } from '../pathways/domain/schema'
import { landscapeQuantity, materialTakeoffCsv, orderingArea, quantitiesCsv, quantityExport } from './quantities'

const node = (fields: Record<string, unknown>) => fields as unknown as AnyNode
test('each CSV export selects its own data and includes a UTF-8 BOM', () => {
  const rows = [{ id: 'deck', label: 'Deck', material: 'cedar', count: 1, area: 10, netArea: 8, length: null }]
  expect(quantityExport(rows, 10)).toEqual({ filename: 'landscape-quantities.csv', content: '\uFEFF' + quantitiesCsv(rows, 10) })
  expect(quantityExport(rows, 10, true)).toEqual({ filename: 'landscape-material-takeoff.csv', content: '\uFEFF' + materialTakeoffCsv(rows, 10) })
})
test('net grass quantities reuse rendered slab and ground-cover exclusions', () => {
  const grass = GroundAreaNode.parse({ surface: 'grass', parentId: 'level_a', outline: [[0, 0], [10, 0], [10, 10], [0, 10]] })
  const soil = GroundAreaNode.parse({ surface: 'soil', parentId: 'level_a', outline: [[0, 0], [2, 0], [2, 2], [0, 2]] })
  const slab = node({ id: 'slab_a', type: 'slab', parentId: 'level_a', elevation: 0.1, thickness: 0.1, polygon: [[1, 0], [3, 0], [3, 2], [1, 2]], holes: [] })
  const ctx = { sceneNodes: { [soil.id]: soil, [slab.id]: slab } } as unknown as GeometryContext
  const quantity = landscapeQuantity(grass as unknown as AnyNode, ctx)
  expect(quantity.area).toBe(100)
  // Overlapping exclusions are unioned rather than double-counted.
  expect(quantity.netArea).toBe(94)
  expect(landscapeQuantity(soil as unknown as AnyNode, ctx).netArea).toBe(4)
})
test('surface quantities respect scaled custom outlines and elliptical shapes', () => {
  expect(landscapeQuantity(node({ id: 'patio', type: 'landscape:patio', width: 4, depth: 3, shape: 'custom', outline: [[0, 0], [1, 0], [0, 1]] })).area).toBe(6)
  expect(landscapeQuantity(node({ id: 'patio', type: 'landscape:patio', width: 4, depth: 3, shape: 'oval' })).area).toBeCloseTo(Math.PI * 3)
})
test('path quantities measure geometry instead of its bounding rectangle', () => {
  const path = PathwayNode.parse({ vertices: [{ id: 'a', point: [0, 0] }, { id: 'b', point: [10, 0] }],
    edges: [{ id: 'ab', from: 'a', to: 'b', width: 2 }], cornerStyle: 'square' })
  const result = landscapeQuantity(path as unknown as AnyNode)
  expect(result.length).toBeCloseTo(10)
  expect(result.area).toBeCloseTo(20)
})
test('CSV quotes labels and neutralizes spreadsheet formulas', () => {
  expect(quantitiesCsv([{ id: '1', label: '=SUM(1,2)', material: 'stone "A"', count: 1, area: null, length: null }]))
    .toContain('"\'=SUM(1,2)","stone ""A"""')
})

test('path net area subtracts pool openings and measures individual stones between gaps', () => {
  const path = PathwayNode.parse({ parentId: 'level_a', finish: 'concrete',
    vertices: [{ id: 'a', point: [0, 0] }, { id: 'b', point: [10, 0] }],
    edges: [{ id: 'ab', from: 'a', to: 'b', width: 2 }], cornerStyle: 'square' })
  const pool = node({ id: 'pool_a', type: 'pool:pool', parentId: 'level_a', visible: true,
    polygon: [[4, -2], [6, -2], [6, 2], [4, 2]], copingWidth: 0 })
  const context = { sceneNodes: { pool_a: pool } } as unknown as GeometryContext
  const result = landscapeQuantity(path as unknown as AnyNode, context)
  expect(result.area).toBeCloseTo(20)
  expect(result.netArea).toBeCloseTo(20 - 2 * (2 + 2 * 0.025))
  expect(landscapeQuantity(path as unknown as AnyNode,
    { sceneNodes: { pool_a: { ...pool, visible: false } } } as unknown as GeometryContext).netArea).toBeCloseTo(20)
  for (const finish of ['laidStone', 'grassFlagstones', 'riverStones', 'steppingStones'] as const) {
    const loose = landscapeQuantity({ ...path, finish } as unknown as AnyNode, context)
    const uncut = landscapeQuantity({ ...path, finish } as unknown as AnyNode,
      { sceneNodes: {} } as unknown as GeometryContext)
    expect(loose.netArea!).toBeGreaterThan(0)
    expect(loose.netArea!).toBeLessThan(uncut.netArea!)
    expect(uncut.netArea!).toBeLessThan(uncut.area!)
    expect(orderingArea(loose, 10)).toBeCloseTo(loose.netArea! * 1.1)
  }
})

test('patio authored slope is exported without inventing grades for other objects', () => {
  const patio = landscapeQuantity(node({ id: 'patio', type: 'landscape:patio', slopePercent: 2.5 }))
  expect(patio.slopePercent).toBe(2.5)
  expect(quantitiesCsv([patio])).toContain('"2.50"')
  expect(landscapeQuantity(node({ id: 'deck', type: 'landscape:deck' })).slopePercent).toBeUndefined()
})

test('net hardscape quantity subtracts visible same-parent pool openings with coping clearance', () => {
  const deck = DeckNode.parse({ width: 10, depth: 10, parentId: 'level_a' }) as unknown as AnyNode
  const pool = node({ id: 'pool_a', type: 'pool:pool', parentId: 'level_a', visible: true,
    polygon: [[-1, -1], [1, -1], [1, 1], [-1, 1]], copingWidth: 0.2 })
  const context = { sceneNodes: { pool_a: pool } } as unknown as GeometryContext
  expect(landscapeQuantity(deck, context).netArea).toBeCloseTo(100 - (2 + 2 * 0.213) ** 2)
  expect(landscapeQuantity(deck, { sceneNodes: { pool_a: { ...pool, visible: false } } } as unknown as GeometryContext).netArea).toBe(100)
})

test('ordering allowance is separate from measured area and rejects invalid percentages', () => {
  const row = { id: 'deck', label: 'Deck', material: 'cedar', count: 1, area: 100, length: null, netArea: 90 }
  expect(orderingArea(row, 10)).toBeCloseTo(99)
  expect(row.netArea).toBe(90)
  expect(orderingArea(row, -1)).toBeNull()
  expect(orderingArea(row, NaN)).toBeNull()
  expect(quantitiesCsv([row], 10)).toContain('"90.00","10","99.00"')
})
