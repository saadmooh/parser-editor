import type { HandleDescriptor, NodeDefinition } from '@pascal-app/core'
import { DEFAULT_ROOF_RISE, PergolaNode, PERGOLA_KIND } from './domain/schema'
import { pergolaDimensions, pergolaPostPositions } from './domain/layout'
import { pergolaParametrics } from './editor/parametrics'
import { pergolaPaint } from './editor/paint'
import { pergolaParentFrame } from './editor/parent-frame'
import { pergolaFloorplanMoveTarget } from './editor/floorplan-move'
import { buildPergolaFloorplan } from './rendering/floorplan'
import { buildPergolaGeometry } from './rendering/geometry'

const sizeHandle = (
  axis: 'x' | 'z',
  key: 'width' | 'depth',
  min: number,
  max: number,
): HandleDescriptor<PergolaNode> => ({
  kind: 'linear-resize',
  axis,
  anchor: 'center',
  min,
  max,
  currentValue: (n) => n[key],
  apply: (_n, value) => ({ [key]: value }),
  placement: {
    position: (n) =>
      axis === 'x'
        ? [n.width / 2 + 0.35, n.height / 2, 0]
        : [0, n.height / 2, n.depth / 2 + 0.35],
  },
})
const sideHeightHandle = (
  side: 'front' | 'back',
): HandleDescriptor<PergolaNode> => ({
  kind: 'linear-resize',
  axis: 'y',
  anchor: 'min',
  min: 1.8,
  max: 4,
  currentValue: (n) =>
    side === 'front' ? n.height : (n.backHeight ?? n.height),
  apply: (_n, value) =>
    side === 'front' ? { height: value } : { backHeight: value },
  placement: {
    position: (n) => [
      0,
      (side === 'front' ? n.height : (n.backHeight ?? n.height)) +
        n.beamHeight +
        0.28,
      side === 'front'
        ? pergolaPostPositions(n).frontZ
        : pergolaPostPositions(n).backZ,
    ],
  },
})
export const pergolaDefinition: NodeDefinition<typeof PergolaNode> = {
  kind: PERGOLA_KIND,
  schemaVersion: 1,
  schema: PergolaNode,
  category: 'furnish',
  snapProfile: 'item',
  surfaceRole: 'furnishing',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = PergolaNode.parse({})
    return { ...defaults, roofLayout: 'slatted' as const }
  },
  capabilities: {
    selectable: { hitVolume: 'bbox' },
    paint: pergolaPaint,
    movable: { axes: ['x', 'z'], gridSnap: true, parentFrame: pergolaParentFrame },
    rotatable: {
      axes: ['y'],
      snapAngles: Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4),
    },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
    floorPlaced: {
      applies: (raw) => !(raw as unknown as PergolaNode).supportSurfaceId,
      footprint: (raw) => {
        const n = raw as unknown as PergolaNode
        return { dimensions: pergolaDimensions(n), rotation: n.rotation }
      },
      collides: false,
    },
  },
  geometry: buildPergolaGeometry,
  system: { module: () => import('./editor/support-surface-system') },
  floorplan: buildPergolaFloorplan,
  floorplanMoveTarget: pergolaFloorplanMoveTarget,
  parametrics: pergolaParametrics,
  handles: (n) => [
    sizeHandle('x', 'width', 1.5, 10),
    sizeHandle('z', 'depth', 1.5, 8),
    sideHeightHandle('front'),
    ...(n.roofForm === 'single-slope' ? [sideHeightHandle('back')] : []),
    ...((n.roofForm === 'gable' || n.roofForm === 'curved') ? [{
      kind: 'linear-resize' as const,
      axis: 'y' as const,
      anchor: 'min' as const,
      min: 0.2,
      max: 1.5,
      currentValue: (node: PergolaNode) => node.roofRise ?? DEFAULT_ROOF_RISE,
      apply: (_node: PergolaNode, value: number) => ({ roofRise: value }),
      placement: { position: (node: PergolaNode): [number, number, number] =>
        [0, node.height + node.beamHeight + (node.roofRise ?? DEFAULT_ROOF_RISE) + 0.28, 0] },
    }] : []),
    {
      kind: 'arc-resize',
      axis: 'angular',
      shape: 'rotate',
      apply: (n, delta) => ({ rotation: [0, n.rotation[1] - delta, 0] }),
      placement: {
        position: (n) => [n.width / 2 + 0.4, 0.15, n.depth / 2 + 0.4],
        rotationY: () => -Math.PI / 4,
      },
    },
  ],
  preview: () => import('./rendering/preview'),
  tool: () => import('./editor/tool'),
  toolHints: [
    { key: 'Left click', label: 'Place pergola' },
    { key: 'R / T', label: 'Rotate' },
    { key: 'Esc', label: 'Cancel' },
  ],
  presentation: {
    label: 'Pergola',
    description:
      'A freestanding pergola with open rafters, cross slats, and knee braces.',
    icon: { kind: 'iconify', name: 'lucide:columns-3' },
    paletteSection: 'furnish',
    hidden: true,
  },
  mcp: {
    description:
      'A rectangular freestanding pergola with flat, single-slope, gable, or curved roof form; adjustable width, depth, height, posts, beams, rafters, optional cross slats, knee braces, and full-width arches. Apply finishes with the editor paint tool.',
  },
}
