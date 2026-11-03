import { irrigationEquipmentMove } from './editing'
import { irrigationMoveArrows } from './movement'
import { irrigationPlanSchedule } from '../editor/schedules'
import { zoneColor } from './zone-model'
import { createIrrigationHandleAffordance } from './editing'
import { useScene } from '@pascal-app/core'
import { BaseNode, nodeType, objectId, type AnyNode, type AnyNodeId, type FloorplanGeometry, type GeometryContext, type NodeDefinition } from '@pascal-app/core'
import { SphereGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { z } from 'zod'
import { IrrigationSourceNode, irrigationSourcePorts } from './source'
import { DriplineNode, driplinePorts } from './dripline'
import { IrrigationHeadNode } from './schema'
import { IrrigationValveNode, irrigationValvePorts } from './valve'
import { resolveIrrigationPort } from './ports'

const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
const connection = z.object({ nodeId: z.string().min(1), portId: z.string().min(1).max(80) })
export const IRRIGATION_RUN_KIND = 'landscape:irrigation-run'
export const IrrigationRunNode = BaseNode.extend({
  id: objectId('irrigation-run'), type: nodeType(IRRIGATION_RUN_KIND),
  path: z.array(point).min(2).max(256).default([[0, 0, 0], [1, 0, 0]]),
  diameter: z.number().finite().min(0.25).max(4).default(0.5),
  zone: z.string().trim().max(80).default('Zone 1'),
  zoneId: z.string().optional(),
  routeRole: z.enum(['main', 'lateral', 'connection']).default('lateral'),
  routingLocked: z.boolean().default(false),
  internalDiameterMm: z.number().finite().min(4).max(200).optional(),
  roughnessC: z.number().finite().min(80).max(160).default(150),
  minorLossK: z.number().finite().min(0).max(100).default(0),
  system: z.literal('irrigation').default('irrigation'),
  startConnection: connection.optional(), endConnection: connection.optional(),
})
export type IrrigationRunNode = z.infer<typeof IrrigationRunNode>

export function connectedIrrigationRunIds(headId: string, nodes: Record<AnyNodeId, AnyNode>, portId?: string): AnyNodeId[] {
  return Object.values(nodes).flatMap(raw => {
    const parsed = IrrigationRunNode.safeParse(raw)
    return parsed.success && [parsed.data.startConnection, parsed.data.endConnection].some(connection => connection?.nodeId === headId && (!portId || connection.portId === portId)) ? [raw.id as AnyNodeId] : []
  })
}

export function irrigationRunIssues(run: IrrigationRunNode, nodes: Readonly<Record<string, unknown>>): string[] {
  const issues: string[] = []
  for (const [label, connection, position] of [
    ['Start', run.startConnection, run.path[0]!],
    ['End', run.endConnection, run.path.at(-1)!],
  ] as const) {
    if (!connection) { issues.push(`${label}: no outlet connection.`); continue }
    const raw = nodes[connection.nodeId]
    if (!raw) { issues.push(`${label}: connected outlet is missing.`); continue }
    const outlet = resolveIrrigationPort(connection, nodes)
    if (!outlet) { issues.push(`${label}: connected socket does not exist.`); continue }
    if (outlet.parentId !== run.parentId) issues.push(`${label}: outlet and run have different parents.`)
    if (Math.hypot(...position.map((value, axis) => value - outlet.position[axis]!) as [number, number, number]) > 0.001)
      issues.push(`${label}: centerline no longer meets the outlet.`)
    const collisions = Object.values(nodes).filter(raw => {
      const other = raw as { id?: string; type?: string; startConnection?: { nodeId: string; portId: string }; endConnection?: { nodeId: string; portId: string } }
      return other?.type === IRRIGATION_RUN_KIND && other.id !== run.id && [other.startConnection, other.endConnection].some(ref => ref?.nodeId === connection.nodeId && ref.portId === connection.portId)
    })
    if (collisions.length) issues.push(`${label}: socket is used by more than one pipe; a tee is required.`)
    if ((raw as { type?: string }).type === IRRIGATION_RUN_KIND) {
      const other = raw as IrrigationRunNode
      const reciprocal = connection.portId === 'start' ? other.startConnection : other.endConnection
      if (reciprocal?.nodeId !== run.id || reciprocal.portId !== (label === 'Start' ? 'start' : 'end')) issues.push(`${label}: neighboring pipe does not reference this endpoint.`)
    }
    const socketDirection = outlet.direction
    const source = IrrigationSourceNode.safeParse(raw)
    const valve = IrrigationValveNode.safeParse(raw)
    const neighbor = label === 'Start' ? run.path[1]! : run.path.at(-2)!
    const approach = new Vector3(...neighbor).sub(new Vector3(...position))
    const meetsSocket = Math.hypot(...position.map((value, axis) => value - outlet.position[axis]!) as [number, number, number]) <= 0.001
    if (meetsSocket && outlet.id === connection.portId && approach.lengthSq() > 1e-18 &&
      approach.normalize().dot(new Vector3(...socketDirection as [number, number, number]).normalize()) < 0.999)
      issues.push(`${label}: centerline approaches against the socket direction; a fitting is required.`)
    if (Math.abs(outlet.diameter - run.diameter) > 1e-6) issues.push(`${label}: nominal diameter differs; a reducer is required.`)
    if (outlet.zone !== null && outlet.zone.trim() !== run.zone.trim() && !(valve.success && connection.portId === 'inlet' && run.zone === '')) issues.push(`${label}: zone differs from the outlet.`)
    if (source.success && !source.data.enabled) issues.push(`${label}: water supply is disabled.`)
    if (valve.success && !valve.data.isOpen) issues.push(`${label}: connected valve is closed.`)
  }
  if (run.startConnection && run.startConnection.nodeId === run.endConnection?.nodeId && run.startConnection.portId === run.endConnection?.portId) issues.push('Both ends reference the same inlet.')
  if (run.path.slice(1).some((p, index) => p.every((value, axis) => Math.abs(value - run.path[index]![axis]!) < 1e-9))) issues.push('Centerline contains a zero-length segment.')
  return issues
}

export function canRouteHeads(a: IrrigationHeadNode, b: IrrigationHeadNode, depth: number): boolean {
  return !!a.parentId && a.parentId === b.parentId && a.id !== b.id && a.zone.trim() === b.zone.trim() && Math.abs(a.inletDiameter - b.inletDiameter) <= 1e-6 && Number.isFinite(depth) && depth >= 0.05 && depth <= 3 && Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]) >= 0.05
}

