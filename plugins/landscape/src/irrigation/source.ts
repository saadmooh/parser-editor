import { createIrrigationHandleAffordance } from './editing'
import { irrigationMoveArrows } from './movement'
import { irrigationPlanSchedule } from '../editor/schedules'
import { irrigationSourceGeometry } from './equipment-models'
import { movedEquipmentPlan } from './network'
import { irrigationEquipmentMove } from './editing'
import { BaseNode, nodeType, objectId, useScene, type NodeDefinition, type NodePort } from '@pascal-app/core'
import { Euler, Vector3 } from 'three'
import { z } from 'zod'
import { connectedIrrigationRunIds } from './run'
export const IrrigationSourceNode = BaseNode.extend({
  id: objectId('irrigation-source'), type: nodeType('landscape:irrigation-source'),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).default([0, 0, 0]),
  rotation: z.tuple([z.literal(0), z.number().finite(), z.literal(0)]).default([0, 0, 0]),
  diameter: z.number().finite().min(0.25).max(4).default(0.75),
  pressureBar: z.number().finite().min(0).max(20).default(3),
  availableFlow: z.number().finite().min(0).max(1000).default(30),
  measurementStatus: z.enum(['assumed', 'measured']).default('assumed'),
  componentAllowanceBar: z.number().finite().min(0).max(5).default(.3),
  designFlowFraction: z.number().finite().min(.1).max(1).default(.8),
  backflowProvided: z.boolean().default(false),
  enabled: z.boolean().default(true),
})
export type IrrigationSourceNode = z.infer<typeof IrrigationSourceNode>
export function irrigationSourcePorts(node: IrrigationSourceNode): NodePort[] {
  const yaw = new Euler(...node.rotation)
  return [{ id: 'outlet', position: new Vector3(0.2, 0.1, 0).applyEuler(yaw).add(new Vector3(...node.position)).toArray() as [number, number, number], direction: new Vector3(1, 0, 0).applyEuler(yaw).toArray() as [number, number, number], diameter: node.diameter, system: 'irrigation' }]
}
export const irrigationSourceDefinition: NodeDefinition<typeof IrrigationSourceNode> = {
  kind: 'landscape:irrigation-source', schemaVersion: 1, schema: IrrigationSourceNode, category: 'utility', snapProfile: 'item', distributionRole: 'equipment',
  connectedMove: movedEquipmentPlan, floorplanMoveTarget: irrigationEquipmentMove,
  tool: () => import('./equipment-tool'),
  extensions: { 'pascal:editor/floorplan': { schedule: irrigationPlanSchedule, directDrag: true, tool: () => import('./equipment-floorplan-tool') } },
  floorplanAffordances: { 'irrigation-handle': createIrrigationHandleAffordance() },
  affordanceTools: { selection: () => import('./selection') },
  defaults: () => { const { id: _id, type: _type, ...rest } = IrrigationSourceNode.parse({}); return rest },
  capabilities: { selectable: { hitVolume: 'mesh' }, movable: { axes: ['x', 'z'], gridSnap: true }, rotatable: { axes: ['y'] }, duplicable: true, deletable: true,
    floorPlaced: { collides: false, footprint: raw => ({ dimensions: [0.4, 0.21, 0.2], rotation: (raw as unknown as IrrigationSourceNode).rotation }) } },
  ports: node => node.parentId && useScene.getState().nodes[node.parentId as never]?.type === 'level' ? irrigationSourcePorts(node) : [],
  geometry: irrigationSourceGeometry,
  floorplan: (node, ctx) => ({ kind: 'group', children: [
    ...(ctx.viewState?.selected ? irrigationMoveArrows(node) : []),
    { kind: 'circle', cx: node.position[0], cy: node.position[2], r: 0.15, fill: '#26354a', stroke: '#60a5fa', strokeWidth: 0.03 },
    { kind: 'text', x: node.position[0], y: node.position[2] + 0.35, text: `Supply · ${node.enabled ? `${node.pressureBar} bar` : 'Off'}`, upright: true, textAnchor: 'middle', fontSize: 0.16, fill: '#25354a', stroke: '#ffffff', strokeWidth: 0.04, paintOrder: 'stroke' },
  ] }),
  parametrics: { onDeleteCascade: (node, nodes) => connectedIrrigationRunIds(node.id, nodes), groups: [] },
  presentation: { label: 'Irrigation supply', icon: { kind: 'iconify', name: 'lucide:gauge' }, hidden: true },
}
