import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { IrrigationValveNode } from './valve'
import { DriplineNode } from './dripline'
import { irrigationPorts } from './ports'
import { planConnection } from './network'
import { mergePlan } from './connect-zone'
import { planHandleEdit } from './editing'
import { IrrigationZoneNode, renameZoneUpdates, zoneColor } from './zone-model'
import type { AnyNode } from '@pascal-app/core'

test('visual sprinkler handles edit radius, direction, and arc with bounded values', () => {
  const head = IrrigationHeadNode.parse({ position: [2, 0, 3] })
  expect(planHandleEdit(head, { kind: 'radius' }, [100, 0, 3], false, {})[0]!.data).toEqual({ radius: 30 })
  expect(planHandleEdit(head, { kind: 'arc' }, [3, 0, 3], false, {})[0]!.data as unknown as { arc: number }).toEqual({ arc: 90 })
  expect(planHandleEdit(head, { kind: 'direction' }, [3, 0, 3], false, {})[0]!.data).toEqual({ rotation: [0, Math.PI / 2, 0] })
})
test('a midpoint becomes a bend while connected endpoints retain their socket approaches', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', diameter: .5 })
  const head = IrrigationHeadNode.parse({ parentId: valve.parentId, position: [5, 0, 3] })
  let nodes = mergePlan({ [valve.id]: valve, [head.id]: head }, planConnection(irrigationPorts(valve)[1]!, irrigationPorts(head)[0]!, head.position, [], .3, { [valve.id]: valve, [head.id]: head }))
  const run = Object.values(nodes).flatMap(raw => { const p = IrrigationRunNode.safeParse(raw); return p.success && p.data.endConnection?.nodeId === head.id ? [p.data] : [] })[0]!
  const batch = planHandleEdit(run, { kind: 'insert', index: 0 }, [7, 0, 5], false, nodes)
  nodes = mergePlan(nodes, { create: [], update: batch })
  const changed = IrrigationRunNode.parse(nodes[run.id])
  expect(changed.path.some(p => p[0] === 7 && p[2] === 5)).toBe(true)
  expect(changed.path.at(-1)).toEqual(run.path.at(-1))
  expect(irrigationRunIssues(changed, nodes)).toEqual([])
})
test('Alt-detach clears reciprocal endpoint bindings in the same batch', () => {
  const a = IrrigationRunNode.parse({ parentId: 'level_test', path: [[0, -.3, 0], [2, -.3, 0]] })
  const b = IrrigationRunNode.parse({ parentId: a.parentId, path: [[2, -.3, 0], [4, -.3, 0]], startConnection: { nodeId: a.id, portId: 'end' } })
  a.endConnection = { nodeId: b.id, portId: 'start' }
  const nodes = mergePlan({ [a.id]: a, [b.id]: b }, { create: [], update: planHandleEdit(a, { kind: 'point', index: 1 }, [2, 0, 1], true, { [a.id]: a, [b.id]: b }) })
  expect(IrrigationRunNode.parse(nodes[a.id]).endConnection).toBeUndefined()
  expect(IrrigationRunNode.parse(nodes[b.id]).startConnection).toBeUndefined()
})
test('moving a dripline inlet updates its supply pipe while retaining the far socket', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', diameter: .5 })
  const drip = DriplineNode.parse({ parentId: valve.parentId, path: [[5, 0, 2], [8, 0, 2]], diameter: .5 })
  const initial = { [valve.id]: valve, [drip.id]: drip }
  let nodes = mergePlan(initial, planConnection(irrigationPorts(valve)[1]!, irrigationPorts(drip)[0]!, drip.path[0]!, [], .3, initial))
  const batch = planHandleEdit(drip, { kind: 'point', index: 0 }, [6, 0, 3], false, nodes)
  expect(batch.length).toBeGreaterThan(1)
  nodes = mergePlan(nodes, { create: [], update: batch })
  for (const raw of Object.values(nodes)) { const run = IrrigationRunNode.safeParse(raw); if (run.success) expect(irrigationRunIssues(run.data, nodes)).toEqual([]) }
})
test('zone rename updates legacy and stable members and retains their colors', () => {
  const zone = IrrigationZoneNode.parse({ name: 'Lawn' })
  const head = IrrigationHeadNode.parse({ zone: 'Lawn', zoneId: zone.id })
  const legacy = DriplineNode.parse({ zone: 'Lawn' })
  const updates = renameZoneUpdates([zone, head, legacy] as unknown as AnyNode[], zone, 'Front lawn')
  expect(updates).toHaveLength(3)
  expect(updates.find(u => String(u.id) === head.id)!.data).toMatchObject({ zone: 'Front lawn', zoneId: zone.id })
  expect(zoneColor(zone.id)).toBe(zoneColor(head.zoneId!))
  expect(() => renameZoneUpdates([zone, head, IrrigationZoneNode.parse({ name: 'Beds' })] as unknown as AnyNode[], zone, 'Beds')).toThrow('unique')
})
