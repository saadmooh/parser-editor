import { irrigationEquipmentMove } from './editing'
import { movedEquipmentPlan } from './network'
import { createIrrigationHandleAffordance } from './editing'
import { irrigationMoveArrows } from './movement'
import { irrigationPlanSchedule } from '../editor/schedules'
import { zoneColor } from './zone-model'
import { BaseNode, nodeType, objectId, type NodeDefinition, type NodePort } from '@pascal-app/core'
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { z } from 'zod'
const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
export const FITTING_KIND = 'landscape:irrigation-fitting'
export const FITTING_LEG = 0.08
export const IrrigationFittingNode = BaseNode.extend({
  id: objectId('irrigation-fitting'), type: nodeType(FITTING_KIND),
  position: point.default([0, 0, 0]),
  fittingType: z.enum(['elbow', 'tee', 'reducer', 'manifold', 'coupling', 'filter-regulator']).default('tee'),
  directions: z.array(point.refine(p => Math.abs(Math.hypot(...p) - 1) < 0.001, 'Socket direction must be a unit vector')).min(2).max(8).default([[-1, 0, 0], [1, 0, 0], [0, 0, 1]]),
  diameters: z.array(z.number().finite().min(0.25).max(4)).min(2).max(8).default([0.5, 0.5, 0.5]),
  ownerValveId: z.string().optional(),
  regulatedPressureBar: z.number().finite().min(.1).max(10).default(2.1),
  filterMesh: z.number().int().min(50).max(300).default(200),
  zone: z.string().trim().max(80).default('Zone 1'),
  zoneId: z.string().optional(),
}).refine(n => n.directions.length === n.diameters.length, 'Every socket needs a diameter')
export type IrrigationFittingNode = z.infer<typeof IrrigationFittingNode>
export function irrigationFittingPorts(node: IrrigationFittingNode): NodePort[] {
  return node.directions.map((direction, index) => ({
    id: `socket-${index}`, direction, diameter: node.diameters[index]!, system: 'irrigation',
    position: node.position.map((p, axis) => p + direction[axis]! * FITTING_LEG) as [number, number, number],
  }))
}
export const irrigationFittingDefinition: NodeDefinition<typeof IrrigationFittingNode> = {
  kind: FITTING_KIND, schemaVersion: 1, schema: IrrigationFittingNode, category: 'utility', distributionRole: 'fitting',
  connectedMove: movedEquipmentPlan, floorplanMoveTarget: irrigationEquipmentMove,
  portConnectivityFollow: false,
  floorplanAffordances: { 'irrigation-handle': createIrrigationHandleAffordance() },
  affordanceTools: { selection: () => import('./selection') },
  defaults: () => { const { id: _id, type: _type, ...fields } = IrrigationFittingNode.parse({}); return fields },
  capabilities: { movable: { axes: ['x', 'z'], gridSnap: true }, selectable: { hitVolume: 'bbox' }, deletable: true, duplicable: true, refs: [{ path: 'ownerValveId', namespace: 'node', role: 'connection', onDelete: 'drop', onPreset: 'strip', targetKinds: ['landscape:irrigation-valve'] }] },
  ports: irrigationFittingPorts,
  extensions: { 'pascal:editor/floorplan': { schedule: irrigationPlanSchedule, directDrag: true } },
  geometry: node => {
    const group = new Group(), material = new MeshStandardMaterial({ color: '#111111' })
    node.directions.forEach((direction, index) => {
      const radius = node.diameters[index]! * 0.0254 / 2
      const tube = new Mesh(new CylinderGeometry(radius, radius, FITTING_LEG, 12), material)
      tube.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...direction)))
      tube.position.set(...direction.map(v => v * FITTING_LEG / 2) as [number, number, number]); group.add(tube)
    })
    if (node.fittingType === 'filter-regulator') {
      const filter = new Mesh(new CylinderGeometry(.045, .035, .13, 20), material)
      filter.name = 'Drip filter housing'; filter.position.y = .05; group.add(filter)
      const cap = new Mesh(new CylinderGeometry(.05, .05, .02, 20), new MeshStandardMaterial({ color: zoneColor(node.zoneId || node.zone) }))
      cap.name = 'Pressure regulator cap'; cap.position.y = .125; group.add(cap)
    }
    return group
  },
  floorplan: (node, ctx) => ({ kind: 'group', children: [
    ...(ctx.viewState?.selected ? irrigationMoveArrows(node) : []),
    ...irrigationFittingPorts(node).map(port => ({ kind: 'polyline' as const, points: [[node.position[0], node.position[2]], [port.position[0], port.position[2]]] as [number, number][], stroke: '#111111', strokeWidth: 0.035 })),
    { kind: 'circle', cx: node.position[0], cy: node.position[2], r: 0.06, fill: '#26354a', stroke: zoneColor(node.zoneId || node.zone), strokeWidth: 0.025 },
  ] }),
  parametrics: { groups: [{ label: 'Drip filter and regulator', fields: [
    { key: 'regulatedPressureBar', label: 'Outlet pressure (bar)', kind: 'number', min: .1, max: 10, step: .1, visibleIf: node => node.fittingType === 'filter-regulator' },
    { key: 'filterMesh', label: 'Filter mesh', kind: 'number', min: 50, max: 300, step: 1, visibleIf: node => node.fittingType === 'filter-regulator' },
  ] }] },
  presentation: { label: 'Irrigation fitting', icon: { kind: 'iconify', name: 'lucide:git-branch' }, hidden: true },
}
