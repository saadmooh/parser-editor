import { expect, test } from 'bun:test'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { IrrigationFittingNode } from './fitting'
import { irrigationPorts } from './ports'
import { consolidateIrrigationRuns } from './consolidate-runs'
import { mergePlan } from './connect-zone'
const parentId = 'level_test'
function legacy() {
 const elbow = IrrigationFittingNode.parse({ parentId, fittingType: 'elbow', position: [2, 0, 0], directions: [[-1, 0, 0], [0, 0, 1]], diameters: [.5, .5] })
 const ports = irrigationPorts(elbow)
 const a = IrrigationRunNode.parse({ parentId, path: [[0, 0, 0], ports[0]!.position], endConnection: { nodeId: elbow.id, portId: 'socket-0' } })
 const b = IrrigationRunNode.parse({ parentId, path: [ports[1]!.position, [2, 0, 4]], startConnection: { nodeId: elbow.id, portId: 'socket-1' } })
 return { elbow, a, b, nodes: { [elbow.id]: elbow, [a.id]: a, [b.id]: b } }
}
test('legacy elbow pieces become one continuous run and cleanup is idempotent', () => {
 const { nodes, a, b, elbow } = legacy()
 const plan = consolidateIrrigationRuns(nodes, parentId)
 expect(plan.delete?.map(String)).toContain(b.id); expect(plan.delete?.map(String)).toContain(elbow.id)
 const result = mergePlan(nodes, plan)
 const run = IrrigationRunNode.parse(result[a.id])
 expect(run.path).toEqual([[0, 0, 0], [2, 0, 0], [2, 0, 4]])
 expect(Object.keys(result)).toHaveLength(1)
 expect(consolidateIrrigationRuns(result, parentId).delete).toEqual([])
})
test('cleanup preserves tees, locked routes and diameter changes', () => {
 const { nodes, a, elbow } = legacy()
 expect(consolidateIrrigationRuns({ ...nodes, [a.id]: { ...a, routingLocked: true } }, parentId).delete).toEqual([])
 expect(consolidateIrrigationRuns({ ...nodes, [elbow.id]: { ...elbow, fittingType: 'tee' } }, parentId).delete).toEqual([])
 expect(consolidateIrrigationRuns({ ...nodes, [a.id]: { ...a, diameter: .75 } }, parentId).delete).toEqual([])
})
test('shared sockets and nonreciprocal run connections are reported', () => {
 const { nodes, a, elbow } = legacy()
 const duplicate = IrrigationRunNode.parse({ ...a, id: undefined })
 expect(irrigationRunIssues(a, { ...nodes, [duplicate.id]: duplicate }).some(i => i.includes('more than one pipe'))).toBe(true)
 const other = IrrigationRunNode.parse({ parentId, path: [[0, 0, 0], [-2, 0, 0]] })
 expect(irrigationRunIssues({ ...a, startConnection: { nodeId: other.id, portId: 'start' } }, { ...nodes, [other.id]: other }).some(i => i.includes('does not reference'))).toBe(true)
})
test('reciprocal straight endpoint joins collapse to one run', () => {
 const a = IrrigationRunNode.parse({ parentId, path: [[0, 0, 0], [2, 0, 0]] })
 const b = IrrigationRunNode.parse({ parentId, path: [[2, 0, 0], [5, 0, 0]], startConnection: { nodeId: a.id, portId: 'end' } })
 a.endConnection = { nodeId: b.id, portId: 'start' }
 const nodes = { [a.id]: a, [b.id]: b }
 const result = mergePlan(nodes, consolidateIrrigationRuns(nodes, parentId))
 expect(Object.keys(result)).toHaveLength(1)
 expect(IrrigationRunNode.parse(result[a.id]).path).toEqual([[0, 0, 0], [5, 0, 0]])
})
test('stale endpoint positions are repaired from the existing equipment binding', async () => {
 const { IrrigationValveNode } = await import('./valve')
 const valve = IrrigationValveNode.parse({ parentId, diameter: .5 })
 const port = irrigationPorts(valve)[1]!
 const run = IrrigationRunNode.parse({ parentId, path: [[3, 0, 0], [4, 0, 0]], startConnection: { nodeId: valve.id, portId: 'outlet' } })
 const nodes = { [valve.id]: valve, [run.id]: run }
 const fixed = mergePlan(nodes, consolidateIrrigationRuns(nodes, parentId))
 expect(IrrigationRunNode.parse(fixed[run.id]).path[0]).toEqual(port.position)
 expect(irrigationRunIssues(IrrigationRunNode.parse(fixed[run.id]), fixed)).toEqual(['End: no outlet connection.'])
})
test('a generated tee with an unused branch is reduced and merged without leaving a stub', () => {
 const { nodes, elbow, a } = legacy()
 const tee = { ...elbow, fittingType: 'tee', name: 'Drip header tee', directions: [...elbow.directions, [0, 1, 0]], diameters: [.5, .5, .5] }
 const result = mergePlan({ ...nodes, [elbow.id]: tee }, consolidateIrrigationRuns({ ...nodes, [elbow.id]: tee }, parentId))
 expect(Object.keys(result)).toHaveLength(1)
 expect(IrrigationRunNode.parse(result[a.id]).path).toEqual([[0, 0, 0], [2, 0, 0], [2, 0, 4]])
})
test('identical bound pipe copies are removed while the authored route remains', () => {
 const { nodes, a } = legacy()
 const run = IrrigationRunNode.parse({ ...a, startConnection: { nodeId: 'source_existing', portId: 'outlet' } })
 const duplicate = IrrigationRunNode.parse({ ...run, id: undefined })
 const result = mergePlan({ ...nodes, [a.id]: run, [duplicate.id]: duplicate }, consolidateIrrigationRuns({ ...nodes, [a.id]: run, [duplicate.id]: duplicate }, parentId))
 expect(result[a.id]).toBeDefined(); expect(result[duplicate.id]).toBeUndefined()
})
