import { hardscapeSchedule } from '../editor/schedules'
import type { NodeDefinition } from '@pascal-app/core'
import { PATHWAY_KIND, PathwayNode } from './domain/schema'
import { PathwayFinishControl } from './editor/finish-control'
import { PathwayWidthControl } from './editor/width-control'
import { PathwayBorderControl } from './editor/border-control'
import { PathwayEdgeControl } from './editor/edge-control'
import { StoneLayoutControl } from './editor/stone-layout-control'
import { NaturalStoneControl } from './editor/natural-stone-control'
import { buildPathwayFloorplan } from './rendering/floorplan'
import { buildPathwayGeometry } from './rendering/geometry'
import { derivePathwaySettings } from './domain/settings'
import { pathwayExtendEndpointAffordance, pathwayMoveJunctionAffordance,
  pathwayMoveCurveHandleAffordance, pathwayInsertPointAffordance } from './editor/extension-affordance'
import { pathwayDrawingModeHint } from './editor/drawing-mode'
import { PathwayJunctionModeControl } from './editor/junction-mode-control'
import { pathwayPaint } from './editor/paint'

export const pathwayDefinition: NodeDefinition<typeof PathwayNode> = {
  kind: PATHWAY_KIND,
  schemaVersion: 1,
  schema: PathwayNode,
  category: 'structure',
  extensions: {
    'pascal:editor/floorplan': {
      schedule: hardscapeSchedule,
      tool: () => import('./editor/floorplan-tool'),
      preferredView: '3d',
    },
  },
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = PathwayNode.parse({})
    return defaults
  },
  capabilities: { selectable: { hitVolume: 'mesh' }, paint: pathwayPaint, deletable: true },
  geometry: buildPathwayGeometry,
  system: { module: () => import('../shared/pool-cutout-system') },
  renderer: { kind: 'parametric', module: () => import('./rendering/renderer') },
  floorplan: buildPathwayFloorplan,
  floorplanDependencies: (node, nodes) => Object.values(nodes)
    .filter((candidate) => candidate.parentId === node.parentId && ((candidate.type as string) === 'pool:pool' || (candidate.type as string) === 'landscape:pond'))
    .map((candidate) => candidate.id),
  floorplanAffordances: {
    'pathway-extend-endpoint': pathwayExtendEndpointAffordance,
    'pathway-move-junction': pathwayMoveJunctionAffordance,
    'pathway-move-curve-handle': pathwayMoveCurveHandleAffordance,
    'pathway-insert-point': pathwayInsertPointAffordance,
  },
  parametrics: {
    derive: derivePathwaySettings,
    groups: [
      {
        label: 'Paving',
        fields: [
          { key: 'finish', label: 'Paving finish', kind: 'custom', component: PathwayFinishControl },
          { key: 'borderStyle', label: 'Path border', kind: 'custom', component: PathwayBorderControl },
          { key: 'stoneEdge', label: 'Edge profiles', kind: 'custom', component: PathwayEdgeControl },
          { key: 'stoneLength', label: 'Stone layout', kind: 'custom', component: StoneLayoutControl },
          { key: 'naturalStoneSize', label: 'Natural stone layout', kind: 'custom', component: NaturalStoneControl },
          { key: 'cornerStyle', label: 'Corners', kind: 'enum', options: ['round', 'square'], display: 'segmented' },
          { key: 'vertices', label: 'Curve junctions', kind: 'custom', component: PathwayJunctionModeControl },
          { key: 'showAllEditPoints', label: 'Show all edit points', kind: 'boolean' },
          { key: 'color', label: 'Color', kind: 'color' },
          { key: 'defaultWidth', label: 'Width', kind: 'custom', component: PathwayWidthControl },
          {
            key: 'thickness',
            label: 'Thickness',
            kind: 'number',
            unit: 'm',
            min: 0.02,
            max: 0.5,
            step: 0.01,
          },
          {
            key: 'elevation',
            label: 'Elevation',
            kind: 'number',
            unit: 'm',
            min: -100,
            max: 100,
            step: 0.1,
          },
        ],
      },
    ],
  },
  tool: () => import('./editor/tool'),
  preview: () => import('./rendering/preview'),
  toolHints: [
    { key: 'Left click', label: 'Add walkway or spline point' },
    pathwayDrawingModeHint,
    { key: 'Enter', label: 'Finish current walkway' },
    { key: 'Double click', label: 'Finish current walkway' },
    { key: 'Backspace', label: 'Undo draft point' },
    { key: 'L', label: 'Enter exact length' },
    { key: 'A', label: 'Enter exact bearing' },
    { key: 'Alt', label: 'Bypass snapping' },
    { key: 'Esc', label: 'Stop drawing' },
  ],
  presentation: {
    label: 'Walkways',
    description: 'Connected straight and curved pedestrian paths.',
    icon: { kind: 'iconify', name: 'lucide:route' },
    paletteSection: 'structure',
    hidden: true,
  },
}
