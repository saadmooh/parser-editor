import { describe, expect, test } from 'bun:test'
import { Raycaster, Vector3 } from 'three'
import { concreteSlabDefinition } from '../concrete-slab/definition'
import { ConcreteSlabNode } from '../concrete-slab/domain/schema'
import { deckDefinition } from '../deck/definition'
import { DeckNode } from '../deck/domain/schema'
import { landingDefinition } from '../landing/definition'
import { LandingNode } from '../landing/domain/schema'
import { patioDefinition } from '../patio/definition'
import { PatioNode } from '../patio/domain/schema'
import { buildPatioGeometry } from '../patio/rendering/geometry'

describe('ground access placement surfaces', () => {
  test('exposes patio paving at its finished elevation', () => {
    const patio = PatioNode.parse({ shape: 'circle', width: 6, depth: 6,
      elevation: 0.3, thickness: 0.18, slopePercent: 0 })
    const top = patioDefinition.capabilities.surfaces?.top?.height
    expect(typeof top).toBe('function')
    if (typeof top !== 'function') return
    expect(top(patio as never, { nodes: { [patio.id]: patio as never } })).toBeCloseTo(0.3 + 0.18 + 0.045)

    const geometry = buildPatioGeometry(patio)
    geometry.updateMatrixWorld(true)
    const ray = new Raycaster(new Vector3(0.2, 5, 0.2), new Vector3(0, -1, 0))
    const hit = ray.intersectObject(geometry, true)[0]
    expect(hit).toBeDefined()
    expect(hit!.point.y).toBeGreaterThanOrEqual(0.3 + 0.18)
  })

  test('exposes deck, concrete slab, and landing tops', () => {
    const surfaces = [
      [deckDefinition, DeckNode.parse({ thickness: 0.4 })],
      [concreteSlabDefinition, ConcreteSlabNode.parse({ thickness: 0.2 })],
      [landingDefinition, LandingNode.parse({ thickness: 0.15 })],
    ] as const
    for (const [definition, node] of surfaces) {
      const height = definition.capabilities.surfaces?.top?.height
      expect(typeof height).toBe('function')
      if (typeof height === 'function') {
        expect(height(node as never, { nodes: { [node.id]: node as never } })).toBeCloseTo(node.thickness)
      }
    }
  })
})
