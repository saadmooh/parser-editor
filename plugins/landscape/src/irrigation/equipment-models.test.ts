import { expect, test } from 'bun:test'
import { Box3, Vector3 } from 'three'
import { IrrigationSourceNode, irrigationSourcePorts } from './source'
import { IrrigationValveNode, irrigationValvePorts } from './valve'
import { irrigationSourceGeometry, irrigationValveGeometry } from './equipment-models'

function dispose(group: import('three').Group) {
  group.traverse(object => {
    const mesh = object as import('three').Mesh
    mesh.geometry?.dispose()
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
}
test('supply outlet model terminates at its socket and gauge responds to pressure', () => {
  const node = IrrigationSourceNode.parse({})
  const model = irrigationSourceGeometry(node)
  const pipe = model.getObjectByName('Black outlet pipe')!
  const bounds = new Box3().setFromObject(pipe)
  expect(bounds.max.x).toBeCloseTo(irrigationSourcePorts(node)[0]!.position[0])
  expect(bounds.getCenter(new Vector3()).y).toBeCloseTo(.1)
  const off = irrigationSourceGeometry({ ...node, enabled: false })
  expect(model.getObjectByName('Pressure needle')!.rotation.z).not.toBe(off.getObjectByName('Pressure needle')!.rotation.z)
  dispose(model); dispose(off)
})
test('valve model matches both sockets and handle indicates open or closed', () => {
  const node = IrrigationValveNode.parse({})
  const model = irrigationValveGeometry(node)
  const inlet = new Box3().setFromObject(model.getObjectByName('Black inlet pipe')!)
  const outlet = new Box3().setFromObject(model.getObjectByName('Black outlet pipe')!)
  const ports = irrigationValvePorts(node)
  expect(inlet.min.x).toBeCloseTo(ports[0]!.position[0])
  expect(outlet.max.x).toBeCloseTo(ports[1]!.position[0])
  expect(outlet.getCenter(new Vector3()).y).toBeCloseTo(ports[1]!.position[1])
  const closed = irrigationValveGeometry({ ...node, isOpen: false })
  expect(model.getObjectByName('Valve handle')!.rotation.y).toBe(0)
  expect(closed.getObjectByName('Valve handle')!.rotation.y).toBeCloseTo(Math.PI / 2)
  dispose(model); dispose(closed)
})

test('controller cabinet has a finite grounded footprint and reflects its schedule and enabled state', async () => {
  const { IrrigationControllerNode } = await import('./controller')
  const { irrigationControllerGeometry } = await import('./controller-model')
  const node = IrrigationControllerNode.parse({ startTime: '05:30', stations: Array.from({ length: 8 }, (_, i) => ({ enabled: true, runMinutes: 20, ...(i === 0 ? { valveId: 'valve_test' } : {}) })) })
  const model = irrigationControllerGeometry(node), off = irrigationControllerGeometry({ ...node, enabled: false })
  const bounds = new Box3().setFromObject(model)
  expect(bounds.min.y).toBeCloseTo(0)
  expect(bounds.max.y).toBeLessThan(1.01)
  expect(bounds.max.x - bounds.min.x).toBeLessThan(.4)
  expect(bounds.max.z - bounds.min.z).toBeLessThan(.25)
  expect(model.getObjectByName('Weatherproof enclosure')).toBeDefined()
  expect(model.getObjectByName('Program dial')).toBeDefined()
  expect(model.getObjectByName('Time digit 0 segment a')).toBeDefined()
  expect(off.getObjectByName('Time digit 0 segment a')).toBeUndefined()
  const color = (group: import('three').Group, name: string) => ((group.getObjectByName(name) as import('three').Mesh).material as import('three').MeshStandardMaterial).color.getHex()
  expect(color(model, 'Station 1 indicator')).not.toBe(color(model, 'Station 2 indicator'))
  expect(color(off, 'Station 1 indicator')).toBe(color(off, 'Station 2 indicator'))
  dispose(model); dispose(off)
})
