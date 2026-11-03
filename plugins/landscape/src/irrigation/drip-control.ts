import type { AnyNode } from '@pascal-app/core'
import { IrrigationFittingNode } from './fitting'
import { irrigationPorts, portIsOccupied, type IrrigationPort } from './ports'
import { branchToTarget, mergePlan } from './connect-zone'
import { planConnection, type IrrigationPlan } from './network'

/** Reuse one filter/regulator assembly for each drip valve. */
export function ensureDripControl(feed: IrrigationPort, nodes: Readonly<Record<string, unknown>>, depth: number): { plan: IrrigationPlan; outlet: IrrigationPort } {
  const valve = nodes[feed.nodeId] as { type?: string }
  if (valve?.type !== 'landscape:irrigation-valve') return { plan: { create: [], update: [] }, outlet: feed }
  const existing = Object.values(nodes).flatMap(raw => { const p = IrrigationFittingNode.safeParse(raw); return p.success && p.data.fittingType === 'filter-regulator' && p.data.ownerValveId === feed.nodeId ? [p.data] : [] })
  if (existing.length) return { plan: { create: [], update: [] }, outlet: irrigationPorts(existing[0])[1]! }
  const direction = feed.direction
  const control = IrrigationFittingNode.parse({ parentId: feed.parentId, name: 'Drip filter and regulator', fittingType: 'filter-regulator', ownerValveId: feed.nodeId, zone: feed.zone, zoneId: feed.zoneId,
    position: [feed.position[0] + direction[0] * 1 - direction[2] * .8, feed.position[1], feed.position[2] + direction[2] * 1 + direction[0] * .8],
    directions: [direction.map(v => -v), direction], diameters: [feed.diameter, feed.diameter], regulatedPressureBar: 2.1, filterMesh: 200 })
  const ports = irrigationPorts(control)
  const proposed = { ...nodes, [control.id]: control }
  const route = portIsOccupied(feed, nodes) ? branchToTarget(feed.nodeId, ports[0]!, feed.zone!, proposed, depth) : planConnection(feed, ports[0]!, ports[0]!.position, [], depth, proposed)
  const plan = { create: [control as unknown as AnyNode, ...route.create], update: route.update }
  return { plan, outlet: irrigationPorts(mergePlan(nodes, plan)[control.id])[1]! }
}
