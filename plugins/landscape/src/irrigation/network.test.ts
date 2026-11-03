import { expect, test } from 'bun:test'
import { IrrigationSourceNode } from './source'
import { IrrigationValveNode } from './valve'
import { IrrigationHeadNode } from './schema'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { IrrigationFittingNode } from './fitting'
import { irrigationPorts } from './ports'
import { movedEquipmentPlan, planBranch, planConnection, type IrrigationPlan } from './network'
import { sourceReadiness } from './readiness'
function merged(nodes: Record<string, unknown>, plan: IrrigationPlan) {
  const result = { ...nodes }
  for (const update of plan.update) result[update.id] = { ...(result[update.id] as object), ...update.data }
  for (const n of plan.create) result[n.id] = n
  return result
}
function checked(nodes: Record<string, unknown>) {
  for (const raw of Object.values(nodes)) {
    const parsed = IrrigationRunNode.safeParse(raw)
    if (parsed.success) expect(irrigationRunIssues(parsed.data, nodes)).toEqual([])
  }
}
test('routes a supply and valve as one continuous pipe with socket-aligned ends', () => {
  const supply = IrrigationSourceNode.parse({ parentId: 'level_test' })
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [4, 0, 2] })
  const nodes = { [supply.id]: supply, [valve.id]: valve }
  const plan = planConnection(irrigationPorts(supply)[0]!, irrigationPorts(valve)[0]!, valve.position, [], 0.3, nodes)
  checked(merged(nodes, plan))
  expect(plan.create.filter(n => IrrigationRunNode.safeParse(n).success)).toHaveLength(1)
  expect(plan.create.some(n => IrrigationFittingNode.safeParse(n).success)).toBe(false)
  expect(plan.create.filter(n => IrrigationRunNode.safeParse(n).success).every(n => (n as unknown as IrrigationRunNode).zone === '')).toBe(true)
})
test('reduces default valve size to sprinkler size and includes demand', () => {
  const supply = IrrigationSourceNode.parse({ parentId: 'level_test' })
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [4, 0, 0] })
  const head = IrrigationHeadNode.parse({ parentId: 'level_test', position: [7, 0, 3] })
  let nodes: Record<string, unknown> = { [supply.id]: supply, [valve.id]: valve, [head.id]: head }
  nodes = merged(nodes, planConnection(irrigationPorts(supply)[0]!, irrigationPorts(valve)[0]!, valve.position, [], 0.3, nodes))
  const plan = planConnection(irrigationPorts(valve)[1]!, irrigationPorts(head)[0]!, head.position, [], 0.3, nodes)
  expect(plan.create.some(n => IrrigationFittingNode.safeParse(n).data?.fittingType === 'reducer')).toBe(true)
  nodes = merged(nodes, plan); checked(nodes)
  expect(sourceReadiness(supply, nodes).demand).toBe(head.flow)
})
test('branches a zone trunk, preserves its ends, and reaches two sprinklers', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', diameter: 0.5, position: [0, 0, 0] })
  const head = IrrigationHeadNode.parse({ parentId: 'level_test', position: [8, 0, 0] })
  const second = IrrigationHeadNode.parse({ parentId: 'level_test', position: [4, 0, 4] })
  let nodes: Record<string, unknown> = { [valve.id]: valve, [head.id]: head, [second.id]: second }
  nodes = merged(nodes, planConnection(irrigationPorts(valve)[1]!, irrigationPorts(head)[0]!, head.position, [], 0.3, nodes))
  const trunk = Object.values(nodes).flatMap(raw => { const p = IrrigationRunNode.safeParse(raw); return p.success ? [p.data] : [] })[0]!
  const segment = trunk.path.slice(1).findIndex((b, i) => b[0] - trunk.path[i]![0] > 4 && b[1] === trunk.path[i]![1])
  const branch = planBranch(trunk, segment, [4, trunk.path[segment]![1], 0], [0, 0, 1], 0.5, nodes)
  nodes = merged(nodes, branch.plan)
  nodes = merged(nodes, planConnection(branch.port, irrigationPorts(second)[0]!, second.position, [], 0.3, nodes))
  checked(nodes)
})
test('equipment moves retain the fixed far socket and its approach direction', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', diameter: 0.5 })
  const head = IrrigationHeadNode.parse({ parentId: 'level_test', position: [5, 0, 2] })
  const original = { [valve.id]: valve, [head.id]: head }
  const nodes = merged(original, planConnection(irrigationPorts(valve)[1]!, irrigationPorts(head)[0]!, head.position, [], 0.3, original))
  const moved = { ...head, position: [7, 0, 4] as [number, number, number] }
  const updates = movedEquipmentPlan(head, moved, nodes)
  expect(updates.length).toBe(1)
  checked(merged({ ...nodes, [head.id]: moved }, { create: [], update: updates }))
})
test('rejects occupied sockets, different zones and cramped joints before committing', () => {
  const a = IrrigationHeadNode.parse({ parentId: 'level_test' })
  const b = IrrigationHeadNode.parse({ parentId: 'level_test', zone: 'Other', position: [5, 0, 0] })
  expect(() => planConnection(irrigationPorts(a)[0]!, irrigationPorts(b)[0]!, b.position, [], 0.3, { [a.id]: a, [b.id]: b })).toThrow('different zones')
  const run = IrrigationRunNode.parse({ parentId: 'level_test', path: [[0, -0.3, 0], [3, -0.3, 0]] })
  expect(() => planBranch(run, 0, [0.02, -0.3, 0], [0, 0, 1])).toThrow('farther')
})
test('straight waypoints collapse into one run and branches must lie on their segment', async () => {
 const { pipePathPlan } = await import('./network')
 const plan = pipePathPlan([[0, -.3, 0], [1, -.3, 0], [1, -.3, 0], [5, -.3, 0]], .5, 'Zone 1', 'level_test')
 expect(plan.create).toHaveLength(1)
 const run = IrrigationRunNode.parse(plan.create[0])
 expect(run.path).toEqual([[0, -.3, 0], [5, -.3, 0]])
 expect(() => planBranch(run, 0, [2, -.3, 1], [0, 0, 1])).toThrow('selected pipe segment')
})
test('an invalid planned connection is rejected before any scene change', async () => {
 const { applyIrrigationPlan } = await import('./network')
 const supply = IrrigationSourceNode.parse({ parentId: 'level_test', diameter: .5 })
 const run = IrrigationRunNode.parse({ parentId: supply.parentId, path: [[9, 0, 0], [10, 0, 0]], startConnection: { nodeId: supply.id, portId: 'outlet' } })
 let applied = false
 const api = { nodes: () => ({ [supply.id]: supply }), applyChanges: () => { applied = true } }
 expect(() => applyIrrigationPlan(api as never, { create: [run as never], update: [] }, supply.parentId as never)).toThrow('centerline')
 expect(applied).toBe(false)
})
