import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { coverageOutline, irrigationHeadFloorplan, irrigationHeadGeometry } from './geometry'
import { Mesh } from 'three'

test('quarter arc reach follows authored position and yaw', () => {
  const node = IrrigationHeadNode.parse({ radius: 3, arc: 90, position: [2, 0, 4], rotation: [0, Math.PI / 2, 0] })
  const outline = coverageOutline(node)
  expect(outline[0]).toEqual([2, 4])
  expect(outline[1]![0]).toBeCloseTo(5)
  expect(outline[1]![1]).toBeCloseTo(4)
  expect(outline.at(-1)![0]).toBeCloseTo(2)
  expect(outline.at(-1)![1]).toBeCloseTo(1)
})

test('3D reach is local, non-interactive and respects the same coverage toggle', () => {
  const node = IrrigationHeadNode.parse({ radius: 3, arc: 90, position: [20, 2, 40], rotation: [0, Math.PI / 2, 0] })
  const group = irrigationHeadGeometry(node)
  const reach = group.getObjectByName('Authored irrigation reach') as Mesh
  reach.geometry.computeBoundingBox()
  expect(reach.geometry.boundingBox!.min.x).toBeCloseTo(0)
  expect(reach.geometry.boundingBox!.max.x).toBeCloseTo(3)
  expect(reach.geometry.boundingBox!.min.z).toBeCloseTo(0)
  expect(reach.geometry.boundingBox!.max.z).toBeCloseTo(3)
  const hits: unknown[] = []
  reach.raycast({} as never, hits as never)
  expect(hits).toHaveLength(0)
  expect(irrigationHeadGeometry({ ...node, showCoverage: false }).children).toHaveLength(1)
  group.traverse((object) => {
    const renderable = object as Mesh
    renderable.geometry?.dispose()
    if (renderable.material) for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) material.dispose()
  })
})

test('coverage toggle removes the reach polygon but retains the outlet and zone', () => {
  const node = IrrigationHeadNode.parse({ showCoverage: false, zone: 'West border' })
  const geometry = irrigationHeadFloorplan(node)
  expect(geometry.kind).toBe('group')
  if (geometry.kind !== 'group') throw new Error('Missing head symbol')
  expect(geometry.children.some((child) => child.kind === 'polygon')).toBe(false)
  expect(geometry.children.some((child) => child.kind === 'circle')).toBe(true)
  expect(geometry.children.some((child) => child.kind === 'text' && child.text === 'West border')).toBe(true)
  expect(IrrigationHeadNode.safeParse({ radius: Infinity }).success).toBe(false)
  expect(IrrigationHeadNode.safeParse({ arc: 361 }).success).toBe(false)
})
