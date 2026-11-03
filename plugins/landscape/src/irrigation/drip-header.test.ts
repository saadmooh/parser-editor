import { expect, test } from 'bun:test'
import { DriplineNode } from './dripline'
import { IrrigationFittingNode } from './fitting'
import { IrrigationValveNode } from './valve'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { irrigationPorts } from './ports'
import { planDripHeader } from './drip-header'
import { mergePlan } from './connect-zone'

test('parallel bed rows use a straight header with aligned perpendicular feeds', () => {
 const valve = IrrigationValveNode.parse({ parentId: 'level_test', diameter: .5, zone: 'Beds', position: [-2, 0, -1] })
 const rows = Array.from({ length: 7 }, (_, i) => DriplineNode.parse({ parentId: valve.parentId, zone: valve.zone, path: [[0, 0, i * .5], [4, 0, i * .5]] }))
 const nodes = Object.fromEntries([valve, ...rows].map(n => [n.id, n]))
 const plan = planDripHeader(irrigationPorts(valve)[1]!, rows.flatMap(irrigationPorts), .3, nodes)!
 expect(plan).not.toBeNull()
 const merged = mergePlan(nodes, plan)
 const tees = plan.create.flatMap(n => { const p = IrrigationFittingNode.safeParse(n); return p.success ? [p.data] : [] })
 expect(tees).toHaveLength(6)
 expect(new Set(tees.map(t => t.position[0]))).toEqual(new Set([-.6]))
 expect(new Set(tees.map(t => t.position[1]))).toEqual(new Set([-.3]))
 for (const raw of plan.create) { const r = IrrigationRunNode.safeParse(raw); if (r.success) expect(irrigationRunIssues(r.data, merged)).toEqual([]) }
 for (const row of rows) {
  const connection = plan.create.flatMap(n => { const r = IrrigationRunNode.safeParse(n); return r.success && r.data.endConnection?.nodeId === row.id ? [r.data] : [] })[0]!
  if (connection.startConnection?.portId === 'socket-2') expect(connection.path.every(p => Math.abs(p[2] - row.path[0]![2]) < 1e-9)).toBe(true)
  expect(connection.path.at(-1)).toEqual(row.path[0])
 }
})
test('irregular row edges retain general routing instead of forcing an incorrect header', () => {
 const valve = IrrigationValveNode.parse({ parentId: 'level_test', zone: 'Beds' })
 const a = DriplineNode.parse({ parentId: valve.parentId, zone: valve.zone, path: [[0, 0, 0], [4, 0, 0]] })
 const b = DriplineNode.parse({ parentId: valve.parentId, zone: valve.zone, path: [[1, 0, 1], [4, 0, 1]] })
 expect(planDripHeader(irrigationPorts(valve)[1]!, [a, b].flatMap(irrigationPorts), .3, {})).toBeNull()
})
test('default diameter adapters fit between the aligned header and row without backtracking', () => {
 const valve = IrrigationValveNode.parse({ parentId: 'level_test', zone: 'Beds', position: [-3, 0, -1] })
 const rows = [0, .5, 1].map(z => DriplineNode.parse({ parentId: valve.parentId, zone: valve.zone, path: [[0, 0, z], [4, 0, z]] }))
 const nodes = Object.fromEntries([valve, ...rows].map(n => [n.id, n]))
 const plan = planDripHeader(irrigationPorts(valve)[1]!, rows.flatMap(irrigationPorts), .3, nodes)!
 const merged = mergePlan(nodes, plan)
 for (const raw of plan.create) {
  const run = IrrigationRunNode.safeParse(raw)
  if (!run.success) continue
  expect(irrigationRunIssues(run.data, merged)).toEqual([])
  if (run.data.startConnection?.portId === 'socket-2') expect(run.data.path.slice(1).every((p, i) => p[0] >= run.data.path[i]![0])).toBe(true)
 }
})
test('every generated header socket is used and diameter reduction happens once', () => {
 const valve = IrrigationValveNode.parse({ parentId: 'level_test', zone: 'Beds', position: [-3, 0, -1] })
 const rows = [0, .5, 1, 1.5].map(z => DriplineNode.parse({ parentId: valve.parentId, zone: valve.zone, path: [[0, 0, z], [4, 0, z]] }))
 const nodes = Object.fromEntries([valve, ...rows].map(n => [n.id, n]))
 const plan = planDripHeader(irrigationPorts(valve)[1]!, rows.flatMap(irrigationPorts), .3, nodes)!
 const merged = mergePlan(nodes, plan), fittings = plan.create.flatMap(n => { const p = IrrigationFittingNode.safeParse(n); return p.success ? [p.data] : [] })
 expect(fittings.filter(f => f.fittingType === 'reducer')).toHaveLength(1)
 expect(fittings.filter(f => f.fittingType === 'tee')).toHaveLength(rows.length - 1)
 const runs = Object.values(merged).flatMap(n => { const p = IrrigationRunNode.safeParse(n); return p.success ? [p.data] : [] })
 for (const fitting of fittings) for (const port of irrigationPorts(fitting)) expect(runs.filter(r => [r.startConnection, r.endConnection].some(c => c?.nodeId === fitting.id && c.portId === port.id))).toHaveLength(1)
})
