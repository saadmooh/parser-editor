import { expect, test } from 'bun:test'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { layoutWateringArea, insideArea } from './area-layout'
import { DriplineNode } from './dripline'
const options = { method: 'sprinkler' as const, zone: 'Lawn', radius: 4.1, fullCircleFlow: 3.18, rowSpacing: .5, emitterSpacing: .3, emitterFlow: 2 }

test('rectangle layout uses inward corner arcs and head-to-head perimeter spacing', () => {
  const area = GroundAreaNode.parse({ parentId: 'level_test', outline: [[0, 0], [8, 0], [8, 6], [0, 6]] })
  const result = layoutWateringArea(area, options)
  expect(result.devices.length).toBeGreaterThan(4)
  expect(result.coveragePercent).toBeGreaterThan(98)
  for (const raw of result.devices) {
    expect(raw.parentId).toBe(area.parentId)
    expect(insideArea((raw as { position: number[] }).position.filter((_, i) => i !== 1) as [number, number], area.outline)).toBe(true)
  }
})
test('concave drip bed clips rows into separate intervals without crossing gaps', () => {
  const area = GroundAreaNode.parse({ parentId: 'level_test', outline: [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6]] })
  const result = layoutWateringArea(area, { ...options, method: 'drip' })
  for (const raw of result.devices) {
    const drip = DriplineNode.parse(raw)
    for (let t = 0; t <= 1; t += .1) expect(insideArea([drip.path[0]![0] * (1 - t) + drip.path[1]![0] * t, drip.path[0]![2]], area.outline)).toBe(true)
  }
  expect(result.coveragePercent).toBe(0) // No false sprinkler coverage claim for drip.
})
test('invalid, tiny and excessive layouts fail before scene mutation', () => {
  const area = GroundAreaNode.parse({ parentId: 'level_test', outline: [[0, 0], [100, 0], [100, 100], [0, 100]] })
  expect(() => layoutWateringArea(area, { ...options, radius: .5 })).toThrow()
  expect(() => layoutWateringArea({ ...area, outline: [] }, options)).toThrow('completed')
})
