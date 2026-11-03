import { type AnyNodeId } from '@pascal-app/core'
import type { RunConnection } from '@pascal-app/editor/distribution'
import { IrrigationRunNode } from './run'
import { applyIrrigationPlan, planBranch, planConnection, type IrrigationPlan } from './network'
import { irrigationPorts, unit, type IrrigationPort, type Point } from './ports'
import type { SceneApi } from '@pascal-app/core'
export function planDrawing(start: Point, end: Point, startConnection: RunConnection, endConnection: RunConnection, depth: number, nodes: Readonly<Record<string, unknown>>): IrrigationPlan {
  let source: IrrigationPort | undefined
  let branch: IrrigationPlan | undefined
  if (startConnection.port) source = irrigationPorts(nodes[startConnection.port.nodeId]).find(p => p.id === startConnection.port!.id)
  if (startConnection.body) {
    const hit = startConnection.body, run = IrrigationRunNode.parse(nodes[hit.nodeId])
    const result = planBranch(run, hit.segmentIndex, hit.point, unit([end[0], start[1], end[2]], start), run.diameter, nodes)
    source = result.port; branch = result.plan
  }
  if (!source) throw new Error('Start at a water supply, valve, open pipe socket, or pipe body.')
  const proposedNodes = { ...nodes, ...Object.fromEntries((branch?.create ?? []).map(n => [n.id, n])) }
  let target = endConnection.port ? irrigationPorts(nodes[endConnection.port.nodeId]).find(p => p.id === endConnection.port!.id) ?? null : null
  if (endConnection.body) {
    const hit = endConnection.body
    if (hit.nodeId === startConnection.body?.nodeId) throw new Error('Choose a different pipe for the end connection.')
    const result = planBranch(IrrigationRunNode.parse(nodes[hit.nodeId]), hit.segmentIndex, hit.point, unit([start[0], end[1], start[2]], end), source.diameter, nodes)
    target = result.port
    branch = { create: [...(branch?.create ?? []), ...result.plan.create], update: [...(branch?.update ?? []), ...result.plan.update] }
    for (const n of result.plan.create) proposedNodes[n.id] = n
  }
  const plan = planConnection(source, target, end, [], depth, proposedNodes)
  if (branch) { plan.create.unshift(...branch.create); plan.update.unshift(...branch.update) }
  return plan
}
export function commitDrawing(api: SceneApi, plan: IrrigationPlan, level: AnyNodeId) {
  applyIrrigationPlan(api, plan, level)
  const runs = plan.create.flatMap(n => { const p = IrrigationRunNode.safeParse(n); return p.success ? [p.data] : [] })
  const last = runs.at(-1)!
  const port = irrigationPorts(last).find(p => p.id === 'end')!
  return { nextStart: port.position, nextConnection: { port: { ...port, nodeId: port.nodeId as AnyNodeId }, body: null } }
}
