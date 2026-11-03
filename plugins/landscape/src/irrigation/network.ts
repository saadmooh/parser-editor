import { IrrigationValveNode } from './valve'
import { IrrigationHeadNode } from './schema'
import { pathBacktracks, pathOverlaps, pathsCross } from './path-conflicts'
import { irrigationObstacles, pathHitsObstacle } from './routing-obstacles'
import { type AnyNode, type AnyNodeId, type SceneApi } from '@pascal-app/core'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { FITTING_LEG, IrrigationFittingNode } from './fitting'
import { connectionProblem, distance, irrigationPorts, portIsOccupied, resolveIrrigationPort, unit, type IrrigationPort, type Point } from './ports'
export type Connection = { nodeId: string; portId: string }
export type IrrigationPlan = { create: AnyNode[]; update: { id: AnyNodeId; data: Partial<AnyNode> }[]; delete?: AnyNodeId[] }
const add = (p: Point, dir: readonly number[], length: number): Point => p.map((v, i) => v + dir[i]! * length) as Point
const ref = (port: IrrigationPort): Connection => ({ nodeId: port.nodeId, portId: port.id })
export function applyIrrigationPlan(api: SceneApi, plan: IrrigationPlan, parentId: AnyNodeId) {
  if (!api.applyChanges) throw new Error('The editor must support atomic scene changes.')
  const nodes: Record<string, unknown> = { ...api.nodes() }
  for (const n of plan.create) nodes[n.id] = n
  for (const u of plan.update) nodes[u.id] = { ...(nodes[u.id] as object), ...u.data }
  for (const id of plan.delete ?? []) delete nodes[id]
  for (const id of [...plan.create.map(n => n.id), ...plan.update.map(u => u.id)]) {
    const run = IrrigationRunNode.safeParse(nodes[id])
    if (!run.success) continue
    const issues = irrigationRunIssues(run.data, nodes).filter(i => !i.endsWith('no outlet connection.') && !i.endsWith('connected valve is closed.') && !i.endsWith('water supply is disabled.'))
    if (issues.length) throw new Error(`Cannot connect water pipe: ${issues.join(' ')}`)
  }
  api.applyChanges({ create: plan.create.map(node => ({ node, parentId })), update: plan.update, delete: plan.delete })
}
export function cleanPath(points: Point[]): Point[] {
  const result: Point[] = []
  for (const p of points) {
    if (result.length && distance(p, result.at(-1)!) < 1e-6) continue
    while (result.length >= 2) {
      const a = unit(result.at(-1)!, result.at(-2)!), b = unit(p, result.at(-1)!)
      if (a.reduce((sum, v, i) => sum + v * b[i]!, 0) < 0.9999) break
      result.pop()
    }
    result.push([...p])
  }
  return result
}
export function pipePathPlan(points: Point[], diameter: number, zone: string, parentId: string, start?: Connection, end?: Connection): IrrigationPlan {
  const path = cleanPath(points)
  if (path.length < 2) throw new Error('Draw a longer pipe.')
  // Bends belong to the run. Only actual branch/diameter junctions are nodes.
  const run = IrrigationRunNode.parse({ parentId, path, diameter, zone, name: 'Water pipe', startConnection: start, endConnection: end })
  return { create: [run as unknown as AnyNode], update: [] }
}
export function planConnection(source: IrrigationPort, target: IrrigationPort | null, cursor: Point, waypoints: Point[], depth: number, nodes: Readonly<Record<string, unknown>>): IrrigationPlan {
  if (!source.parentId) throw new Error('Choose a connection on a level.')
  if (portIsOccupied(source, nodes)) throw new Error('This socket is occupied. Branch from its pipe instead.')
  if (target) { const problem = connectionProblem(source, target, nodes); if (problem) throw new Error(problem) }
  if (!Number.isFinite(depth) || depth < 0.05 || depth > 3) throw new Error('Pipe depth must be 0.05–3 m.')
  const zone = source.zone ?? target?.zone ?? ''
  const diameter = source.diameter ?? 0.5
  let destination = target, reducer: IrrigationFittingNode | null = null, adapterRun: IrrigationRunNode | null = null
  if (target && Math.abs(diameter - (target.diameter ?? diameter)) > 1e-6) {
    reducer = IrrigationFittingNode.parse({ parentId: source.parentId, name: 'Pipe reducer', fittingType: 'reducer', zone,
      position: add(target.position, target.direction, 0.25), directions: [target.direction, target.direction.map(v => -v)], diameters: [diameter, target.diameter],
    })
    const sockets = irrigationPorts(reducer)
    destination = sockets[0]!
    adapterRun = IrrigationRunNode.parse({ parentId: source.parentId, zone, diameter: target.diameter, name: 'Reducer connection', path: [sockets[1]!.position, target.position], startConnection: ref(sockets[1]!), endConnection: ref(target) })
  }
  const startLead = add(source.position, source.direction, 0.25)
  const endLead = destination ? add(destination.position, destination.direction, 0.25) : cursor
  const buriedY = Math.min(-depth, startLead[1], endLead[1])
  const buriedStart: Point = [startLead[0], buriedY, startLead[2]], buriedEnd: Point = [endLead[0], buriedY, endLead[2]]
  const prefix: Point[] = [source.position, startLead, buriedStart, ...waypoints.map(([x, , z]): Point => [x, buriedY, z])]
  const last = prefix.at(-1)!
  const suffix: Point[] = [buriedEnd, ...(destination ? [endLead, destination.position] : [])]
  const middle: Point[][] = [
    [[buriedEnd[0], buriedY, last[2]]],
    [[last[0], buriedY, buriedEnd[2]]],
    [[last[0], buriedY, Math.max(last[2], buriedEnd[2]) + .6], [buriedEnd[0], buriedY, Math.max(last[2], buriedEnd[2]) + .6]],
    [[Math.max(last[0], buriedEnd[0]) + .6, buriedY, last[2]], [Math.max(last[0], buriedEnd[0]) + .6, buriedY, buriedEnd[2]]],
  ]
  const obstacles = irrigationObstacles(source.parentId, nodes)
  // Reserve other sprinkler risers before routing, including later capacity zones.
  for (const raw of Object.values(nodes)) {
    const p = IrrigationHeadNode.safeParse(raw)
    if (!p.success || p.data.parentId !== source.parentId || [source.nodeId, target?.nodeId].includes(p.data.id)) continue
    obstacles.push({ name: 'Sprinkler riser', minX: p.data.position[0] - .04, maxX: p.data.position[0] + .04, minZ: p.data.position[2] - .04, maxZ: p.data.position[2] + .04 })
  }
  for (const raw of Object.values(nodes)) {
    const p = IrrigationValveNode.safeParse(raw)
    if (!p.success || p.data.parentId !== source.parentId || [source.nodeId, target?.nodeId].includes(p.data.id)) continue
    for (const port of irrigationPorts(p.data)) {
      const lead = add(port.position, port.direction, .25)
      obstacles.push({ name: 'Valve riser', minX: lead[0] - .04, maxX: lead[0] + .04, minZ: lead[2] - .04, maxZ: lead[2] + .04 })
    }
  }
  for (const x of [buriedEnd[0] - .2, buriedEnd[0] + .2]) middle.push([[x, buriedY, last[2]], [x, buriedY, buriedEnd[2]]])
  for (const z of [buriedEnd[2] - .2, buriedEnd[2] + .2]) middle.push([[last[0], buriedY, z], [buriedEnd[0], buriedY, z]])
  const clearance = .35
  for (const box of obstacles.slice(0, 32)) {
    for (const z of [box.minZ - clearance, box.maxZ + clearance]) middle.push([[last[0], buriedY, z], [buriedEnd[0], buriedY, z]])
    for (const x of [box.minX - clearance, box.maxX + clearance]) middle.push([[x, buriedY, last[2]], [x, buriedY, buriedEnd[2]]])
  }
  const existingPaths = Object.values(nodes).flatMap(raw => { const p = IrrigationRunNode.safeParse(raw); return p.success && p.data.parentId === source.parentId ? [p.data.path] : [] })
  const existingPoints = existingPaths.flat()
  if (existingPoints.length) {
    for (const z of [Math.min(...existingPoints.map(p => p[2])) - .6, Math.max(...existingPoints.map(p => p[2])) + .6]) middle.push([[last[0], buriedY, z], [buriedEnd[0], buriedY, z]])
    for (const x of [Math.min(...existingPoints.map(p => p[0])) - .6, Math.max(...existingPoints.map(p => p[0])) + .6]) middle.push([[x, buriedY, last[2]], [x, buriedY, buriedEnd[2]]])
  }
  middle.sort((a, b) => {
    const length = (bend: Point[]) => [last, ...bend, buriedEnd].slice(1).reduce((sum, p, i) => sum + distance(p, [last, ...bend, buriedEnd][i]!), 0)
    return length(a) - length(b)
  })
  let blocked = false
  let plan: IrrigationPlan | undefined
  routes: for (const drop of [0, .05, .1, .15]) for (const bend of middle) try {
    const routeY = buriedY - drop
    const routePrefix = prefix.map((p, i): Point => i >= 2 ? [p[0], routeY, p[2]] : p)
    const routeSuffix = suffix.map((p, i): Point => i === 0 ? [p[0], routeY, p[2]] : p)
    const path = cleanPath([...routePrefix, ...bend.map((p): Point => [p[0], routeY, p[2]]), ...routeSuffix])
    if (pathBacktracks(path)) continue
    if (existingPaths.some(existing => pathOverlaps(path, existing) || pathsCross(path, existing))) continue
    if (obstacles.some(box => pathHitsObstacle(path, box))) { blocked = true; continue }
    plan = pipePathPlan(path, diameter, zone, source.parentId, ref(source), destination ? ref(destination) : undefined)
    break routes
  } catch { continue }
  if (!plan) throw new Error(blocked ? 'No clear route around the hardscape. Move the devices or draw a route around it.' : 'Leave more room for the elbow sockets.')
  if (reducer && adapterRun) plan.create.push(reducer as unknown as AnyNode, adapterRun as unknown as AnyNode)
  const zoneId = source.zoneId ?? target?.zoneId
  if (zoneId && zone) plan.create = plan.create.map(n => ({ ...n, zoneId } as unknown as AnyNode))
  const runs = plan.create.flatMap(raw => { const parsed = IrrigationRunNode.safeParse(raw); return parsed.success ? [parsed.data] : [] })
  const first = runs[0]!, lastRun = runs.at(-1)!
  for (const [port, endpoint] of [[source, first], [target, lastRun]] as const) {
    if (!port || (nodes[port.nodeId] as { type?: string })?.type !== 'landscape:irrigation-run') continue
    const key = port.id === 'start' ? 'startConnection' : 'endConnection'
    plan.update.push({ id: port.nodeId as AnyNodeId, data: { [key]: { nodeId: endpoint.id, portId: port === source ? 'start' : 'end' } } as Partial<AnyNode> })
  }
  return plan
}
export function planBranch(run: IrrigationRunNode, segmentIndex: number, point: Point, branchDirection: Point, diameter = run.diameter, nodes: Readonly<Record<string, unknown>> = {}): { plan: IrrigationPlan; port: IrrigationPort } {
  const a = run.path[segmentIndex], b = run.path[segmentIndex + 1]
  if (!a || !b || !run.parentId) throw new Error('Choose a valid pipe segment.')
  const projected = (point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1]) + (point[2] - a[2]) * (b[2] - a[2])
  const t = projected / distance(a, b) ** 2
  if (!Number.isFinite(t) || t <= 0 || t >= 1 || distance(point, a.map((v, i) => v + (b[i]! - v) * t) as Point) > .001) throw new Error('The branch must lie on the selected pipe segment.')
  const axis = unit(b, a), along = branchDirection.reduce((sum, v, i) => sum + v * axis[i]!, 0)
  const perpendicular = branchDirection.map((v, i) => v - along * axis[i]!) as Point
  const branch = unit(perpendicular, [0, 0, 0])
  if (Math.hypot(...branch) < 0.9) throw new Error('Draw the branch away from the pipe.')
  if (distance(point, a) < FITTING_LEG + 0.05 || distance(point, b) < FITTING_LEG + 0.05) throw new Error('Move the branch farther from the pipe end.')
  const fitting = IrrigationFittingNode.parse({ parentId: run.parentId, fittingType: run.zone ? 'tee' : 'manifold', zone: run.zone, zoneId: run.zoneId, name: run.zone ? 'Zone tee' : 'Supply manifold', position: point,
    directions: [axis.map(v => -v), axis, branch], diameters: [run.diameter, run.diameter, diameter] })
  const sockets = irrigationPorts(fitting)
  const headPath = [...run.path.slice(0, segmentIndex + 1), sockets[0]!.position]
  const tail = IrrigationRunNode.parse({ ...run, id: undefined, name: run.name, path: [sockets[1]!.position, ...run.path.slice(segmentIndex + 1)], startConnection: ref(sockets[1]!) })
  const update: IrrigationPlan['update'] = [{ id: run.id as AnyNodeId, data: { path: headPath, endConnection: ref(sockets[0]!) } as Partial<AnyNode> }]
  if (run.endConnection) {
    const neighbor = IrrigationRunNode.safeParse(nodes[run.endConnection.nodeId])
    if (neighbor.success) {
      const key = run.endConnection.portId === 'start' ? 'startConnection' : 'endConnection'
      update.push({ id: neighbor.data.id as AnyNodeId, data: { [key]: { nodeId: tail.id, portId: 'end' } } as Partial<AnyNode> })
    }
  }
  return { plan: { create: [fitting, tail] as unknown as AnyNode[], update }, port: sockets[2]! }
}
export function movedEquipmentPlan(node: { id: string; parentId: string | null }, preview: unknown, nodes: Readonly<Record<string, unknown>>): IrrigationPlan['update'] {
  const updatedNodes = { ...nodes, [node.id]: preview }
  const updates: IrrigationPlan['update'] = []
  for (const raw of Object.values(nodes)) {
    const result = IrrigationRunNode.safeParse(raw)
    if (!result.success || result.data.parentId !== node.parentId) continue
    const run = result.data
    if (![run.startConnection, run.endConnection].some(c => c?.nodeId === node.id)) continue
    const start = run.startConnection ? resolveIrrigationPort(run.startConnection, updatedNodes) : undefined
    const end = run.endConnection ? resolveIrrigationPort(run.endConnection, updatedNodes) : undefined
    const interior = run.path.slice(1, -1)
    if (interior.length && start && Math.abs(distance(run.path[0]!, interior[0]!) - .2) < 1e-6) interior.shift()
    if (interior.length && end && Math.abs(distance(run.path.at(-1)!, interior.at(-1)!) - .2) < 1e-6) interior.pop()
    const path = cleanPath([
      start?.position ?? run.path[0]!,
      ...(start ? [add(start.position, start.direction, 0.2)] : []),
      ...interior,
      ...(end ? [add(end.position, end.direction, 0.2)] : []),
      end?.position ?? run.path.at(-1)!,
    ])
    updates.push({ id: run.id as AnyNodeId, data: { path } as Partial<AnyNode> })
  }
  return updates
}
