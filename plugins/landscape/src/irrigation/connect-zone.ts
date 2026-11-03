import { planDripHeader } from './drip-header'
import { type AnyNode, type AnyNodeId } from '@pascal-app/core'
import { ensureDripControl } from './drip-control'
import { deviceMethod, portMethod } from './method'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { irrigationPorts, portIsOccupied, unit, type IrrigationPort, type Point } from './ports'
import { planBranch, planConnection, type IrrigationPlan } from './network'
export function mergePlan(nodes: Readonly<Record<string, unknown>>, plan: IrrigationPlan): Record<string, unknown> {
  const result = { ...nodes }
  for (const n of plan.create) result[n.id] = n
  for (const u of plan.update) result[u.id] = { ...(result[u.id] as object), ...u.data }
  for (const id of plan.delete ?? []) delete result[id]
  return result
}
function reachable(source: string, nodes: Readonly<Record<string, unknown>>) {
  const edges = new Map<string, Set<string>>()
  for (const raw of Object.values(nodes)) {
    const p = IrrigationRunNode.safeParse(raw)
    if (!p.success || irrigationRunIssues(p.data, nodes).some(i => !i.endsWith('connected valve is closed.') && !i.endsWith('water supply is disabled.'))) continue
    const run = p.data
    for (const c of [run.startConnection, run.endConnection]) {
      if (!c) continue
      if (!edges.has(run.id)) edges.set(run.id, new Set())
      if (!edges.has(c.nodeId)) edges.set(c.nodeId, new Set())
      edges.get(run.id)!.add(c.nodeId); edges.get(c.nodeId)!.add(run.id)
    }
  }
  const found = new Set<string>(), queue = [source]
  while (queue.length) { const id = queue.pop()!; if (found.has(id)) continue; found.add(id); queue.push(...(edges.get(id) ?? [])) }
  return found
}
export function branchToTarget(anchor: string, target: IrrigationPort, zone: string, nodes: Readonly<Record<string, unknown>>, depth: number) {
  const connected = reachable(anchor, nodes)
  const choices: { run: IrrigationRunNode; index: number; point: Point; length: number }[] = []
  for (const raw of Object.values(nodes)) {
    const p = IrrigationRunNode.safeParse(raw)
    if (!p.success || p.data.routingLocked || !connected.has(p.data.id) || p.data.zone !== zone) continue
    p.data.path.slice(1).forEach((b, index) => {
      const a = p.data.path[index]!, dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz)
      if (length < .5 || Math.abs(a[1] - b[1]) > .001) return
      const t = Math.max(.2 / length, Math.min(1 - .2 / length, ((target.position[0] - a[0]) * dx + (target.position[2] - a[2]) * dz) / (length * length)))
      for (const candidate of [...new Set([t, .5, .25, .75])]) choices.push({ run: p.data, index, point: [a[0] + candidate * dx, a[1], a[2] + candidate * dz], length })
    })
  }
  choices.sort((a, b) => Math.hypot(a.point[0] - target.position[0], a.point[2] - target.position[2]) - Math.hypot(b.point[0] - target.position[0], b.point[2] - target.position[2]))
  for (const choice of choices) try {
    let direction = unit([target.position[0], choice.point[1], target.position[2]], choice.point)
    const axis = unit(choice.run.path[choice.index + 1]!, choice.run.path[choice.index]!)
    if (Math.hypot(...direction) < .9 || Math.abs(direction.reduce((n, v, i) => n + v * axis[i]!, 0)) > .99) direction = [-axis[2], 0, axis[0]]
    const branch = planBranch(choice.run, choice.index, choice.point, direction, choice.run.diameter, nodes)
    const next = mergePlan(nodes, branch.plan)
    const connection = planConnection(branch.port, target, target.position, [], depth, next)
    return { create: [...branch.plan.create, ...connection.create], update: [...branch.plan.update, ...connection.update] }
  } catch { continue }
  throw new Error('No trunk has enough room for another tee. Draw a longer pipe, then add a branch.')
}
export function planConnectZone(source: IrrigationPort, valveInlet: IrrigationPort, valveOutlet: IrrigationPort, targets: readonly IrrigationPort[], depth: number, original: Readonly<Record<string, unknown>>): IrrigationPlan {
  const methods = new Set(targets.map(t => deviceMethod(original[t.nodeId])).filter(Boolean))
  if (methods.size > 1) throw new Error('Sprinklers and drip need separate zone valves.')
  const method = [...methods][0]
  const valveMethod = portMethod(valveOutlet, original)
  if (valveMethod === 'mixed' || method && valveMethod && method !== valveMethod) throw new Error('Choose a valve for this watering method.')
  if (!targets.length) throw new Error('Place sprinklers or a dripline in this zone first.')
  if (!valveOutlet.zone || targets.some(t => t.zone !== valveOutlet.zone)) throw new Error('Choose equipment in the valve’s zone.')
  let nodes = { ...original }
  const updateKeys = new Set<string>()
  const apply = (plan: IrrigationPlan) => { nodes = mergePlan(nodes, plan); plan.update.forEach(u => updateKeys.add(u.id)) }
  if (!reachable(source.nodeId, nodes).has(valveInlet.nodeId)) {
    if (portIsOccupied(valveInlet, nodes)) throw new Error('The valve inlet is connected elsewhere. Review that connection first.')
    apply(portIsOccupied(source, nodes) ? branchToTarget(source.nodeId, valveInlet, '', nodes, depth) : planConnection(source, valveInlet, valveInlet.position, [], depth, nodes))
  }
  if (method === 'drip') { const control = ensureDripControl(valveOutlet, nodes, depth); apply(control.plan); valveOutlet = control.outlet }
  if (method === 'drip') {
    const header = planDripHeader(valveOutlet, targets, depth, nodes)
    if (header) apply(header)
  }
  for (const target of targets) {
    if (reachable(valveOutlet.nodeId, nodes).has(target.nodeId)) continue
    if (portIsOccupied(target, nodes)) {
      if (portIsOccupied(valveOutlet, nodes)) throw new Error(`${target.name} belongs to a separate pipe network. Join the two trunks with a pipe branch.`)
      // Automatically placed sprinklers already share a trunk. Feed that trunk
      // through a tee instead of trying to reuse an occupied sprinkler inlet.
      apply(branchToTarget(target.nodeId, valveOutlet, valveOutlet.zone!, nodes, depth))
      continue
    }
    apply(portIsOccupied(valveOutlet, nodes) ? branchToTarget(valveOutlet.nodeId, target, valveOutlet.zone!, nodes, depth) : planConnection(valveOutlet, target, target.position, [], depth, nodes))
  }
  return {
    create: Object.entries(nodes).flatMap(([id, n]) => !original[id] ? [n as AnyNode] : []),
    update: [...updateKeys].flatMap(id => original[id] ? [{ id: id as AnyNodeId, data: nodes[id] as Partial<AnyNode> }] : []),
  }
}
