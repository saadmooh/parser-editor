import { expect, test } from 'bun:test'
import { DriplineNode } from './dripline'
import { IrrigationValveNode } from './valve'
import { irrigationPorts } from './ports'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { nearestDriplineFeed, snapDriplineInlet, planDriplinePlacement, planDriplineDrop, planFeedEquipmentDrop } from './dripline-connection'
import { mergePlan } from './connect-zone'

test('drawing near a valve creates tubing, reducers and valid pipe sockets together', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test' })
  const nodes = { [valve.id]: valve }
  const feed = nearestDriplineFeed([.2, 0, 0], 'level_test', valve.zone, nodes)!
  expect(feed.id).toBe('outlet')
  const inlet = snapDriplineInlet([.2, 0, 0], feed)
  const drip = DriplineNode.parse({ parentId: valve.parentId, path: [inlet, [4, 0, 2]] })
  const plan = planDriplinePlacement(drip, feed, nodes)
  const proposed = mergePlan(nodes, plan)
  for (const raw of plan.create) {
    const run = IrrigationRunNode.safeParse(raw)
    if (run.success) expect(irrigationRunIssues(run.data, proposed)).toEqual([])
  }
  expect(plan.create.some(n => (n as unknown as { fittingType?: string }).fittingType === 'reducer')).toBe(true)
  expect(nearestDriplineFeed([.2, 0, 0], 'level_other', valve.zone, nodes)).toBeUndefined()
  expect(nearestDriplineFeed([.2, 0, 0], 'level_test', 'Other', nodes)).toBeUndefined()
})
test('dragging an unconnected inlet creates a feed route and moving a connected inlet does not duplicate it', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test' })
  const drip = DriplineNode.parse({ parentId: valve.parentId, path: [[3, 0, 0], [4, 0, 2]] })
  const nodes = { [valve.id]: valve, [drip.id]: drip }
  const batch = [{ id: drip.id as never, data: { path: [[.2, 0, 0], [4, 0, 2]] } as never }]
  const plan = planDriplineDrop(drip, batch, nodes)
  expect(plan.create.length).toBeGreaterThan(0)
  const proposed = mergePlan(nodes, plan)
  expect(planDriplineDrop(proposed[drip.id], batch, proposed).create).toHaveLength(0)
})

test('an occupied valve outlet adds a tee instead of duplicating its socket', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test' })
  const feed = irrigationPorts(valve)[1]!
  const first = DriplineNode.parse({ parentId: valve.parentId, path: [[5, 0, 3], [8, 0, 3]] })
  const original = { [valve.id]: valve }
  const initial = planDriplinePlacement(first, feed, original)
  const nodes = mergePlan(original, initial)
  const second = DriplineNode.parse({ parentId: valve.parentId, path: [[2, 0, 5], [6, 0, 5]] })
  const plan = planDriplinePlacement(second, feed, nodes)
  expect(plan.create.some(n => (n as unknown as { fittingType?: string }).fittingType === 'tee')).toBe(true)
  const proposed = mergePlan(nodes, plan)
  for (const raw of Object.values(proposed)) {
    const run = IrrigationRunNode.safeParse(raw)
    if (run.success) expect(irrigationRunIssues(run.data, proposed)).toEqual([])
  }
})


test('dropping a valve near an inlet creates its feed and leaves unrelated zones alone', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [5, 0, 5] })
  const drip = DriplineNode.parse({ parentId: valve.parentId, path: [[.2, 0, 0], [4, 0, 2]] })
  const nodes = { [valve.id]: valve, [drip.id]: drip }
  const batch = [{ id: valve.id as never, data: { position: [0, 0, 0] } as never }]
  const plan = planFeedEquipmentDrop(valve, batch, nodes)
  expect(plan.create.length).toBeGreaterThan(0)
  const proposed = mergePlan(nodes, plan)
  for (const raw of plan.create) {
    const run = IrrigationRunNode.safeParse(raw)
    if (run.success) expect(irrigationRunIssues(run.data, proposed)).toEqual([])
  }
  expect(planFeedEquipmentDrop(valve, batch, { ...nodes, [drip.id]: { ...drip, zone: 'Other' } }).create).toHaveLength(0)
  expect(valve.position).toEqual([5, 0, 5])
})
