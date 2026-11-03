import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeDefinition, StairNode, StairSegmentNode, LevelNode, SlabNode, spatialGridManager, nodeRegistry, registerNode, getFloorStackedPosition } from '@pascal-app/core'
import { DeckNode } from '../deck/domain/schema'
import { PatioNode } from '../patio/domain/schema'
import { stairAttachmentUpdates } from './stair-attachment'

test('attaches to the surface without changing the stair world pose, then detaches', () => {
  const patio = PatioNode.parse({ id: 'patio_1', parentId: 'level_1',
    position: [4, 0, 3], rotation: [0, Math.PI / 2, 0] })
  const stair = StairNode.parse({ id: 'stair_1', parentId: 'level_1',
    position: [5, 0, 2], rotation: Math.PI / 2, destinationSurfaceId: patio.id })
  const attach = stairAttachmentUpdates({ [patio.id]: patio as unknown as AnyNode, [stair.id]: stair })
  expect(attach).toHaveLength(1)
  expect(attach[0]!.data.parentId).toBe(patio.id)
  expect(attach[0]!.data.position?.[0]).toBeCloseTo(1)
  expect(attach[0]!.data.position?.[2]).toBeCloseTo(1)
  expect(attach[0]!.data.rotation).toBeCloseTo(0)

  const moveStart = stairAttachmentUpdates({ [patio.id]: patio as unknown as AnyNode,
    [stair.id]: { ...stair, ...attach[0]!.data } as AnyNode }, stair.id)
  expect(moveStart[0]!.data.parentId).toBe('level_1')
  expect(moveStart[0]!.data.destinationSurfaceId).toBeUndefined()
  const movedAway = { ...stair, ...attach[0]!.data, ...moveStart[0]!.data,
    position: [8, 0, 8] as [number, number, number], destinationSurfaceId: undefined }
  expect(stairAttachmentUpdates({ [patio.id]: patio as unknown as AnyNode,
    [stair.id]: movedAway as AnyNode })).toEqual([])

  const attached = { ...stair, ...attach[0]!.data, destinationSurfaceId: undefined }
  const detach = stairAttachmentUpdates({ [patio.id]: patio as unknown as AnyNode,
    [stair.id]: attached as AnyNode })
  expect(detach).toHaveLength(1)
  expect(detach[0]!.data.parentId).toBe('level_1')
  expect(detach[0]!.data.position?.[0]).toBeCloseTo(5)
  expect(detach[0]!.data.position?.[2]).toBeCloseTo(2)
  expect(detach[0]!.data.rotation).toBeCloseTo(Math.PI / 2)
})

test('deck height changes resize the attached flight and preserve its ground elevation', () => {
  const deck = DeckNode.parse({ id: 'deck_1', parentId: 'level_1', thickness: 0.35 })
  const stair = StairNode.parse({ id: 'stair_1', parentId: deck.id,
    destinationSurfaceId: deck.id, position: [0, 0, -2], children: ['sseg_1'],
    totalRise: 0.35, stepCount: 2 })
  const flight = StairSegmentNode.parse({ id: 'sseg_1', parentId: stair.id,
    length: 2, height: 0.35, stepCount: 2 })
  const scene = (surface: typeof deck) => ({ [surface.id]: surface as unknown as AnyNode,
    [stair.id]: stair, [flight.id]: flight })
  const raised = { ...deck, thickness: 1.2, position: [0, 0.2, 0] as [number, number, number] }
  const updates = stairAttachmentUpdates(scene(raised), undefined, scene(deck))
  expect(updates.find((update) => update.id === stair.id)?.data).toMatchObject({
    position: [0, -0.2, -2], totalRise: 1.4, stepCount: 9,
  })
  expect(updates.find((update) => update.id === flight.id)?.data).toMatchObject({
    height: 1.4, stepCount: 9,
  })
  const updated = { ...stair, ...updates.find((update) => update.id === stair.id)?.data }
  const updatedFlight = { ...flight, ...updates.find((update) => update.id === flight.id)?.data }
  expect(stairAttachmentUpdates({ [deck.id]: raised as unknown as AnyNode,
    [stair.id]: updated as AnyNode, [flight.id]: updatedFlight as AnyNode })).toEqual([])
})