export function canRouteValveToHead(valve: IrrigationValveNode, head: Pick<IrrigationHeadNode, 'parentId' | 'position' | 'zone' | 'inletDiameter'> & { id: string }, depth: number): boolean {
  return !!valve.parentId && valve.parentId === head.parentId && valve.zone.trim() === head.zone.trim() && Math.abs(valve.diameter - head.inletDiameter) <= 1e-6 && Number.isFinite(depth) && depth >= 0.05 && depth <= 3 && Math.hypot(valve.position[0] - head.position[0], valve.position[2] - head.position[2]) >= 0.5
}

export function routeValveToHead(valve: IrrigationValveNode, head: Pick<IrrigationHeadNode, 'parentId' | 'position' | 'zone' | 'inletDiameter'> & { id: string }, depth: number): IrrigationRunNode | null {
  if (!canRouteValveToHead(valve, head, depth)) return null
  const outlet = irrigationValvePorts(valve).find(port => port.id === 'outlet')!
  const lead = new Vector3(...outlet.position).addScaledVector(new Vector3(...outlet.direction), 0.2).toArray() as [number, number, number]
  const y = Math.min(valve.position[1], head.position[1]) - depth
  const candidates: [number, number, number][] = [[...outlet.position], lead, [lead[0], y, lead[2]], [head.position[0], y, lead[2]], [head.position[0], y, head.position[2]], head.position]
  const path = candidates.filter((p, index) => index === 0 || p.some((value, axis) => Math.abs(value - candidates[index - 1]![axis]!) > 1e-9))
  return IrrigationRunNode.parse({ parentId: valve.parentId, name: 'Valve outlet run', path, diameter: valve.diameter, zone: valve.zone,
    startConnection: { nodeId: valve.id, portId: 'outlet' }, endConnection: { nodeId: head.id, portId: 'inlet' } })
}

