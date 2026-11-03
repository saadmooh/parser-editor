import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { planNearbySprinkler } from './auto-connect'
import { mergePlan } from './connect-zone'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { irrigationPorts, portIsOccupied } from './ports'

test('nearby sprinklers connect with valid pipes, and a third branches through a tee', () => {
  const first = IrrigationHeadNode.parse({ parentId: 'level_test' })
  const second = IrrigationHeadNode.parse({ parentId: first.parentId, position: [3, 0, 2] })
  const original = { [first.id]: first }
  const result = planNearbySprinkler(second, original)
  expect(result.target?.nodeId).toBe(first.id)
  const nodes = mergePlan(original, result.plan)
  expect(portIsOccupied(irrigationPorts(first)[0]!, nodes)).toBe(true)
  const third = IrrigationHeadNode.parse({ parentId: first.parentId, position: [5, 0, 4] })
  const next = planNearbySprinkler(third, nodes)
  expect(next.target).toBeDefined()
  expect(next.plan.create.some(n => (n as unknown as { fittingType?: string }).fittingType === 'tee')).toBe(true)
  const merged = mergePlan(nodes, next.plan)
  for (const raw of Object.values(merged)) {
    const run = IrrigationRunNode.safeParse(raw)
    if (run.success) expect(irrigationRunIssues(run.data, merged)).toEqual([])
  }
  expect(Object.keys(original)).toHaveLength(1)
})
test('range, level, zone, visibility and opt-out prevent unintended connections', () => {
  const first = IrrigationHeadNode.parse({ parentId: 'level_test' })
  const second = IrrigationHeadNode.parse({ parentId: first.parentId, position: [3, 0, 2] })
  expect(planNearbySprinkler(second, { [first.id]: first }, 2).target).toBeUndefined()
  expect(planNearbySprinkler(second, { [first.id]: first }, 6, false).plan.create).toHaveLength(1)
  for (const patch of [{ parentId: 'level_other' }, { zone: 'Other' }, { visible: false }, { zoneId: 'other' }]) {
    expect(planNearbySprinkler({ ...second, zoneId: 'this' }, { [first.id]: { ...first, ...patch } }).target).toBeUndefined()
  }
})

test('a valve can feed an automatically connected sprinkler network', async () => {
  const { IrrigationSourceNode } = await import('./source')
  const { IrrigationValveNode } = await import('./valve')
  const { planConnectZone } = await import('./connect-zone')
  const { sourceReadiness } = await import('./readiness')
  const first = IrrigationHeadNode.parse({ parentId: 'level_test', position: [5, 0, 3] })
  const second = IrrigationHeadNode.parse({ parentId: first.parentId, position: [8, 0, 5] })
  const source = IrrigationSourceNode.parse({ parentId: first.parentId })
  const valve = IrrigationValveNode.parse({ parentId: first.parentId, position: [2, 0, 1] })
  const original = { [first.id]: first, [source.id]: source, [valve.id]: valve }
  const nearby = planNearbySprinkler(second, original, 4)
  expect(nearby.target?.nodeId).toBe(first.id)
  const nodes = mergePlan(original, nearby.plan)
  const plan = planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, [first, second].flatMap(irrigationPorts), .4, nodes)
  const connected = mergePlan(nodes, plan)
  expect(sourceReadiness(source, connected).outlets).toBe(2)
  for (const raw of Object.values(connected)) {
    const run = IrrigationRunNode.safeParse(raw)
    if (run.success) expect(irrigationRunIssues(run.data, connected)).toEqual([])
  }
})