test('patio elevation and slope set the rise at the stair high end', () => {
  const patio = PatioNode.parse({ id: 'patio_1', parentId: 'level_1', thickness: 0.12,
    elevation: 0.3, slopePercent: 2, drainDirection: 'front' })
  const stair = StairNode.parse({ id: 'stair_1', parentId: patio.id,
    destinationSurfaceId: patio.id, position: [0, 0, -2], children: ['sseg_1'] })
  const flight = StairSegmentNode.parse({ id: 'sseg_1', parentId: stair.id, length: 2 })
  const updates = stairAttachmentUpdates({ [patio.id]: patio as unknown as AnyNode,
    [stair.id]: stair, [flight.id]: flight })
  expect(updates.find((update) => update.id === stair.id)?.data.totalRise).toBeCloseTo(0.46, 5)
  expect(updates.find((update) => update.id === flight.id)?.data.height).toBeCloseTo(0.46, 5)
})

test('resizing an attached deck carries the stair along its side edge', () => {
  const deck = DeckNode.parse({ id: 'deck_1', parentId: 'level_1', width: 4, depth: 3 })
  const stair = StairNode.parse({ id: 'stair_1', parentId: deck.id,
    destinationSurfaceId: deck.id, position: [0.5, 0, -3.5], children: ['sseg_1'] })
  const flight = StairSegmentNode.parse({ id: 'sseg_1', parentId: stair.id, length: 2 })
  const scene = (surface: typeof deck, attachedStair = stair) => ({
    [deck.id]: surface as unknown as AnyNode, [stair.id]: attachedStair, [flight.id]: flight,
  })
  const resized = { ...deck, width: 6, depth: 5 }
  const updates = stairAttachmentUpdates(scene(resized), undefined, scene(deck))
  expect(updates.find((update) => update.id === stair.id)?.data.position).toEqual([0.75, 0, -4.5])
  const moved = { ...resized, position: [3, 0, 4] as [number, number, number] }
  const attached = { ...stair, position: [0.75, 0, -4.5] as [number, number, number] }
  expect(stairAttachmentUpdates(scene(moved, attached), undefined, scene(resized, attached))
    .find((update) => update.id === stair.id)?.data.position).toBeUndefined()
})

test('reparenting a snapped stair preserves its raised source floor in both directions', () => {
  const restore = nodeRegistry._snapshot()
  registerNode({ kind: 'stair', schemaVersion: 1, schema: StairNode, category: 'structure', defaults: () => ({}),
    capabilities: { floorPlaced: { footprint: () => ({ dimensions: [1, 1, 1], rotation: [0, 0, 0] }) } }
  } as AnyNodeDefinition)
  try {
    const level = LevelNode.parse({ id: 'level_raised', level: 0, baseElevation: 0.2 })
    const slab = SlabNode.parse({ id: 'slab_raised', parentId: level.id, elevation: 0.2, polygon: [[-10, -10], [10, -10], [10, 10], [-10, 10]] })
    spatialGridManager.clear()
    spatialGridManager.handleNodeCreated(slab, level.id)
    const deck = DeckNode.parse({ id: 'deck_raised', parentId: level.id, thickness: 1.2 })
    const stair = StairNode.parse({ id: 'stair_raised', parentId: level.id, destinationSurfaceId: deck.id, position: [0, 0, -3] })
    const nodes: Record<string, AnyNode> = { [slab.id]: slab, [level.id]: level, [deck.id]: deck as unknown as AnyNode, [stair.id]: stair }
    const base = getFloorStackedPosition({ node: stair, nodes, position: stair.position })[1]
    expect(base).toBeCloseTo(0.2)
    const patch = stairAttachmentUpdates(nodes).find(update => update.id === stair.id)!.data
    expect(patch.position?.[1]).toBeCloseTo(base)
    const attached = { ...stair, ...patch } as AnyNode
    const detach = stairAttachmentUpdates({ ...nodes, [stair.id]: attached }, stair.id).find(update => update.id === stair.id)!.data
    const detached = { ...stair, ...detach } as typeof stair
    expect(getFloorStackedPosition({ node: detached, nodes, position: detached.position })[1]).toBeCloseTo(base)
  } finally {
    spatialGridManager.clear()
    restore()
  }
})
