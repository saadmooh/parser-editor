import { expect, test } from 'bun:test'
import { IrrigationValveNode } from './valve'
import { IrrigationHeadNode } from './schema'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { planConnection } from './network'
import { irrigationPorts } from './ports'
import { mergePlan } from './connect-zone'
import { planIrrigationTranslation } from './movement'
import { planHandleEdit } from './editing'
function fixture() {
 const valve = IrrigationValveNode.parse({ parentId: 'level_test', diameter: .5 })
 const head = IrrigationHeadNode.parse({ parentId: valve.parentId, position: [5, 0, 3] })
 const initial = { [valve.id]: valve, [head.id]: head }
 return { valve, head, nodes: mergePlan(initial, planConnection(irrigationPorts(valve)[1]!, irrigationPorts(head)[0]!, head.position, [], .3, initial)) }
}
function check(nodes: Record<string, unknown>) {
 for (const value of Object.values(nodes)) { const run = IrrigationRunNode.safeParse(value); if (run.success) expect(irrigationRunIssues(run.data, nodes)).toEqual([]) }
}
test('moving equipment keeps the far valve fixed and connected paths bounded over repeated drags', () => {
 let { head, valve, nodes } = fixture()
 const before = Object.values(nodes).filter(n => IrrigationRunNode.safeParse(n).success).map(n => IrrigationRunNode.parse(n).path.length)
 for (let i = 0; i < 20; i++) {
  nodes = mergePlan(nodes, { create: [], update: planIrrigationTranslation(nodes[head.id], [.1, 0, .1], false, nodes) })
  check(nodes)
 }
 expect(IrrigationValveNode.parse(nodes[valve.id]).position).toEqual(valve.position)
 expect(Math.max(...Object.values(nodes).filter(n => IrrigationRunNode.safeParse(n).success).map(n => IrrigationRunNode.parse(n).path.length))).toBeLessThanOrEqual(Math.max(...before) + 2)
})
test('a connected endpoint carries its attached equipment and keeps the network connected', () => {
 const { head, nodes } = fixture()
 const run = Object.values(nodes).map(n => IrrigationRunNode.safeParse(n)).find(p => p.success && p.data.endConnection?.nodeId === head.id)!
 if (!run.success) throw new Error('Missing feed')
 const end = run.data.path.at(-1)!
 const changed = mergePlan(nodes, { create: [], update: planHandleEdit(run.data, { kind: 'point', index: run.data.path.length - 1 }, [end[0] + 1, end[1], end[2] + 2], false, nodes) })
 expect(IrrigationHeadNode.parse(changed[head.id]).position).toEqual([6, 0, 5]); check(changed)
})
test('Alt movement disconnects the moved item while keeping its old pipe in place', () => {
 const { head, nodes } = fixture()
 const batch = planIrrigationTranslation(head, [1, 0, 2], true, nodes)
 const changed = mergePlan(nodes, { create: [], update: batch })
 for (const n of Object.values(changed)) { const r = IrrigationRunNode.safeParse(n); if (r.success) { expect(r.data.endConnection?.nodeId).not.toBe(head.id); expect(r.data.path).toEqual(IrrigationRunNode.parse(nodes[r.data.id]).path) } }
})
test('whole pipe movement carries its immediate sockets and preserves every connection', () => {
 const { nodes } = fixture()
 const run = Object.values(nodes).flatMap(n => { const r = IrrigationRunNode.safeParse(n); return r.success ? [r.data] : [] })[0]!
 const changed = mergePlan(nodes, { create: [], update: planIrrigationTranslation(run, [1, 0, 2], false, nodes) })
 expect(IrrigationRunNode.parse(changed[run.id]).path).toEqual(run.path.map(p => [p[0] + 1, p[1], p[2] + 2])); check(changed)
})
