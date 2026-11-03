import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { irrigationZones, zoneReachArea } from './zones'
test('zone totals include hidden heads and keep unassigned distinct', () => {
  const heads = [IrrigationHeadNode.parse({ zone: ' Lawn ', flow: 4 }), IrrigationHeadNode.parse({ zone: 'Lawn', flow: 2.5, visible: false }), IrrigationHeadNode.parse({ zone: '', flow: 0 }), IrrigationHeadNode.parse({ zone: 'Unassigned', flow: 1 })]
  const zones = irrigationZones(heads)
  expect(zones.map((zone) => zone.name)).toEqual(['', 'Lawn', 'Unassigned'])
  expect(zones[1]!.flow).toBe(6.5)
  expect(zones[1]!.heads).toHaveLength(2)
  expect(zones[0]!.heads[0]!.id).toBe(heads[2]!.id)
})

test('plan reach union counts coincident heads once and separated heads twice', () => {
  const head = IrrigationHeadNode.parse({ radius: 3 })
  const single = zoneReachArea([head])!
  expect(single).toBeCloseTo(Math.PI * 9, 1)
  expect(zoneReachArea([head, IrrigationHeadNode.parse({ radius: 3 })])).toBeCloseTo(single, 6)
  expect(zoneReachArea([head, IrrigationHeadNode.parse({ radius: 3, position: [10, 0, 0] })])).toBeCloseTo(2 * single, 6)
})

 test('rotated overlapping area layouts never throw during reach calculation', async () => {
  const { layoutWateringArea } = await import('./area-layout')
  const { GroundAreaNode } = await import('../ground-areas/domain/schema')
  for (const angle of [0, .31, Math.PI / 4, 1.2]) {
    const outline = [[0, 0], [7, 0], [7, 4], [0, 4]].map(([x, z]) => [x! * Math.cos(angle) + z! * Math.sin(angle) - 6.6, -x! * Math.sin(angle) + z! * Math.cos(angle) + 6] as [number, number])
    const layout = layoutWateringArea(GroundAreaNode.parse({ parentId: 'level_test', outline }), { method: 'sprinkler', zone: 'Test', radius: 4.1, fullCircleFlow: 3.18, rowSpacing: .5, emitterSpacing: .3, emitterFlow: 2 })
    const area = zoneReachArea(layout.devices as IrrigationHeadNode[])
    expect(area === null || Number.isFinite(area) && area > 0).toBe(true)
  }
})
