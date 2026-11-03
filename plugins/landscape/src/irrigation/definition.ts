import { irrigationPlanSchedule } from '../editor/schedules'
import { movedEquipmentPlan } from './network'
import { irrigationEquipmentMove, createIrrigationHandleAffordance } from './editing'
import { useScene, type NodeDefinition } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { IrrigationHeadNode, IRRIGATION_HEAD_KIND } from './schema'
import { irrigationHeadFloorplan, irrigationHeadGeometry } from './geometry'
import { connectedIrrigationRunIds } from './run'

export const irrigationHeadDefinition: NodeDefinition<typeof IrrigationHeadNode> = {
  kind: IRRIGATION_HEAD_KIND, schemaVersion: 1, schema: IrrigationHeadNode,
  // Authored diagram materials must retain transparency and reach color;
  // the host surface-role fallback replaces every material with an opaque one.
  category: 'site', snapProfile: 'item',
  connectedMove: movedEquipmentPlan, floorplanMoveTarget: irrigationEquipmentMove,
  floorplanAffordances: { 'irrigation-handle': createIrrigationHandleAffordance() },
  affordanceTools: { selection: () => import('./selection') },
  defaults: () => { const { id: _id, type: _type, ...defaults } = IrrigationHeadNode.parse({}); return defaults },
  capabilities: {
    floorPlaced: { collides: false, footprint: (raw) => ({ dimensions: [0.12, 0.17, 0.12], rotation: (raw as unknown as IrrigationHeadNode).rotation }) },
    selectable: { hitVolume: 'mesh' }, movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] }, duplicable: true, deletable: true,
  },
  ports: (node) => node.parentId && useScene.getState().nodes[node.parentId as never]?.type === 'level' ? [{ id: 'inlet', position: node.position, direction: [0, -1, 0], diameter: node.inletDiameter, system: 'irrigation' }] : [],
  renderer: { kind: 'parametric', module: () => import('./renderer') },
  geometry: irrigationHeadGeometry, floorplan: irrigationHeadFloorplan,
  tool: () => import('./tool'),
  toolHints: [
    { key: 'Left click', label: 'Place irrigation head' },
    { key: 'Esc', label: 'Finish placement' },
    { key: 'C', label: 'Placement continuation', chip: {
      subscribe: (onChange) => useEditor.subscribe((state, previous) => {
        if (state.continuationByContext.point !== previous.continuationByContext.point) onChange()
      }),
      value: () => useEditor.getState().getContinuation('point'),
      labels: { once: 'Place one head', repeat: 'Repeat heads' },
      cycle: () => useEditor.getState().cycleContinuation('point'),
    } },
  ],
  extensions: { 'pascal:editor/floorplan': { schedule: irrigationPlanSchedule, directDrag: true, tool: () => import('./floorplan-tool') } },
  parametrics: { onDeleteCascade: (node, nodes) => connectedIrrigationRunIds(node.id, nodes), groups: [{ label: 'Irrigation head', fields: [
    { key: 'inletDiameter', label: 'Inlet diameter (inches)', kind: 'number', min: 0.25, max: 4, step: 0.25 },
    { key: 'radius', label: 'Reach radius', kind: 'number', unit: 'm', min: 0.1, max: 30, step: 0.1 },
    { key: 'arc', label: 'Arc (degrees)', kind: 'number', min: 1, max: 360, step: 1 },
    { key: 'flow', label: 'Authored flow (L/min)', kind: 'number', min: 0, max: 100, step: 0.1 },
    { key: 'showCoverage', label: 'Show plan coverage', kind: 'boolean' },
  ] }] },
  presentation: { label: 'Irrigation head', description: 'An irrigation outlet with authored reach and flow.',
    icon: { kind: 'iconify', name: 'lucide:droplets' }, paletteSection: 'site', hidden: true },
}
