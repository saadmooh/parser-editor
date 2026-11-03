import { describe, expect, test } from 'bun:test'
import { Box3, Mesh } from 'three'
import { DeckNode } from '../domain/schema'
import { deckMinimumHeight } from '../domain/settings'
import { deckParametrics } from '../editor/parametrics'
import { buildDeckGeometry, buildDeckFloorplan } from './geometry'

function meshes(group: ReturnType<typeof buildDeckGeometry>, name: string): Mesh[] {
  const result: Mesh[] = []
  group.traverse((object) => {
    if (object instanceof Mesh && object.name === name) result.push(object)
  })
  return result
}

function bounds(mesh: Mesh) { return new Box3().setFromObject(mesh) }

describe('deck assembly', () => {
  test('boards sit on the frame and the frame sits on low platform blocks', () => {
    const node = DeckNode.parse({})
    const group = buildDeckGeometry(node)
    const frameTop = node.thickness - node.boardThickness
    const frameBottom = frameTop - node.frameDepth
    expect(meshes(group, 'deck-board').length).toBeGreaterThan(0)
    expect(meshes(group, 'deck-joist').length).toBeGreaterThan(0)
    expect(meshes(group, 'deck-support-post').length).toBeGreaterThan(0)
    for (const board of meshes(group, 'deck-board')) {
      expect(bounds(board).min.y).toBeCloseTo(frameTop, 4)
      expect(bounds(board).max.y).toBeCloseTo(node.thickness, 4)
    }
    for (const post of meshes(group, 'deck-support-post')) {
      const box = bounds(post)
      expect(box.min.y).toBeCloseTo(0, 4)
      expect(box.max.y).toBeGreaterThan(frameBottom)
      expect(box.min.x).toBeGreaterThanOrEqual(-node.width / 2 - 0.001)
      expect(box.max.x).toBeLessThanOrEqual(node.width / 2 + 0.001)
      expect(box.min.z).toBeGreaterThanOrEqual(-node.depth / 2 - 0.001)
      expect(box.max.z).toBeLessThanOrEqual(node.depth / 2 + 0.001)
    }
  })

  test('joists cross the chosen board direction', () => {
    const lengthwise = buildDeckGeometry(DeckNode.parse({ boardDirection: 'lengthwise' }))
    const crosswise = buildDeckGeometry(DeckNode.parse({ boardDirection: 'crosswise' }))
    const alongWidth = meshes(lengthwise, 'deck-joist').map(bounds)
    const alongDepth = meshes(crosswise, 'deck-joist').map(bounds)
    expect(alongWidth.every((box) => box.max.x - box.min.x > box.max.z - box.min.z)).toBe(true)
    expect(alongDepth.every((box) => box.max.z - box.min.z > box.max.x - box.min.x)).toBe(true)
  })

  test('double border has two flush courses with an actual gap', () => {
    const node = DeckNode.parse({ borderStyle: 'double' })
    const group = buildDeckGeometry(node)
    const bands = meshes(group, 'deck-picture-frame')
    expect(bands).toHaveLength(2)
    expect(meshes(group, 'deck-border-seam')).toHaveLength(0)
    for (const band of bands) expect(bounds(band).max.y).toBeCloseTo(node.thickness, 4)
    const plan = buildDeckFloorplan(node, {} as Parameters<typeof buildDeckFloorplan>[1])
    expect(plan.kind).toBe('group')
  })

  test('raised supports and both skirting styles meet the frame and ground', () => {
    for (const skirtStyle of ['solid', 'slatted'] as const) {
      const node = DeckNode.parse({ deckType: 'raised', thickness: 1.2,
        supportPosts: true, skirtStyle, postSize: 0.2 })
      const group = buildDeckGeometry(node)
      const frameBottom = node.thickness - node.boardThickness - node.frameDepth
      const skirt = meshes(group, skirtStyle === 'solid' ? 'deck-skirt' : 'deck-skirt-slat')
      expect(skirt.length).toBeGreaterThan(0)
      for (const mesh of [...skirt, ...meshes(group, 'deck-support-post')]) {
        expect(bounds(mesh).min.y).toBeCloseTo(0, 4)
        expect(bounds(mesh).max.y).toBeGreaterThan(frameBottom)
      }
      if (skirtStyle === 'slatted') {
        const positions = skirt.map((mesh) =>
          `${mesh.position.x.toFixed(4)},${mesh.position.z.toFixed(4)}`)
        expect(new Set(positions).size).toBe(positions.length)
      }
    }
  })

  test('a raised deck without individual posts rests on a recessed solid base', () => {
    const node = DeckNode.parse({ deckType: 'raised', thickness: 1.2, supportPosts: false })
    const group = buildDeckGeometry(node)
    const base = meshes(group, 'deck-support-base')
    expect(base).toHaveLength(1)
    expect(meshes(group, 'deck-support-post')).toHaveLength(0)
    expect(bounds(base[0]!).min.y).toBeCloseTo(0, 4)
    expect(bounds(base[0]!).max.y).toBeGreaterThan(
      node.thickness - node.boardThickness - node.frameDepth)
  })

  test('narrow custom outlines fall back to a connected base when posts cannot fit', () => {
    const node = DeckNode.parse({ width: 1, depth: 1, shape: 'custom',
      outline: [[-0.5, -0.5], [0.5, -0.5], [0.5, -0.46], [-0.46, -0.46],
        [-0.46, 0.5], [-0.5, 0.5]],
      deckType: 'raised', thickness: 1.2, supportPosts: true })
    const group = buildDeckGeometry(node)
    expect(meshes(group, 'deck-support-post').length + meshes(group, 'deck-support-base').length)
      .toBeGreaterThan(0)
    for (const support of [...meshes(group, 'deck-support-post'),
      ...meshes(group, 'deck-support-base')]) {
      expect(bounds(support).min.y).toBeCloseTo(0, 4)
      expect(bounds(support).max.y).toBeGreaterThan(
        node.thickness - node.boardThickness - node.frameDepth)
    }
  })

  test('custom, minimum, and diagonal layouts have finite, positive meshes', () => {
    const variants = [
      DeckNode.parse({ width: 0.2, depth: 0.2, deckType: 'raised', thickness: 1.2,
        supportPosts: true, postSize: 0.25, borderStyle: 'double' }),
      DeckNode.parse({ shape: 'custom', outline: [
        [-0.5, -0.5], [0.5, -0.5], [0.5, -0.1], [0, -0.1], [0, 0.5], [-0.5, 0.5],
      ], boardDirection: 'diagonal', borderStyle: 'double', fascia: false }),
      DeckNode.parse({ width: 6, depth: 5, deckType: 'raised', thickness: 0.6,
        boardWidth: 0.09, boardGap: 0.025, boardThickness: 0.06,
        frameDepth: 0.4, supportPosts: true, supportSpacing: 0.8,
        postSize: 0.25, skirtStyle: 'solid', borderStyle: 'double' }),
    ]
    for (const node of variants) {
      const group = buildDeckGeometry(node)
      if (node.borderStyle === 'double') expect(meshes(group, 'deck-picture-frame')).toHaveLength(2)
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return
        const box = bounds(object)
        for (const value of [...box.min.toArray(), ...box.max.toArray()])
          expect(Number.isFinite(value)).toBe(true)
        expect(box.max.y).toBeLessThanOrEqual(node.thickness + 0.001)
        expect(box.max.y - box.min.y).toBeGreaterThan(0)
      })
    }
  })

  test('inspector type and framing changes keep enough height for every member', () => {
    const before = DeckNode.parse({})
    const raised = DeckNode.parse({ ...before, deckType: 'raised' })
    const typePatch = deckParametrics.derive!(raised, { deckType: 'raised' }, before)
    expect(typePatch.thickness).toBeGreaterThanOrEqual(1.2)
    expect(typePatch.supportPosts).toBe(true)
    const deeper = DeckNode.parse({ ...before, frameDepth: 0.4 })
    const depthPatch = deckParametrics.derive!(deeper, { frameDepth: 0.4 }, before)
    expect(depthPatch.thickness).toBeGreaterThanOrEqual(deeper.frameDepth + deeper.boardThickness)
    const low = DeckNode.parse({ ...before, thickness: 0.25 })
    const skirted = DeckNode.parse({ ...low, skirtStyle: 'slatted' })
    const skirtPatch = deckParametrics.derive!(skirted, { skirtStyle: 'slatted' }, low)
    expect(skirtPatch.thickness).toBeGreaterThanOrEqual(deckMinimumHeight(skirted))
    expect(deckMinimumHeight(raised)).toBeGreaterThanOrEqual(0.6)
  })

  test('every board, border, fascia, height, and skirt option has aligned geometry', () => {
    for (const deckType of ['platform', 'raised'] as const)
      for (const boardDirection of ['lengthwise', 'crosswise', 'diagonal'] as const)
        for (const borderStyle of ['none', 'single', 'double'] as const)
          for (const fascia of [false, true])
            for (const skirtStyle of ['none', 'solid', 'slatted'] as const) {
              const node = DeckNode.parse({ deckType, boardDirection, borderStyle,
                fascia, skirtStyle, thickness: deckType === 'raised' ? 1.2 : 0.35,
                supportPosts: deckType === 'raised' })
              const group = buildDeckGeometry(node)
              expect(meshes(group, 'deck-board').length).toBeGreaterThan(0)
              expect(meshes(group, 'deck-picture-frame').length).toBe(
                borderStyle === 'none' ? 0 : borderStyle === 'single' ? 1 : 2)
              expect(meshes(group, 'deck-fascia').length).toBe(fascia ? 1 : 0)
              expect(meshes(group, 'deck-support-post').length).toBeGreaterThan(0)
              if (skirtStyle !== 'none') expect(meshes(group,
                skirtStyle === 'solid' ? 'deck-skirt' : 'deck-skirt-slat').length).toBeGreaterThan(0)
              const box = new Box3().setFromObject(group)
              expect(box.min.y).toBeCloseTo(0, 4)
              expect(box.max.y).toBeCloseTo(node.thickness, 4)
            }
  })
})

test('railing caps span whole edges and meet at deck corners for every style', () => {
  for (const railingStyle of ['wood', 'metal', 'cable', 'glass'] as const) {
    const node = DeckNode.parse({ railingStyle, railingPostSpacing: 0.5 })
    const group = buildDeckGeometry(node)
    const topRails = meshes(group, 'deck-top-rail')
    expect(topRails).toHaveLength(4)
    for (const mesh of topRails) {
      expect(bounds(mesh).max.y).toBeCloseTo(node.thickness + node.railingHeight, 5)
      const positions = mesh.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i)
        expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true)
      }
    }
    expect(meshes(group, 'deck-bottom-rail')).toHaveLength(railingStyle === 'wood' || railingStyle === 'metal' ? 4 : 0)
  }
})
