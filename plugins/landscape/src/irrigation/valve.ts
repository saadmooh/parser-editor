import { createIrrigationHandleAffordance } from './editing'
import { irrigationMoveArrows } from './movement'
import { irrigationPlanSchedule } from '../editor/schedules'
import { irrigationValveGeometry } from './equipment-models'
import { zoneColor } from './zone-model'
import { movedEquipmentPlan } from './network'
import { irrigationEquipmentMove } from './editing'
import { BaseNode, nodeType, objectId, useScene, type FloorplanGeometry, type NodeDefinition, type NodePort } from '@pascal-app/core'
import { Euler, Vector3 } from 'three'
import { z } from 'zod'
import { connectedIrrigationRunIds } from './run'
import { clearDeletedValveAssignments } from './controller'

export const IRRIGATION_VALVE_KIND = 'landscape:irrigation-valve'
export const IrrigationValveNode = BaseNode.extend({
  id: objectId('irrigation-valve'), type: nodeType(IRRIGATION_VALVE_KIND),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).default([0, 0, 0]),
  rotation: z.tuple([z.literal(0), z.number().finite(), z.literal(0)]).default([0, 0, 0]),
  diameter: z.number().finite().min(0.25).max(4).default(0.75),
  zone: z.string().trim().max(80).default('Zone 1'),
  zoneId: z.string().optional(),
  method: z.enum(['sprinkler', 'drip']).optional(),
  isOpen: z.boolean().default(true),
})
export type IrrigationValveNode = z.infer<typeof IrrigationValveNode>

/** Physical sockets exist even when the authored valve state is closed. */
export function irrigationValvePorts(node: IrrigationValveNode): NodePort[] {
  const yaw = new Euler(...node.rotation)
  return [-1, 1].map(sign => ({
    id: sign === -1 ? 'inlet' : 'outlet',
    position: new Vector3(sign * 0.15, 0.06, 0).applyEuler(yaw).add(new Vector3(...node.position)).toArray() as [number, number, number],
    direction: new Vector3(sign, 0, 0).applyEuler(yaw).toArray() as [number, number, number],
    diameter: node.diameter, system: 'irrigation',
  }))
}
function floorplan(node: IrrigationValveNode, ctx: { viewState?: { selected?: boolean } }): FloorplanGeometry {
  const ports = irrigationValvePorts(node)
  const [x, , z] = node.position
  const color = node.isOpen ? zoneColor(node.zoneId || node.zone) : '#e87979'
  return { kind: 'group', children: [
    ...(ctx.viewState?.selected ? irrigationMoveArrows(node) : []),
    { kind: 'polyline', points: ports.map(port => [port.position[0], port.position[2]]), stroke: '#111111', strokeWidth: 0.05 },
    { kind: 'circle', cx: x, cy: z, r: 0.12, fill: '#26354a', stroke: color, strokeWidth: 0.03 },
    { kind: 'text', x, y: z + 0.3, text: `${node.zone || 'Unassigned'} · ${node.isOpen ? 'Open' : 'Closed'}`, upright: true, textAnchor: 'middle', fontSize: 0.16, fill: '#25354a', stroke: '#ffffff', strokeWidth: 0.04, paintOrder: 'stroke' },
  ] }
}
export const irrigationValveDefinition: NodeDefinition<typeof IrrigationValveNode> = {
  kind: IRRIGATION_VALVE_KIND, schemaVersion: 1, schema: IrrigationValveNode, category: 'utility', snapProfile: 'item',
  connectedMove: movedEquipmentPlan, floorplanMoveTarget: irrigationEquipmentMove,
  tool: () => import('./equipment-tool'),
  extensions: { 'pascal:editor/floorplan': { schedule: irrigationPlanSchedule, directDrag: true, tool: () => import('./equipment-floorplan-tool') } },
  floorplanAffordances: { 'irrigation-handle': createIrrigationHandleAffordance() },
  affordanceTools: { selection: () => import('./selection') },
  defaults: () => { const { id: _id, type: _type, ...defaults } = IrrigationValveNode.parse({}); return defaults },
  capabilities: {
    floorPlaced: { collides: false, footprint: raw => ({ dimensions: [0.3, 0.15, 0.12], rotation: (raw as unknown as IrrigationValveNode).rotation }) },
    selectable: { hitVolume: 'mesh' }, movable: { axes: ['x', 'z'], gridSnap: true }, rotatable: { axes: ['y'] }, duplicable: true, deletable: true,
  },
  ports: node => node.parentId && useScene.getState().nodes[node.parentId as never]?.type === 'level' ? irrigationValvePorts(node) : [],
  geometry: irrigationValveGeometry, floorplan,
  parametrics: { onDelete: (_node, nodes, pending) => clearDeletedValveAssignments(nodes, pending), onDeleteCascade: (node, nodes) => connectedIrrigationRunIds(node.id, nodes), groups: [{ label: 'Zone valve', fields: [
    { key: 'diameter', label: 'Nominal diameter (inches)', kind: 'number', min: 0.25, max: 4, step: 0.25 },
    { key: 'isOpen', label: 'Valve open', kind: 'boolean' },
  ] }] },
  presentation: { label: 'Irrigation valve', icon: { kind: 'iconify', name: 'lucide:circle-gauge' }, hidden: true },
}
