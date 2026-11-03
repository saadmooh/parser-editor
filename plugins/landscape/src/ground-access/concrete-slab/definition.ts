import { surfaceLevelOutline } from '../shared/outline'
import { hardscapeSchedule } from '../../editor/schedules'
import type { NodeDefinition } from '@pascal-app/core'
import { ConcreteSlabNode, CONCRETESLAB_KIND } from './domain/schema'
import { buildConcreteSlabGeometry, buildConcreteSlabFloorplan } from './rendering/geometry'
import { drawingModeHint } from '../shared/drawing-mode'
import { surfaceFloorplanAffordances } from '../shared/floorplan-affordances'
import { surfaceHeightHandle } from '../shared/height-handle'
import { circleDerivedSize } from '../shared/outline'
import { concreteSlabPaint } from './editor/paint'

export const concreteSlabDefinition: NodeDefinition<typeof ConcreteSlabNode> = {
  kind: CONCRETESLAB_KIND,
  schemaVersion: 1,
  extensions: { 'pascal:editor/floorplan': { schedule: hardscapeSchedule } },
  schema: ConcreteSlabNode,
  category: 'site',
  snapProfile: 'item',
  surfaceRole: 'floor',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = ConcreteSlabNode.parse({})
    return defaults
  },
  capabilities: {
    selectable: { hitVolume: 'mesh' },
    paint: concreteSlabPaint,
    surfaces: { top: { height: (raw) => (raw as unknown as ConcreteSlabNode).thickness, boundary: (raw) => surfaceLevelOutline(raw as unknown as ConcreteSlabNode) } },
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    duplicable: true,
    deletable: true,
  },
  geometry: buildConcreteSlabGeometry,
  system: { module: () => import('./editor/boundary-system') },
  floorplan: buildConcreteSlabFloorplan,
  floorplanDependencies: (node, nodes) => Object.values(nodes)
    .filter((candidate) => candidate.parentId === node.parentId && ((candidate.type as string) === 'pool:pool' || (candidate.type as string) === 'landscape:pond'))
    .map((candidate) => candidate.id),
  floorplanAffordances: surfaceFloorplanAffordances(CONCRETESLAB_KIND),
  tool: () => import('../shared/drawing-tool'),
  preview: () => import('../shared/preview'),
  parametrics: { derive: (next, patch) => circleDerivedSize(next, patch), customPanel: () => import('./editor/inspector'), groups: [{ label: 'Concrete slab', fields: [
    { key: 'width', label: 'Width', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
    { key: 'depth', label: 'Depth', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
    { key: 'thickness', label: 'Thickness', kind: 'number', unit: 'm', min: 0.03, max: 2, step: 0.01 },
  ] }] },
  handles: [surfaceHeightHandle<ConcreteSlabNode>()],
  toolHints: [{ key: 'Click / drag', label: 'Draw concrete slab' }, drawingModeHint(CONCRETESLAB_KIND),
    { key: 'Enter', label: 'Finish outline' }, { key: 'Esc', label: 'Cancel' }],
  presentation: { label: 'Concrete slab', description: 'Draw a rectangular, custom, freehand, circular, or oval concrete slab.', icon: { kind: 'iconify', name: 'lucide:square' }, paletteSection: 'site', hidden: true },
  mcp: { description: 'A solid concrete slab with a rectangular, custom, freehand, circular, or oval outline. Width, depth, and height are editable.' },
}
