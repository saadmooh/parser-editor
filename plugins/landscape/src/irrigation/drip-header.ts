import type { AnyNode } from '@pascal-app/core'
import { IrrigationFittingNode } from './fitting'
import { irrigationPorts, portIsOccupied, type IrrigationPort, type Point } from './ports'
import { pipePathPlan, planConnection, type IrrigationPlan } from './network'
import { irrigationObstacles, pathHitsObstacle } from './routing-obstacles'

/** Parallel bed rows share an aligned header, rather than branching from arbitrary feeds. */
export function planDripHeader(feed: IrrigationPort, targets: readonly IrrigationPort[], depth: number, original: Readonly<Record<string, unknown>>): IrrigationPlan | null {
 if (targets.length < 2 || !feed.parentId || portIsOccupied(feed, original) || targets.some(t => portIsOccupied(t, original))) return null
 const outward = targets[0]!.direction
 if (Math.abs(outward[1]) > .001) return null
 const axis: Point = [-outward[2], 0, outward[0]]
 const project = (p: Point, d: Point) => p.reduce((n, v, i) => n + v * d[i]!, 0)
 const edge = project(targets[0]!.position, outward), elevation = targets[0]!.position[1]
 if (targets.some(t => t.parentId !== feed.parentId || t.zone !== feed.zone || Math.abs(t.position[1] - elevation) > .001 || Math.abs(project(t.position, outward) - edge) > .001 || t.direction.some((v, i) => Math.abs(v - outward[i]!) > .001))) return null
 const rows = [...targets].sort((a, b) => project(a.position, axis) - project(b.position, axis))
 if (rows.slice(1).some((t, i) => project(t.position, axis) - project(rows[i]!.position, axis) < .2)) return null
 const y = Math.min(-depth, elevation), diameter = rows.every(t => t.diameter === rows[0]!.diameter) ? rows[0]!.diameter : feed.diameter
 const offset = rows.some(t => Math.abs(t.diameter - diameter) > 1e-6) ? 1 : .6
 const tees = rows.slice(0, -1).map(t => IrrigationFittingNode.parse({ parentId: feed.parentId, name: 'Drip header tee', fittingType: 'tee', zone: feed.zone, zoneId: feed.zoneId,
  position: [t.position[0] + outward[0] * offset, y, t.position[2] + outward[2] * offset],
  directions: [axis.map(v => -v), axis, outward.map(v => -v)], diameters: [diameter, diameter, diameter] }))
 const obstacles = irrigationObstacles(feed.parentId, original)
 if (obstacles.some(box => pathHitsObstacle(tees.map(t => t.position), box))) return null
 const nodes: Record<string, unknown> = { ...original }, plan: IrrigationPlan = { create: [...tees] as unknown as AnyNode[], update: [] }
 tees.forEach(t => { nodes[t.id] = t })
 const apply = (part: IrrigationPlan) => { plan.create.push(...part.create); plan.update.push(...part.update); part.create.forEach(n => { nodes[n.id] = n }); part.update.forEach(u => { nodes[u.id] = { ...(nodes[u.id] as object), ...u.data } }) }
 for (let i = 1; i < tees.length; i++) {
  const a = irrigationPorts(tees[i - 1])[1]!, b = irrigationPorts(tees[i])[0]!
  apply(pipePathPlan([a.position, b.position], diameter, feed.zone ?? '', feed.parentId, { nodeId: a.nodeId, portId: a.id }, { nodeId: b.nodeId, portId: b.id }))
 }
 const inlet = irrigationPorts(tees[0])[0]!
 apply(planConnection(feed, inlet, inlet.position, [], depth, nodes))
 for (let i = 0; i < tees.length; i++) {
  const outlet = irrigationPorts(tees[i])[2]!, row = rows[i]!
  apply(planConnection(outlet, row, row.position, [], depth, nodes))
 }
 const lastRow = rows.at(-1)!, terminal = irrigationPorts(tees.at(-1))[1]!
 const corner: Point = [lastRow.position[0] + outward[0] * offset, y, lastRow.position[2] + outward[2] * offset]
 apply(planConnection(terminal, lastRow, lastRow.position, [corner], depth, nodes))
 return plan
}
