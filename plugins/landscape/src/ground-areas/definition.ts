import { hardscapeSchedule } from '../editor/schedules'
import type { NodeDefinition } from '@pascal-app/core'
import { GROUND_AREA_KIND, GroundAreaNode } from './domain/schema'
import { buildGroundAreaFloorplan, buildGroundAreaLiveGeometry } from './rendering/geometry'
import { groundAreaFloorplanAffordances } from './editor/floorplan-affordances'
import { groundAreaDrawingModeHint } from './editor/drawing-mode'
import { groundAreaPaint } from './editor/paint'

export const groundAreaDefinition: NodeDefinition<typeof GroundAreaNode> = {
  kind: GROUND_AREA_KIND,
  schemaVersion: 1,
  extensions: { 'pascal:editor/floorplan': { schedule: hardscapeSchedule } },
  schema: GroundAreaNode,
  category: 'site',
  snapProfile: 'structural',
  snapDraftDirectional: false,
  surfaceRole: 'floor',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = GroundAreaNode.parse({})
    return defaults
  },
  capabilities: {
    selectable: { hitVolume: 'mesh' },
    paint: groundAreaPaint,
    deletable: true,
    duplicable: true,
  },
  geometry: buildGroundAreaLiveGeometry,
  system: { module: () => import('./rendering/footprint-system') },
  floorplan: buildGroundAreaFloorplan,
  floorplanAffordances: groundAreaFloorplanAffordances,
  floorplanDependencies: (node, nodes) => Object.values(nodes)
    .filter((candidate) => (candidate.id as string) !== node.id && candidate.parentId === node.parentId &&
      ((candidate.type as string) === GROUND_AREA_KIND || candidate.type === 'slab' ||
        ((candidate.type as string) === 'pool:pool' || (candidate.type as string) === 'landscape:pond')))
    .map((candidate) => candidate.id),
  tool: () => import('./editor/tool'),
  preview: () => import('./rendering/preview'),
  parametrics: {
    groups: [
      {
        label: 'Ground area',
        fields: [
          {
            key: 'surface',
            label: 'Surface',
            kind: 'enum',
            options: ['grass', 'soil', 'mulch', 'gravel', 'sand', 'mud'],
          },
          { key: 'elevation', label: 'Elevation', kind: 'number', unit: 'm', min: -100, max: 100, step: 0.1 },
        ],
      },
    ],
  },
  toolHints: [
    { key: 'Click', label: 'Set outline points, circle radius, or oval bounds' },
    { key: 'Drag', label: 'Draw a smooth freehand loop' },
    groundAreaDrawingModeHint,
    { key: 'Enter', label: 'Finish custom outline' },
    { key: 'Backspace', label: 'Undo outline point' },
    { key: 'Esc', label: 'Stop drawing' },
  ],
  presentation: {
    label: 'Ground area',
    description: 'A drawn ground surface such as grass, soil, gravel, sand, or mud.',
    icon: { kind: 'iconify', name: 'lucide:land-plot' },
    paletteSection: 'site',
    hidden: true,
  },
  mcp: {
    description: 'An editable polygon area on a level with a grass, soil, mulch, gravel, sand, or mud surface.',
  },
}
