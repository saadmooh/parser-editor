import type { NodeDefinition } from '@pascal-app/core'
import { RetainingWallNode, RETAININGWALL_KIND } from './domain/schema'
import { buildRetainingWallGeometry, buildRetainingWallFloorplan } from './rendering/geometry'
import { retainingWallPaint } from './editor/paint'

export const retainingWallDefinition: NodeDefinition<typeof RetainingWallNode> = {
  kind: RETAININGWALL_KIND,
  schemaVersion: 1,
  schema: RetainingWallNode,
  category: 'site',
  snapProfile: 'item',
  surfaceRole: 'furnishing',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = RetainingWallNode.parse({})
    return defaults
  },
  capabilities: {
    selectable: { hitVolume: 'mesh' },
    paint: retainingWallPaint,
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    duplicable: true,
    deletable: true,
  },
  geometry: buildRetainingWallGeometry,
  system: { module: () => import('./editor/finish-system') },
  floorplan: buildRetainingWallFloorplan,
  tool: () => import('../shared/tool'),
  preview: () => import('../shared/preview'),
  parametrics: { groups: [{ label: 'Retaining wall', fields: [
    { key: 'width', label: 'Width', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
    { key: 'depth', label: 'Depth', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
    { key: 'thickness', label: 'Height', kind: 'number', unit: 'm', min: 0.03, max: 2, step: 0.01 },
    { key: 'style', label: 'Masonry', kind: 'enum', options: ['stacked-block', 'fieldstone', 'smooth'] },
    { key: 'courseHeight', label: 'Course height', kind: 'number', unit: 'm', min: 0.08, max: 0.6, step: 0.01 },
    { key: 'unitLength', label: 'Block length', kind: 'number', unit: 'm', min: 0.15, max: 1.5, step: 0.01 },
    { key: 'jointWidth', label: 'Joint width', kind: 'number', unit: 'm', min: 0.002, max: 0.05, step: 0.002 },
    { key: 'capEnabled', label: 'Cap', kind: 'boolean' },
    { key: 'capHeight', label: 'Cap height', kind: 'number', unit: 'm', min: 0.03, max: 0.2, step: 0.005 },
    { key: 'capOverhang', label: 'Cap overhang', kind: 'number', unit: 'm', min: 0, max: 0.15, step: 0.005 },
  ] }] },
  toolHints: [{ key: 'Click', label: 'Place retaining wall' }, { key: 'R / T', label: 'Rotate' }, { key: 'Esc', label: 'Cancel' }],
  presentation: { label: 'Retaining wall', description: 'A low straight retaining wall.', icon: { kind: 'iconify', name: 'lucide:brick-wall' }, paletteSection: 'site', hidden: true },
  mcp: { description: 'A low straight retaining wall. Width, depth, and height are editable.' },
}