const driplineRouteTarget = (drip: DriplineNode) => ({ id: drip.id, parentId: drip.parentId, position: drip.path[0]!, zone: drip.zone, inletDiameter: drip.diameter })
export function canRouteValveToDripline(valve: IrrigationValveNode, drip: DriplineNode, depth: number) {
  return canRouteValveToHead(valve, driplineRouteTarget(drip), depth)
}
export function routeValveToDripline(valve: IrrigationValveNode, drip: DriplineNode, depth: number) {
  const run = routeValveToHead(valve, driplineRouteTarget(drip), depth)
  if (!run) return null
  const port = driplinePorts(drip)[0]!
  const approach = new Vector3(...port.position).addScaledVector(new Vector3(...port.direction), 0.2).toArray() as [number, number, number]
  return { ...run, name: 'Dripline supply run', path: [...run.path.slice(0, -1), approach, run.path.at(-1)!] }

}

export function canRouteSourceToValve(source: IrrigationSourceNode, valve: IrrigationValveNode, depth: number) {
  return !!source.parentId && source.parentId === valve.parentId && Math.abs(source.diameter - valve.diameter) <= 1e-6 && Number.isFinite(depth) && depth >= 0.05 && depth <= 3 && Math.hypot(source.position[0] - valve.position[0], source.position[2] - valve.position[2]) >= 0.5
}
export function routeSourceToValve(source: IrrigationSourceNode, valve: IrrigationValveNode, depth: number) {
  if (!canRouteSourceToValve(source, valve, depth)) return null
  const start = irrigationSourcePorts(source)[0]!, end = irrigationValvePorts(valve)[0]!
  const lead = new Vector3(...start.position).addScaledVector(new Vector3(...start.direction), 0.2).toArray() as [number, number, number]
  const approach = new Vector3(...end.position).addScaledVector(new Vector3(...end.direction), 0.2).toArray() as [number, number, number]
  const y = Math.min(start.position[1], end.position[1]) - depth
  const candidates: [number, number, number][] = [[...start.position], lead, [lead[0], y, lead[2]], [approach[0], y, lead[2]], [approach[0], y, approach[2]], approach, [...end.position]]
  const path = candidates.filter((point, index) => !index || point.some((value, axis) => Math.abs(value - candidates[index - 1]![axis]!) > 1e-9))
  return IrrigationRunNode.parse({ parentId: source.parentId, name: 'Water supply run', diameter: source.diameter, zone: valve.zone, path, startConnection: { nodeId: source.id, portId: 'outlet' }, endConnection: { nodeId: valve.id, portId: 'inlet' } })
}

export function irrigationRunLength(node: IrrigationRunNode) {
  return node.path.slice(1).reduce((length, p, index) => length + Math.hypot(...p.map((value, axis) => value - node.path[index]![axis]!) as [number, number, number]), 0)
}

/** Initial orthogonal centerline. Buried route depth is level-relative. */
export function routeBetweenHeads(a: IrrigationHeadNode, b: IrrigationHeadNode, depth: number): IrrigationRunNode | null {
  if (!canRouteHeads(a, b, depth)) return null
  const y = Math.min(a.position[1], b.position[1]) - depth
  const candidates: [number, number, number][] = [a.position, [a.position[0], y, a.position[2]], [b.position[0], y, a.position[2]], [b.position[0], y, b.position[2]], b.position]
  const path = candidates.filter((p, index) => index === 0 || p.some((value, axis) => Math.abs(value - candidates[index - 1]![axis]!) > 1e-9))
  return IrrigationRunNode.parse({ parentId: a.parentId, name: 'Irrigation run', path, diameter: a.inletDiameter, zone: a.zone,
    startConnection: { nodeId: a.id, portId: 'inlet' }, endConnection: { nodeId: b.id, portId: 'inlet' } })
}

