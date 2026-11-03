import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { createSprinklerSpray, updateSprinklerSpray } from './spray'

test('droplets animate inside local reach and quarter arc without intercepting selection', () => {
  const node = IrrigationHeadNode.parse({ radius: 3, arc: 90, position: [20, 2, 40] })
  const spray = createSprinklerSpray(node)
  const positions = spray.geometry.getAttribute('position')
  const before = positions.getY(100)
  updateSprinklerSpray(spray, node, .3)
  expect(positions.getY(100)).not.toBe(before)
  for (let i = 0; i < positions.count; i++) {
    expect(positions.getX(i)).toBeGreaterThanOrEqual(0)
    expect(positions.getZ(i)).toBeGreaterThanOrEqual(0)
    expect(Math.hypot(positions.getX(i), positions.getZ(i))).toBeLessThanOrEqual(3)
    expect(positions.getY(i)).toBeGreaterThanOrEqual(0)
  }
  const hits: unknown[] = []
  spray.raycast({} as never, hits as never)
  expect(hits).toHaveLength(0)
  spray.geometry.dispose(); spray.material.dispose()
})
