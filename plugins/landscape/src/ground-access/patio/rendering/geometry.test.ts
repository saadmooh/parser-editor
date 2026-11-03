import { describe, expect, test } from 'bun:test'
import { Mesh } from 'three'
import { PatioNode } from '../domain/schema'
import { buildPatioFloorplan, buildPatioGeometry, patioTiles } from './geometry'
import type { GeometryContext } from '@pascal-app/core'

describe('patio paving', () => {
  test('renders a saved starter patio without paving or drainage fields', () => {
    const legacy = { ...PatioNode.parse({}) } as Record<string, unknown>
    for (const field of ['elevation', 'slopePercent', 'drainDirection', 'finish', 'pattern',
      'paverWidth', 'paverDepth', 'jointWidth', 'borderStyle', 'borderWidth',
      'fieldColor', 'borderColor']) delete legacy[field]
    const geometry = buildPatioGeometry(legacy as PatioNode)
    expect(geometry.getObjectByName('patio-base')).toBeTruthy()
    expect(geometry.getObjectByName('patio-pavers')).toBeTruthy()
    expect(buildPatioFloorplan(legacy as PatioNode, {} as GeometryContext).kind).toBe('group')
  })

  test('running bond cuts edge pavers to the field and keeps joints open', () => {
    const node = PatioNode.parse({ width: 3.1, depth: 2.2, paverWidth: 0.6,
      paverDepth: 0.4, jointWidth: 0.02, borderWidth: 0.16 })
    const tiles = patioTiles(node)
    const halfWidth = node.width / 2 - node.borderWidth
    const halfDepth = node.depth / 2 - node.borderWidth
    expect(tiles.length).toBeGreaterThan(0)
    for (const tile of tiles) {
      expect(tile.w).toBeGreaterThan(0)
      expect(tile.d).toBeGreaterThan(0)
      expect(Math.abs(tile.x) + tile.w / 2).toBeLessThanOrEqual(halfWidth + 0.001)
      expect(Math.abs(tile.z) + tile.d / 2).toBeLessThanOrEqual(halfDepth + 0.001)
    }
  })

  test('minimum patio size produces only finite, positive geometry', () => {
    const group = buildPatioGeometry(PatioNode.parse({ width: 0.2, depth: 0.2 }))
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.computeBoundingBox()
      const box = object.geometry.boundingBox!
      for (const value of [...box.min.toArray(), ...box.max.toArray()]) expect(Number.isFinite(value)).toBe(true)
      expect(box.max.x - box.min.x).toBeGreaterThan(0)
      expect(box.max.y - box.min.y).toBeGreaterThan(0)
      expect(box.max.z - box.min.z).toBeGreaterThan(0)
    })
  })

  test('drainage direction pitches the base toward its low edge', () => {
    const node = PatioNode.parse({ width: 3, depth: 4, slopePercent: 2, drainDirection: 'back' })
    const group = buildPatioGeometry(node)
    const base = group.getObjectByName('patio-base') as Mesh
    const position = base.geometry.getAttribute('position')
    let front = Number.NEGATIVE_INFINITY
    let back = Number.NEGATIVE_INFINITY
    for (let i = 0; i < position.count; i++) {
      if (position.getZ(i) < 0) front = Math.max(front, position.getY(i))
      else back = Math.max(back, position.getY(i))
    }
    expect(front - back).toBeCloseTo(node.depth * node.slopePercent / 100)
  })
})
