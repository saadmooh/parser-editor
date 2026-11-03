import { expect, test } from 'bun:test'
import { PathwayNode } from './schema'
import { derivePathwaySettings, drawingWidth, STONE_WALKWAY_PRESET } from './settings'
import { addCurves } from './network'
import { lerp, type Curve } from './curves'

test('default drawing width is 1.2 m and the reference stone preset is 1.8 m', () => {
  expect(drawingWidth(undefined)).toBe(1.2)
  expect(drawingWidth({ width: Number.NaN })).toBe(1.2)
  expect(drawingWidth({ width: 0.3 })).toBe(1.2)
  expect(drawingWidth(STONE_WALKWAY_PRESET)).toBe(1.8)
  expect(drawingWidth({ width: 0.3, defaultWidth: 1.8 })).toBe(1.8)
})

test('changing pathway width resizes the existing mesh edges, changing finish preserves width', () => {
  const a: [number, number] = [0, 0], b: [number, number] = [4, 0]
  const curve: Curve = [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]
  const node = PathwayNode.parse({ ...addCurves({ vertices: [], edges: [] }, [curve], 1.2), defaultWidth: 1.8 })
  const patch = derivePathwaySettings(node, { defaultWidth: 1.8 })
  expect(patch.edges?.every((edge) => edge.width === 1.8)).toBe(true)
  expect(derivePathwaySettings({ ...node, finish: 'laidStone' }, { finish: 'laidStone' }).edges).toBeUndefined()
})
