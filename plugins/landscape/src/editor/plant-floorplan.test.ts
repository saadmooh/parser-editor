import { expect, test } from 'bun:test'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import { PlantNode } from '../plant/domain/schema'
import { TreeNode } from '../tree/domain/schema'
import { buildPlantFloorplan, buildTreeFloorplan } from './plant-floorplan'

const context = {} as GeometryContext
const children = (geometry: FloorplanGeometry) => geometry.kind === 'group' ? geometry.children : []
test('stroke ghosts draw every footprint and reject malformed preview entries', () => {
  const node = PlantNode.parse({ preset: 'fab:daisy', metadata: { landscapeStrokePreview: [
    [2, 3, 0.4, 'brush'], [5, 6, 1, 'erase'], [0, 0, -1, 'brush'], ['bad', 0, 1, 'erase'],
  ] } })
  const geometry = children(buildPlantFloorplan(node, context))
  expect(geometry).toHaveLength(2)
  expect(geometry[0]).toMatchObject({ kind: 'circle', cx: 2, cy: 3, r: 0.4, stroke: '#818cf8', pointerEvents: 'none' })
  expect(geometry[1]).toMatchObject({ kind: 'circle', cx: 5, cy: 6, r: 1, stroke: '#e87979', pointerEvents: 'none' })
})
test('plant labels are optional, identify the preset and sit outside its symbol', () => {
  const node = PlantNode.parse({ preset: 'fab:daisy', position: [2, 0, 3] })
  expect(children(buildPlantFloorplan(node, context)).some((child) => child.kind === 'text')).toBe(false)
  const labelled = children(buildPlantFloorplan({ ...node, metadata: { landscapePlanLabel: true } }, context))
  const text = labelled.find((child) => child.kind === 'text')
  expect(text?.kind).toBe('text')
  if (text?.kind !== 'text') throw new Error('Missing plant label')
  expect(text.text).toBe('Daisy')
  expect(text.upright).toBe(true)
  expect(text.x).toBe(2)
  expect(text.y).toBeGreaterThan(3)
})
test('tree labels identify species while keeping selection affordances', () => {
  const node = TreeNode.parse({ species: 'whiteOak', metadata: { landscapePlanLabel: true } })
  const geometry = children(buildTreeFloorplan(node, { ...context, viewState: { selected: true } as GeometryContext['viewState'] }))
  expect(geometry.some((child) => child.kind === 'text' && child.text === 'White Oak')).toBe(true)
  expect(geometry.some((child) => child.kind === 'move-handle')).toBe(true)
})

test('coded plan labels agree with the planting legend', () => {
  const plant = PlantNode.parse({ preset: 'fab:daisy', metadata: { landscapePlanLabel: true, landscapePlanLabelStyle: 'code' } })
  const tree = TreeNode.parse({ species: 'whiteOak', metadata: { landscapePlanLabel: true, landscapePlanLabelStyle: 'code' } })
  expect(children(buildPlantFloorplan(plant, context)).some((child) => child.kind === 'text' && child.text === 'P-DAI')).toBe(true)
  expect(children(buildTreeFloorplan(tree, context)).some((child) => child.kind === 'text' && child.text === 'T-WO')).toBe(true)
})
