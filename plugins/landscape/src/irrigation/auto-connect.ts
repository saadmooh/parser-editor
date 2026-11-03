import type { AnyNode } from '@pascal-app/core'
import { IrrigationHeadNode } from './schema'
import { IrrigationValveNode } from './valve'
import { assertZoneMethod, portMethod } from './method'
import { irrigationPorts, portIsOccupied, type IrrigationPort } from './ports'
import { branchToTarget, mergePlan } from './connect-zone'
import { planConnection, type IrrigationPlan } from './network'
import { IrrigationRunNode, irrigationRunIssues } from './run'

export type AutoConnection = { plan: IrrigationPlan; target?: IrrigationPort; message: string }

/** Connect the nearest compatible watering device without overbooking an inlet. */
export function planNearbySprinkler(node: IrrigationHeadNode, nodes: Readonly<Record<string, unknown>>, range = 6, enabled = true): AutoConnection {
  const base: IrrigationPlan = { create: [node as unknown as AnyNode], update: [] }
  if (!enabled || !node.parentId || !node.zone) return { plan: base, message: 'Place sprinkler without a pipe.' }
  assertZoneMethod('sprinkler', node.zone, node.parentId, nodes)
  const inlet = irrigationPorts(node)[0]!
  const candidates = Object.values(nodes).flatMap(raw => {
    const head = IrrigationHeadNode.safeParse(raw), valve = IrrigationValveNode.safeParse(raw)
    const other = head.success ? head.data : valve.success ? valve.data : null
    if (!other || other.id === node.id || other.visible === false || other.parentId !== node.parentId || other.zone !== node.zone || node.zoneId && other.zoneId && node.zoneId !== other.zoneId) return []
    const port = irrigationPorts(other).find(p => valve.success ? p.id === 'outlet' : p.id === 'inlet')!
    if (portMethod(port, nodes) === 'drip') return []
    const distance = Math.hypot(node.position[0] - port.position[0], node.position[2] - port.position[2])
    return distance <= range ? [{ port, distance }] : []
  }).sort((a, b) => a.distance - b.distance || a.port.nodeId.localeCompare(b.port.nodeId))
  const proposed = { ...nodes, [node.id]: node }
  for (const { port } of candidates) {
    try {
      const route = portIsOccupied(port, proposed)
        ? branchToTarget(port.nodeId, inlet, node.zone, proposed, .4)
        : planConnection(port, inlet, inlet.position, [], .4, proposed)
      const merged = mergePlan(proposed, route)
      if (route.create.some(raw => { const run = IrrigationRunNode.safeParse(raw); return run.success && irrigationRunIssues(run.data, merged).some(i => !i.endsWith('connected valve is closed.')) })) continue
      return { plan: { create: [...base.create, ...route.create], update: route.update }, target: port, message: `Auto-connect to ${port.name}. Click to place sprinkler and pipes.` }
    } catch { continue } // Try another nearby device when the closest route is cramped.
  }
  return { plan: base, message: candidates.length ? 'No room for a valid route here. Place unconnected or move farther away.' : `No matching device within ${range} m. Place the first sprinkler.` }
}
