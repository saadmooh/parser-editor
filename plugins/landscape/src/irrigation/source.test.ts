import { expect, test } from 'bun:test'
import { IrrigationSourceNode, irrigationSourcePorts } from './source'
test('source outlet uses parent-local pose and nominal inch diameter even disabled', () => {
  const source = IrrigationSourceNode.parse({ position: [1, 2, 3], rotation: [0, Math.PI / 2, 0], diameter: 0.75, enabled: false })
  const port = irrigationSourcePorts(source)[0]!
  expect(port.position[0]).toBeCloseTo(1)
  expect(port.position[1]).toBeCloseTo(2.1)
  expect(port.position[2]).toBeCloseTo(2.8)
  expect(port.direction[2]).toBeCloseTo(-1)
  expect(port.diameter).toBe(0.75)
  expect(port.system).toBe('irrigation')
  expect(IrrigationSourceNode.safeParse({ pressureBar: -1 }).success).toBe(false)
  expect(IrrigationSourceNode.safeParse({ availableFlow: Infinity }).success).toBe(false)
})
