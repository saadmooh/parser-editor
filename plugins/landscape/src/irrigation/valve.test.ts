import { expect, test } from 'bun:test'
import { IrrigationValveNode, irrigationValvePorts } from './valve'
test('valve sockets retain irrigation identity, nominal inches and yaw in either flow state', () => {
  const node = IrrigationValveNode.parse({ position: [2, 0.2, 4], rotation: [0, Math.PI / 2, 0], diameter: 0.75 })
  const ports = irrigationValvePorts(node)
  expect(ports.map(port => port.id)).toEqual(['inlet', 'outlet'])
  expect(ports.map(port => port.system)).toEqual(['irrigation', 'irrigation'])
  expect(ports.map(port => port.diameter)).toEqual([0.75, 0.75])
  expect(ports[0]!.position[0]).toBeCloseTo(2)
  expect(ports[0]!.position[1]).toBeCloseTo(0.26)
  expect(ports[0]!.position[2]).toBeCloseTo(4.15)
  expect(ports[1]!.direction[2]).toBeCloseTo(-1)
  expect(irrigationValvePorts({ ...node, isOpen: false })).toEqual(ports)
  expect(IrrigationValveNode.safeParse({ diameter: Infinity }).success).toBe(false)
})
