import { expect, test } from 'bun:test'
import { IrrigationSourceNode } from './source'
import { IrrigationValveNode } from './valve'
import { IrrigationHeadNode } from './schema'
import { DriplineNode, driplineMetrics } from './dripline'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { irrigationPorts } from './ports'
import { mergePlan, planConnectZone } from './connect-zone'
import { sourceReadiness } from './readiness'

test('two complete zones share a supply through a manifold, including sprinklers and drip', () => {
  const source = IrrigationSourceNode.parse({ parentId: 'level_test' })
  const a = IrrigationValveNode.parse({ parentId: source.parentId, position: [3, 0, 2], zone: 'Lawn' })
  const b = IrrigationValveNode.parse({ parentId: source.parentId, position: [3, 0, -3], zone: 'Beds' })
  const heads = [[8, 0, 2], [8, 0, 6], [12, 0, 4]].map(position => IrrigationHeadNode.parse({ parentId: source.parentId, position, zone: a.zone }))
  const drip = DriplineNode.parse({ parentId: source.parentId, path: [[8, 0, -3], [12, 0, -3]], zone: b.zone })
  let nodes: Record<string, unknown> = Object.fromEntries([source, a, b, ...heads, drip].map(n => [n.id, n]))
  for (const [valve, targets] of [[a, heads], [b, [drip]]] as const) {
    const plan = planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, targets.flatMap(irrigationPorts), .3, nodes)
    nodes = mergePlan(nodes, plan)
  }
  for (const raw of Object.values(nodes)) {
    const run = IrrigationRunNode.safeParse(raw)
    if (run.success) { expect(irrigationRunIssues(run.data, nodes)).toEqual([]); expect(Math.min(...run.data.path.map(p => p[1]))).toBeGreaterThanOrEqual(-.580001) }
  }
  const readiness = sourceReadiness(source, nodes)
  expect(readiness.outlets).toBe(4)
  expect(readiness.demand).toBeCloseTo(heads.reduce((n, h) => n + h.flow, 0) + driplineMetrics(drip).flow)
  const repeated = planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(a)[0]!, irrigationPorts(a)[1]!, heads.flatMap(irrigationPorts), .3, nodes)
  expect(repeated).toEqual({ create: [], update: [] })
})