function geometry(node: IrrigationRunNode) {
  const group = new Group()
  const material = new MeshStandardMaterial({ color: '#111111', roughness: 0.65 })
  for (let index = 1; index < node.path.length; index++) {
    const a = new Vector3(...node.path[index - 1]!), b = new Vector3(...node.path[index]!)
    const direction = b.clone().sub(a), length = direction.length()
    if (length < 1e-9) continue
    const pipe = new Mesh(new CylinderGeometry(node.diameter * 0.0254 / 2, node.diameter * 0.0254 / 2, length, 12), material)
    pipe.position.copy(a).add(b).multiplyScalar(0.5)
    pipe.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
    group.add(pipe)
  }
  for (const p of node.path.slice(1, -1)) {
    const joint = new Mesh(new SphereGeometry(node.diameter * .0254 / 2, 12, 8), material)
    joint.name = 'Continuous pipe bend'; joint.position.set(...p); group.add(joint)
  }
  return group
}
function floorplan(node: IrrigationRunNode, ctx: GeometryContext): FloorplanGeometry {
  const line: FloorplanGeometry = { kind: 'polyline', points: node.path.map(([x, , z]) => [x, z]), stroke: '#111111', strokeWidth: 0.05, strokeDasharray: '0.15 0.08' }
  const connections = [node.startConnection, node.endConnection].filter(Boolean)
  const connectedNodes = Object.fromEntries(connections.map(c => [c!.nodeId, ctx.resolve(c!.nodeId as AnyNodeId)]))
  const issues = irrigationRunIssues(node, connectedNodes)
  const pin: FloorplanGeometry[] = issues.length ? [{ kind: 'circle', cx: node.path[0]![0], cy: node.path[0]![2], r: .16, fill: '#dc2626' }, { kind: 'text', x: node.path[0]![0], y: node.path[0]![2] + .065, text: '!', fontSize: .2, fill: '#ffffff', textAnchor: 'middle', upright: true }] : []
  const inserts: FloorplanGeometry[] = ctx.viewState?.selected ? node.path.slice(1).map((p, index) => ({ kind: 'endpoint-handle', screenSized: true, point: [(p[0] + node.path[index]![0]) / 2, (p[2] + node.path[index]![2]) / 2], state: 'idle', affordance: 'irrigation-handle', payload: { kind: 'insert', index } })) : []
  return { kind: 'group', children: [...(ctx.viewState?.selected ? irrigationMoveArrows(node) : []), line, ...pin, ...inserts, ...(ctx.viewState?.selected ? node.path.map(([x, , z], index): FloorplanGeometry => ({ kind: 'endpoint-handle', screenSized: true, point: [x, z], state: 'idle', affordance: 'irrigation-handle', payload: { kind: 'point', index } })) : [])] }
}
export const irrigationRunDefinition: NodeDefinition<typeof IrrigationRunNode> = {
  kind: IRRIGATION_RUN_KIND, schemaVersion: 2, schema: IrrigationRunNode, category: 'utility', distributionRole: 'run',
  snapProfile: 'structural', drafting: { cancelOnHistoryJump: true },
  tool: () => import('./pipe-tool'),
  floorplanMoveTarget: irrigationEquipmentMove,
  floorplanAffordances: { 'irrigation-handle': createIrrigationHandleAffordance() },
  affordanceTools: { selection: () => import('./selection') },
  extensions: { 'pascal:editor/floorplan': { schedule: irrigationPlanSchedule, directDrag: true, tool: () => import('./pipe-floorplan-tool') } },
  toolHints: [{ key: 'Click', label: 'Start at a socket or pipe' }, { key: 'Click again', label: 'Connect and continue' }, { key: 'Esc', label: 'Finish drawing' }],
  defaults: () => { const { id: _id, type: _type, ...defaults } = IrrigationRunNode.parse({}); return defaults },
  capabilities: { selectable: { hitVolume: 'mesh' }, deletable: true, duplicable: true,
    refs: [
      { path: 'startConnection.nodeId', namespace: 'node', role: 'connection', onDelete: 'cascade', onPreset: 'strip', dependents: ['startConnection'] },
      { path: 'endConnection.nodeId', namespace: 'node', role: 'connection', onDelete: 'cascade', onPreset: 'strip', dependents: ['endConnection'] },
    ],
  },
  ports: (node) => {
    const end = (id: string, p: number[], next: number[]) => {
      const direction = new Vector3(...p as [number, number, number]).sub(new Vector3(...next as [number, number, number])).normalize()
      return { id, position: p as [number, number, number], direction: direction.toArray() as [number, number, number], diameter: node.diameter, system: 'irrigation' }
    }
    return [end('start', node.path[0]!, node.path[1]!), end('end', node.path.at(-1)!, node.path.at(-2)!)]
  },
  geometry, floorplan,
  parametrics: { groups: [{ label: 'Irrigation run', fields: [{ key: 'diameter', label: 'Nominal diameter (inches)', kind: 'number', min: 0.25, max: 4, step: 0.25 }] }] },
  presentation: { label: 'Irrigation run', icon: { kind: 'iconify', name: 'lucide:route' }, hidden: true },
}
