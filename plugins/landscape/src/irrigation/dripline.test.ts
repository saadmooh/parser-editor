import { expect, test } from 'bun:test'
import { DriplineNode, driplinePorts, driplineEmitterPoints, driplineMetrics, driplineGeometry, driplineDefinition } from './dripline'
import { IrrigationHeadNode } from './schema'
import { irrigationZones } from './zones'
test('dripline stations follow bends without duplicating junction emitters', () => {
  const line = DriplineNode.parse({ path: [[0, 0, 0], [1, 0, 0], [1, 0, 2]], emitterSpacing: 0.5, emitterFlow: 2 })
  const points = driplineEmitterPoints(line)
  expect(points).toEqual([[0, 0, 0], [0.5, 0, 0], [1, 0, 0], [1, 0, 0.5], [1, 0, 1], [1, 0, 1.5], [1, 0, 2]])
  expect(driplineMetrics(line).emitters).toBe(7)
  expect(driplineMetrics(line).flow).toBeCloseTo(14 / 60)
  const zones = irrigationZones([IrrigationHeadNode.parse({ flow: 4 })], [line])
  expect(zones[0]!.flow).toBeCloseTo(4 + 14 / 60)
  expect(zones[0]!.driplines).toHaveLength(1)
})
test('dripline sampling stays within final station and bounds large/invalid lines', () => {
  const line = DriplineNode.parse({ path: [[0, 0, 0], [3, 0, 0]], emitterSpacing: 0.4 })
  expect(driplineEmitterPoints(line).at(-1)![0]).toBeCloseTo(2.8)
  expect(DriplineNode.safeParse({ path: [[0, 0, 0], [301, 0, 0]] }).success).toBe(false)
  expect(DriplineNode.safeParse({ emitterSpacing: 0 }).success).toBe(false)
  expect(driplineMetrics(DriplineNode.parse({ path: [[0, 0, 0], [300, 0, 0]], emitterSpacing: 0.1 })).emitters).toBe(3001)
})

test('dripline inlet uses first vertex and first nonzero segment', () => {
  const node = DriplineNode.parse({ path: [[1, 2, 3], [1, 2, 3], [4, 2, 3]], diameter: 0.75 })
  expect(driplinePorts(node)[0]!.position).toEqual([1, 2, 3])
  expect(driplinePorts(node)[0]!.direction).toEqual([-1, 0, 0])
  expect(driplinePorts(node)[0]!.diameter).toBe(0.75)
  expect(driplinePorts(node)[0]!.system).toBe('irrigation')
})


test('dripline tubing is black with visible plan edges and continuous bend joints', () => {
  const node = DriplineNode.parse({ path: [[0, 0, 0], [1, 0, 0], [1, 0, 1]] })
  const group = driplineGeometry(node)
  const tube = group.getObjectByName('Black drip tubing') as import('three').Mesh<import('three').CylinderGeometry, import('three').MeshStandardMaterial>
  expect(tube.material.color.getHexString()).toBe('111111')
  expect(group.getObjectByName('Dripline bends')).toBeDefined()
  expect(group.getObjectByName('Drip emitters')).toBeDefined()
  const plan = driplineDefinition.floorplan!(node, {} as never)
  if (!plan || plan.kind !== 'group') throw new Error('Missing dripline plan')
  expect(plan.children.some(p => p.kind === 'polyline' && p.stroke === '#111111')).toBe(true)
  expect(plan.children.some(p => p.kind === 'polyline' && p.stroke === '#ffffff')).toBe(true)
  group.traverse(object => {
    const mesh = object as import('three').Mesh
    mesh.geometry?.dispose()
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
})
