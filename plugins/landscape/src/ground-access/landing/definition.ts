import { surfaceLevelOutline } from '../shared/outline'
import { hardscapeSchedule } from '../../editor/schedules'
import type { NodeDefinition } from '@pascal-app/core'
import { LandingNode, LANDING_KIND } from './domain/schema'
import { buildLandingGeometry, buildLandingFloorplan } from './rendering/geometry'
import { drawingModeHint } from '../shared/drawing-mode'
import { surfaceFloorplanAffordances } from '../shared/floorplan-affordances'
import { surfaceHeightHandle } from '../shared/height-handle'
import { circleDerivedSize } from '../shared/outline'
import { landingPaint } from './editor/paint'

export const landingDefinition: NodeDefinition<typeof LandingNode> = {
  kind: LANDING_KIND,
  schemaVersion: 1,
  extensions: { 'pascal:editor/floorplan': { schedule: hardscapeSchedule } },
  schema: LandingNode,
  category: 'site',
  snapProfile: 'item',
  surfaceRole: 'floor',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = LandingNode.parse({})
    return defaults
  },
  capabilities: {
    selectable: { hitVolume: 'mesh' },
    surfaces: { top: { height: (raw) => (raw as unknown as LandingNode).thickness, boundary: (raw) => surfaceLevelOutline(raw as unknown as LandingNode) } },
    paint: landingPaint,
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    duplicable: true,
    deletable: true,
  },
  geometry: buildLandingGeometry,
  system: { module: () => import('./editor/boundary-system') },
  floorplan: buildLandingFloorplan,
  floorplanDependencies: (node, nodes) => Object.values(nodes)
    .filter((candidate) => candidate.parentId === node.parentId && ((candidate.type as string) === 'pool:pool' || (candidate.type as string) === 'landscape:pond'))
    .map((candidate) => candidate.id),
  floorplanAffordances: surfaceFloorplanAffordances(LANDING_KIND),
  tool: () => import('../shared/drawing-tool'),
  preview: () => import('../shared/preview'),
  parametrics: { derive: (next, patch) => circleDerivedSize(next, patch), customPanel: () => import('./editor/inspector'), groups: [{ label: 'Landing', fields: [
    { key: 'width', label: 'Width', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
    { key: 'depth', label: 'Depth', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
    { key: 'thickness', label: 'Thickness', kind: 'number', unit: 'm', min: 0.03, max: 2, step: 0.01 },
  ] }] },
  handles: [surfaceHeightHandle<LandingNode>()],
  toolHints: [{ key: 'Click / drag', label: 'Draw landing' }, drawingModeHint(LANDING_KIND),
    { key: 'Enter', label: 'Finish outline' }, { key: 'Esc', label: 'Cancel' }],
  presentation: { label: 'Landing', description: 'Draw a rectangular, custom, freehand, circular, or oval landing between routes or steps.', icon: { kind: 'iconify', name: 'lucide:square-dashed' }, paletteSection: 'site', hidden: true },
  mcp: { description: 'A landing with a rectangular, custom, freehand, circular, or oval outline. Width, depth, and height are editable.' },
}
