import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { DriplineNode } from './dripline'
import { IrrigationValveNode } from './valve'
import { IrrigationSourceNode } from './source'
import { irrigationPorts, connectionProblem } from './ports'
import { mergePlan, planConnectZone } from './connect-zone'
import { planNearbySprinkler } from './auto-connect'
import { IrrigationRunNode, irrigationRunIssues } from './run'

test('sprinklers and drip cannot connect even under the same legacy zone name', () => {
  const head = IrrigationHeadNode.parse({ parentId: 'level_test' }), drip = DriplineNode.parse({ parentId: head.parentId, path: [[5, 0, 2], [8, 0, 2]] })
  const nodes = { [head.id]: head, [drip.id]: drip }
  expect(connectionProblem(irrigationPorts(head)[0]!, irrigationPorts(drip)[0]!, nodes)).toContain('separate')
  expect(() => planNearbySprinkler(head, { [drip.id]: drip })).toThrow('separate')
})
test('drip zone creates exactly one reusable control assembly and rejects a sprinkler valve', () => {
  const source = IrrigationSourceNode.parse({ parentId: 'level_test' })
  const valve = IrrigationValveNode.parse({ parentId: source.parentId, position: [3, 0, 2], method: 'drip' })
  const drip = DriplineNode.parse({ parentId: source.parentId, path: [[8, 0, 3], [12, 0, 3]] })
  const nodes = { [source.id]: source, [valve.id]: valve, [drip.id]: drip }
  const args = [irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, irrigationPorts(drip), .4] as const
  const plan = planConnectZone(...args, nodes)
  expect(plan.create.filter(n => (n as unknown as { fittingType?: string }).fittingType === 'filter-regulator')).toHaveLength(1)
  const merged = mergePlan(nodes, plan)
  expect(planConnectZone(...args, merged)).toEqual({ create: [], update: [] })
  for (const raw of Object.values(merged)) { const run = IrrigationRunNode.safeParse(raw); if (run.success) expect(irrigationRunIssues(run.data, merged)).toEqual([]) }
  expect(() => planConnectZone(...args, { ...nodes, [valve.id]: { ...valve, method: 'sprinkler' } })).toThrow('method')
})
