import { irrigationEquipmentMove } from './editing'
import { irrigationMoveArrows } from './movement'
import { irrigationPlanSchedule } from '../editor/schedules'
import { zoneColor } from './zone-model'
import { createIrrigationHandleAffordance } from './editing'
import { useScene, BaseNode, nodeType, objectId, type NodePort, type FloorplanGeometry, type NodeDefinition } from '@pascal-app/core'
import { CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three'
import { z } from 'zod'
import { connectedIrrigationRunIds } from './run'
type Point = [number, number, number]
const lengthOf = (path: readonly Point[]) => path.slice(1).reduce((total, point, index) => total + Math.hypot(...point.map((value, axis) => value - path[index]![axis]!) as Point), 0)
export const IRRIGATION_DRIPLINE_KIND = 'landscape:dripline'
export const DriplineNode = BaseNode.extend({
  id: objectId('dripline'), type: nodeType(IRRIGATION_DRIPLINE_KIND),
  path: z.array(z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])).min(2).max(256).refine(path => lengthOf(path) >= 0.1 && lengthOf(path) <= 300, 'Dripline length must be 0.1–300 metres').default([[0, 0, 0], [3, 0, 0]]),
  diameter: z.number().finite().min(0.25).max(1.5).default(0.5),
  emitterSpacing: z.number().finite().min(0.1).max(5).default(0.3),
  requiredPressureBar: z.number().finite().min(.1).max(10).default(1),
  maximumPressureBar: z.number().finite().min(.1).max(10).default(2.5),
  emitterFlow: z.number().finite().min(0.1).max(20).default(2),
  zone: z.string().trim().max(80).default('Zone 1'),
  zoneId: z.string().optional(),
})
export type DriplineNode = z.infer<typeof DriplineNode>
export function driplineMetrics(node: DriplineNode) {
  const length = lengthOf(node.path)
  const emitters = Math.floor(length / node.emitterSpacing + 1e-9) + 1
  return { length, emitters, flow: emitters * node.emitterFlow / 60 }
}
/** Emitter at the start and every spacing station, never beyond the end. */
export function driplineEmitterPoints(node: DriplineNode): Point[] {
  const { emitters } = driplineMetrics(node)
  const result: Point[] = []
  let edge = 1, before = 0
  let edgeLength = lengthOf(node.path.slice(0, 2))
  for (let index = 0; index < emitters; index++) {
    const station = index * node.emitterSpacing
    while (edge < node.path.length - 1 && (edgeLength < 1e-9 || station > before + edgeLength + 1e-9)) {
      before += edgeLength; edge++
      edgeLength = lengthOf(node.path.slice(edge - 1, edge + 1))
    }
    const t = edgeLength > 1e-9 ? Math.min(1, Math.max(0, (station - before) / edgeLength)) : 0
    result.push(node.path[edge - 1]!.map((value, axis) => value + (node.path[edge]![axis]! - value) * t) as Point)
  }
  return result
}
/** Parent-local inlet at the authored first vertex; diameter is nominal inches. */
export function driplinePorts(node: DriplineNode): NodePort[] {
  const start = node.path[0]!
  const next = node.path.slice(1).find(point => point.some((value, axis) => Math.abs(value - start[axis]!) > 1e-9))!
  const direction = new Vector3(...start).sub(new Vector3(...next)).normalize()
  return [{ id: 'inlet', position: [...start] as [number, number, number], direction: direction.toArray() as [number, number, number], diameter: node.diameter, system: 'irrigation' }]
}
export function driplineGeometry(node: DriplineNode) {
  const group = new Group()
  const material = new MeshStandardMaterial({ color: '#111111', roughness: 0.65 })
  for (let index = 1; index < node.path.length; index++) {
    const a = new Vector3(...node.path[index - 1]!), b = new Vector3(...node.path[index]!)
    const direction = b.clone().sub(a), length = direction.length()
    if (length < 1e-9) continue
    const tube = new Mesh(new CylinderGeometry(node.diameter * 0.0254 / 2, node.diameter * 0.0254 / 2, length, 8), material)
    tube.name = 'Black drip tubing'
    tube.castShadow = true; tube.receiveShadow = true
    tube.position.copy(a).add(b).multiplyScalar(0.5); tube.position.y += 0.015
    tube.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
    group.add(tube)
  }
  // Round joints keep the tubing continuous at bends.
  const joints = new InstancedMesh(new SphereGeometry(node.diameter * .0254 / 2, 8, 6), material, node.path.length)
  node.path.forEach(([x, y, z], index) => joints.setMatrixAt(index, new Matrix4().makeTranslation(x, y + .015, z)))
  joints.name = 'Dripline bends'
  joints.computeBoundingBox(); joints.computeBoundingSphere()
  group.add(joints)
  const points = driplineEmitterPoints(node)
  const emitters = new InstancedMesh(new CylinderGeometry(0.016, 0.016, 0.012, 12), new MeshStandardMaterial({ color: zoneColor(node.zoneId || node.zone) }), points.length)
  points.forEach(([x, y, z], index) => emitters.setMatrixAt(index, new Matrix4().makeTranslation(x, y + 0.025, z)))
  emitters.name = 'Drip emitters'
  emitters.instanceMatrix.needsUpdate = true
  emitters.computeBoundingBox(); emitters.computeBoundingSphere()
  group.add(emitters)
  for (const end of [0, node.path.length - 1]) {
    const point = new Vector3(...node.path[end]!)
    const adjacent = end === 0 ? node.path.slice(1).find(p => p.some((v, i) => v !== node.path[0]![i]))! : [...node.path.slice(0, -1)].reverse().find(p => p.some((v, i) => v !== node.path[end]![i]))!
    const direction = new Vector3(...adjacent).sub(point).normalize()
    const radius = node.diameter * .0254 / 2 + .004
    const connector = new Mesh(new CylinderGeometry(radius, radius, .045, 16), material)
    connector.name = end === 0 ? 'Dripline inlet coupling' : 'Dripline end cap'
    connector.position.copy(point).addScaledVector(direction, .0225); connector.position.y += .015
    connector.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction)
    group.add(connector)
    if (end === 0) {
      const collar = new Mesh(new CylinderGeometry(radius + .002, radius + .002, .008, 16), new MeshStandardMaterial({ color: zoneColor(node.zoneId || node.zone), roughness: .55 }))
      collar.name = 'Inlet identification collar'
      collar.position.copy(point).addScaledVector(direction, .035); collar.position.y += .015
      collar.quaternion.copy(connector.quaternion); group.add(collar)
    }
  }
  return group
}
function floorplan(node: DriplineNode, ctx: { viewState?: { selected?: boolean } }): FloorplanGeometry {
  return { kind: 'group', children: [
    ...(ctx.viewState?.selected ? irrigationMoveArrows(node) : []),
    { kind: 'polyline', points: node.path.map(([x, , z]) => [x, z]), stroke: '#ffffff', strokeWidth: 0.085, pointerEvents: 'none' },
    { kind: 'polyline', points: node.path.map(([x, , z]) => [x, z]), stroke: '#111111', strokeWidth: 0.055 },
    { kind: 'circle', cx: node.path[0]![0], cy: node.path[0]![2], r: 0.08, fill: '#ffffff', stroke: '#2563eb', strokeWidth: 0.025, pointerEvents: 'none' },
    ...(ctx.viewState?.selected ? node.path.map(([x, , z], index): FloorplanGeometry => ({ kind: 'endpoint-handle', screenSized: true, point: [x, z], state: 'idle', affordance: 'irrigation-handle', payload: { kind: 'point', index } })) : []),
    ...(ctx.viewState?.selected ? node.path.slice(1).map((p, index): FloorplanGeometry => ({ kind: 'endpoint-handle', screenSized: true, point: [(p[0] + node.path[index]![0]) / 2, (p[2] + node.path[index]![2]) / 2], state: 'idle', affordance: 'irrigation-handle', payload: { kind: 'insert', index } })) : []),
    ...driplineEmitterPoints(node).map(([x, , z]): FloorplanGeometry => ({ kind: 'circle', cx: x, cy: z, r: 0.045, fill: zoneColor(node.zoneId || node.zone), stroke: '#111111', strokeWidth: 0.015, pointerEvents: 'none' })),
  ] }
}
export const driplineDefinition: NodeDefinition<typeof DriplineNode> = {
  kind: IRRIGATION_DRIPLINE_KIND, schemaVersion: 1, schema: DriplineNode, category: 'utility',
  snapProfile: 'structural', drafting: { cancelOnHistoryJump: true },
  tool: () => import('./dripline-tool'),
  floorplanMoveTarget: irrigationEquipmentMove,
  floorplanAffordances: { 'irrigation-handle': createIrrigationHandleAffordance() },
  affordanceTools: { selection: () => import('./selection') },
  extensions: { 'pascal:editor/floorplan': { schedule: irrigationPlanSchedule, directDrag: true, tool: () => import('./dripline-floorplan-tool') } },
  toolHints: [{ key: 'Click', label: 'Add a dripline point' }, { key: 'Enter', label: 'Finish dripline' }, { key: 'Esc', label: 'Cancel drawing' }],
  defaults: () => { const { id: _id, type: _type, ...defaults } = DriplineNode.parse({}); return defaults },
  capabilities: { selectable: { hitVolume: 'mesh' }, deletable: true, duplicable: true },
  ports: node => node.parentId && useScene.getState().nodes[node.parentId as never]?.type === 'level' ? driplinePorts(node) : [],
  geometry: driplineGeometry, floorplan, parametrics: { onDeleteCascade: (node, nodes) => connectedIrrigationRunIds(node.id, nodes), groups: [] },
  presentation: { label: 'Dripline', icon: { kind: 'iconify', name: 'lucide:droplets' }, hidden: true },
}
