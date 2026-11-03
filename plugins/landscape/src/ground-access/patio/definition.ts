import { hardscapeSchedule } from '../../editor/schedules'
import type { HandleDescriptor, NodeDefinition } from '@pascal-app/core'
import { PatioNode, PATIO_KIND } from './domain/schema'
import { buildPatioGeometry, buildPatioFloorplan } from './rendering/geometry'
import { patioParametrics } from './editor/parametrics'
import { drawingModeHint } from '../shared/drawing-mode'
import { patioFloorplanAffordances } from './editor/floorplan-affordances'
import { circleSizePatch, surfaceLevelOutline } from '../shared/outline'
import { patioPaint } from './editor/paint'

const resize = (axis: 'x' | 'z', key: 'width' | 'depth'): HandleDescriptor<PatioNode> => ({
  kind: 'linear-resize', axis, anchor: 'center', min: 0.2, max: 30, gridSnap: true,
  currentValue: (node) => node[key],
  apply: (node, value) => circleSizePatch(node, { [key]: value }),
  placement: { position: (node) => axis === 'x'
    ? [node.width / 2 + 0.3, node.elevation + node.thickness + 0.12, 0]
    : [0, node.elevation + node.thickness + 0.12, node.depth / 2 + 0.3] },
})

export const patioDefinition: NodeDefinition<typeof PatioNode> = {
  kind: PATIO_KIND,
  schemaVersion: 1,
  extensions: { 'pascal:editor/floorplan': { schedule: hardscapeSchedule } },
  schema: PatioNode,
  category: 'site',
  snapProfile: 'item',
  surfaceRole: 'floor',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = PatioNode.parse({})
    return defaults
  },
  capabilities: {
    selectable: { hitVolume: 'mesh' },
    paint: patioPaint,
    surfaces: { top: { boundary: (raw) => surfaceLevelOutline(raw as unknown as PatioNode), height: (raw, context) => {
      const patio = raw as unknown as PatioNode
      const point = context.point
      const dx = point ? point[0] - patio.position[0] : 0
      const dz = point ? point[1] - patio.position[2] : 0
      const cos = Math.cos(patio.rotation[1]), sin = Math.sin(patio.rotation[1])
      const x = dx * cos - dz * sin, z = dx * sin + dz * cos
      const slope = patio.drainDirection === 'front' ? z : patio.drainDirection === 'back' ? -z
        : patio.drainDirection === 'left' ? x : patio.drainDirection === 'right' ? -x : 0
      return patio.elevation + patio.thickness + Math.min(0.045, patio.thickness / 3)
        + slope * patio.slopePercent / 100
    } } },
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    duplicable: true,
    deletable: true,
    snappable: {},
    alignmentFootprint: (raw) => {
      const node = raw as unknown as PatioNode
      return { shape: 'box', dimensions: [node.width, node.thickness, node.depth], rotation: node.rotation }
    },
  },
  geometry: buildPatioGeometry,
  system: { module: () => import('./editor/boundary-system') },
  floorplan: buildPatioFloorplan,
  floorplanDependencies: (node, nodes) => Object.values(nodes)
    .filter((candidate) => candidate.parentId === node.parentId && ((candidate.type as string) === 'pool:pool' || (candidate.type as string) === 'landscape:pond'))
    .map((candidate) => candidate.id),
  floorplanAffordances: patioFloorplanAffordances,
  tool: () => import('../shared/drawing-tool'),
  preview: () => import('../shared/preview'),
  parametrics: patioParametrics,
  handles: (node) => [
    resize('x', 'width'), resize('z', 'depth'),
    { kind: 'linear-resize', axis: 'y', anchor: 'min', min: 0.03, max: 2,
      currentValue: (n: PatioNode) => n.thickness,
      apply: (_n: PatioNode, value: number) => ({ thickness: value }),
      placement: { position: (n: PatioNode): [number, number, number] =>
        [0, n.elevation + n.thickness + 0.25, 0] } },
    { kind: 'linear-resize', axis: 'y', anchor: 'min', min: -2, max: 2,
      currentValue: (n: PatioNode) => n.elevation,
      apply: (_n: PatioNode, value: number) => ({ elevation: value }),
      placement: { position: (n: PatioNode): [number, number, number] =>
        [-n.width / 2 - 0.4, n.elevation + n.thickness + 0.2, 0] } },
    { kind: 'arc-resize', axis: 'angular', shape: 'rotate',
      apply: (n: PatioNode, delta: number) => ({ rotation: [0, n.rotation[1] - delta, 0] }),
      placement: { position: (n: PatioNode): [number, number, number] =>
        [n.width / 2 + 0.35, n.elevation + n.thickness + 0.1, n.depth / 2 + 0.35], rotationY: () => -Math.PI / 4 } },
  ],
  toolHints: [
    { key: 'Click / drag', label: 'Draw patio' },
    drawingModeHint(PATIO_KIND),
    { key: 'Enter', label: 'Finish outline' },
    { key: 'Esc', label: 'Cancel' },
  ],
  presentation: { label: 'Patio', description: 'Draw a rectangular, custom, freehand, circular, or oval paved patio with editable pattern, border, and drainage slope.', icon: { kind: 'iconify', name: 'lucide:layout-grid' }, paletteSection: 'site', hidden: true },
  mcp: { description: 'A rectangular, custom-outline, or freehand patio with concrete, stone, or brick pavers; grid or running bond pattern, joints, contrasting border, drainage slope, size and elevation settings.' },
}
