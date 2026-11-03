import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { assertZoneMethod, portMethod } from './method'
import { DriplineNode } from './dripline'
import { irrigationPorts, portIsOccupied, type IrrigationPort, type Point } from './ports'
import { ensureDripControl } from './drip-control'
import { branchToTarget, mergePlan } from './connect-zone'
import { planConnection, type IrrigationPlan } from './network'

/** Find a nearby feed, respecting level, zone, visibility and socket direction. */
export function nearestDriplineFeed(point: Point, parentId: string, zone: string, nodes: Readonly<Record<string, unknown>>, excludeId?: string, range = .8): IrrigationPort | undefined {
  const candidates = Object.values(nodes).flatMap(raw => {
    const node = raw as { id: string; type: string; visible?: boolean }
    if (!node || node.id === excludeId || node.visible === false) return []
    return irrigationPorts(raw).filter(port => portMethod(port, nodes) !== 'sprinkler' && portMethod(port, nodes) !== 'mixed' && port.parentId === parentId && (!port.zone || port.zone === zone) && (
      node.type === 'landscape:irrigation-valve' && port.id === 'outlet' ||
      node.type === 'landscape:irrigation-source' && port.id === 'outlet' ||
      node.type === 'landscape:irrigation-fitting' && !portIsOccupied(port, nodes) ||
      node.type === 'landscape:irrigation-run' && !portIsOccupied(port, nodes)
    )).map(port => ({ port, distance: Math.hypot(point[0] - port.position[0], point[2] - port.position[2]) }))
  }).filter(item => item.distance <= range)
  candidates.sort((a, b) => a.distance - b.distance)
  return candidates[0]?.port
}

export function snapDriplineInlet(point: Point, feed: IrrigationPort): Point {
  // Leave space for a reducer, elbows, and the approach to the drip inlet.
  return [feed.position[0] + feed.direction[0] * 1, point[1], feed.position[2] + feed.direction[2] * 1]
}

export function planDriplineFeed(node: DriplineNode, feed: IrrigationPort, nodes: Readonly<Record<string, unknown>>, depth = .3): IrrigationPlan {
  assertZoneMethod('drip', node.zone, node.parentId, nodes)
  const proposed = { ...nodes, [node.id]: node }
  const inlet = irrigationPorts(node)[0]!
  if (portIsOccupied(inlet, nodes)) throw new Error('This dripline already has a feed pipe.')
  const control = ensureDripControl(feed, proposed, depth)
  const controlled = mergePlan(proposed, control.plan)
  const route = portIsOccupied(control.outlet, controlled)
    ? branchToTarget(control.outlet.nodeId, inlet, control.outlet.zone || '', controlled, depth)
    : planConnection(control.outlet, inlet, inlet.position, [], depth, controlled)
  return { create: [...control.plan.create, ...route.create], update: [...control.plan.update, ...route.update] }
}

/** Create tubing and its complete feed route as one undoable change. */
export function planDriplinePlacement(node: DriplineNode, feed: IrrigationPort | undefined, nodes: Readonly<Record<string, unknown>>, depth = .3): IrrigationPlan {
  assertZoneMethod('drip', node.zone, node.parentId, nodes)
  const route = feed ? planDriplineFeed(node, feed, nodes, depth) : { create: [], update: [] }
  return { create: [node as unknown as AnyNode, ...route.create], update: route.update }
}

export function planDriplineDrop(raw: unknown, batch: IrrigationPlan['update'], nodes: Readonly<Record<string, unknown>>): IrrigationPlan {
  const parsed = DriplineNode.safeParse(raw)
  if (!parsed.success) return { create: [], update: batch }
  const patch = batch.find(u => (u.id as string) === parsed.data.id)
  const node = DriplineNode.parse({ ...parsed.data, ...patch?.data })
  const inlet = irrigationPorts(node)[0]!
  if (portIsOccupied(inlet, nodes) || !node.parentId) return { create: [], update: batch }
  const feed = nearestDriplineFeed(node.path[0]!, node.parentId, node.zone, nodes, node.id)
  if (!feed) return { create: [], update: batch }
  const path = node.path.map(p => [...p] as Point)
  path[0] = snapDriplineInlet(path[0]!, feed)
  const snapped = DriplineNode.parse({ ...node, path })
  const route = planDriplineFeed(snapped, feed, nodes)
  return { create: route.create, update: [...batch.filter(u => (u.id as string) !== node.id), { id: node.id as AnyNodeId, data: { path } as Partial<AnyNode> }, ...route.update] }
}

/** Dropping a feed beside an unconnected drip inlet connects the pair too. */
export function planFeedEquipmentDrop(raw: unknown, batch: IrrigationPlan['update'], nodes: Readonly<Record<string, unknown>>): IrrigationPlan {
  const base = raw as { id: string; type: string }
  if (!['landscape:irrigation-valve', 'landscape:irrigation-source'].includes(base.type)) return { create: [], update: batch }
  const proposed = { ...nodes }
  for (const patch of batch) proposed[patch.id] = { ...(proposed[patch.id] as object), ...patch.data }
  const feeds = irrigationPorts(proposed[base.id]).filter(p => p.id === 'outlet')
  const choices = Object.values(proposed).flatMap(raw => {
    const drip = DriplineNode.safeParse(raw)
    if (!drip.success || portIsOccupied(irrigationPorts(drip.data)[0]!, proposed)) return []
    return feeds.flatMap(feed => {
      if (feed.parentId !== drip.data.parentId || feed.zone && feed.zone !== drip.data.zone) return []
      const p = drip.data.path[0]!
      const distance = Math.hypot(feed.position[0] - p[0], feed.position[2] - p[2])
      return distance <= .8 ? [{ node: drip.data, feed, distance }] : []
    })
  }).sort((a, b) => a.distance - b.distance)
  const candidate = choices[0]
  if (!candidate) return { create: [], update: batch }
  const path = candidate.node.path.map(p => [...p] as Point)
  path[0] = snapDriplineInlet(path[0]!, candidate.feed)
  const snapped = DriplineNode.parse({ ...candidate.node, path })
  const route = planDriplineFeed(snapped, candidate.feed, proposed)
  return { create: route.create, update: [...batch, { id: snapped.id as AnyNodeId, data: { path } as Partial<AnyNode> }, ...route.update] }
}
