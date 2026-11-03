import { PLANT_PRESET_BY_KEY } from './domain/catalog'
import { plantingSchedule } from '../editor/schedules'
import { buildPlantFloorplan } from '../editor/plant-floorplan'
import type { NodeDefinition } from '@pascal-app/core'
import { PLANT_KIND, PlantNode } from './domain/schema'
import { plantPaintHints } from './editor/paint-hints'

export const plantDefinition: NodeDefinition<typeof PlantNode> = {
  kind: PLANT_KIND,
  schemaVersion: 1,
  extensions: { 'pascal:editor/floorplan': { schedule: plantingSchedule, directDrag: true, tool: () => import('./editor/floorplan-tool') } },
  schema: PlantNode,
  category: 'furnish',
  snapProfile: 'item',
  surfaceRole: 'furnishing',
  defaults: () => { const { id: _id, type: _type, ...defaults } = PlantNode.parse({}); return defaults },
  capabilities: {
    floorPlaced: {
      collides: false,
      footprint: (raw) => {
        const node = raw as unknown as PlantNode
        const preset = PLANT_PRESET_BY_KEY[node.preset]
        const footprint = Math.max(0.1, Math.min(0.5, (preset?.spread ?? 1) * node.scale))
        return { dimensions: [footprint, (preset?.height ?? 1) * node.scale, footprint], rotation: node.rotation }
      },
    },
    selectable: { hitVolume: 'bbox' },
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    duplicable: true, deletable: true, groupable: true, snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('./rendering/renderer') },
  floorplan: buildPlantFloorplan,
  system: { module: () => import('./rendering/instance-system') },
  preview: () => import('./rendering/preview'),
  tool: () => import('./editor/tool'),
  parametrics: { groups: [] },
  toolHints: plantPaintHints,
  presentation: {
    label: 'Plant', description: 'Plant presets from the landscape reference catalog.',
    icon: { kind: 'iconify', name: 'lucide:sprout' }, paletteSection: 'furnish', hidden: true,
  },
}
