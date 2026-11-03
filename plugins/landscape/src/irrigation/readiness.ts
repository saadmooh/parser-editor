import { IrrigationSourceNode } from './source'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { IrrigationHeadNode } from './schema'
import { DriplineNode, driplineMetrics } from './dripline'
import { IrrigationValveNode } from './valve'
/** Installed demand connected through valid authored sockets; not hydraulic flow. */
export function sourceReadiness(source: IrrigationSourceNode, nodes: Readonly<Record<string, unknown>>) {
  const adjacency = new Map<string, Set<string>>()
  for (const raw of Object.values(nodes)) {
    const parsed = IrrigationRunNode.safeParse(raw)
    if (!parsed.success || parsed.data.parentId !== source.parentId) continue
    const run = parsed.data
    const physicalIssues = irrigationRunIssues(run, nodes).filter(issue => !issue.endsWith('connected valve is closed.') && !issue.endsWith('water supply is disabled.'))
    if (physicalIssues.length || !run.startConnection || !run.endConnection) continue
    for (const connection of [run.startConnection, run.endConnection]) {
      const a = run.id, b = connection.nodeId
      if (!adjacency.has(a)) adjacency.set(a, new Set())
      if (!adjacency.has(b)) adjacency.set(b, new Set())
      adjacency.get(a)!.add(b); adjacency.get(b)!.add(a)
    }
  }
  const connected = new Set<string>(), pending = [source.id as string]
  while (pending.length) {
    const id = pending.pop()!
    if (connected.has(id)) continue
    connected.add(id)
    pending.push(...(adjacency.get(id) ?? []))
  }
  let demand = 0, outlets = 0, closedValves = 0, otherSources = 0
  for (const id of connected) {
    const head = IrrigationHeadNode.safeParse(nodes[id])
    const drip = DriplineNode.safeParse(nodes[id])
    const valve = IrrigationValveNode.safeParse(nodes[id])
    const other = IrrigationSourceNode.safeParse(nodes[id])
    if (head.success) { demand += head.data.flow; outlets++ }
    if (drip.success) { demand += driplineMetrics(drip.data).flow; outlets++ }
    if (valve.success && !valve.data.isOpen) closedValves++
    if (other.success && other.data.id !== source.id) otherSources++
  }
  const issues = [
    ...(!source.enabled ? ['Supply is disabled.'] : []),
    ...(source.pressureBar <= 0 ? ['No positive supply pressure is authored.'] : []),
    ...(!outlets ? ['No head or dripline is connected through matching sockets.'] : []),
    ...(closedValves ? [`${closedValves} connected valve(s) are authored closed.`] : []),
    ...(otherSources ? ['Multiple supplies share this component; capacity allocation needs review.'] : []),
    ...(demand > source.availableFlow ? ['Installed demand exceeds authored available flow.'] : []),
  ]
  return { demand, outlets, margin: source.availableFlow - demand, issues }
}
