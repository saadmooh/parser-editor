import type { HandleDescriptor, NodeDefinition } from '@pascal-app/core'
import { POND_KIND, PondNode } from './schema'
import { pondTerrainBounds } from './terrain'
import { pondSiteDesign } from './site-terrain'
import { buildPondFloorplan } from './geometry'
import { circleDerivedSize, circleSizePatch } from '../ground-access/shared/outline'
import { surfaceFloorplanAffordances } from '../ground-access/shared/floorplan-affordances'
import { drawingModeHint } from '../ground-access/shared/drawing-mode'

const sizeHandle = (axis: 'x' | 'z', key: 'width' | 'depth'): HandleDescriptor<PondNode> => ({
  kind: 'linear-resize', axis, anchor: 'center', min: 0.2, max: 30, gridSnap: true,
  currentValue: node => node[key], apply: (node, value) => circleSizePatch(node, { [key]: value }),
  placement: { position: (node, scene) => {
    // Handles ride the pond root; use the same site-relative local elevation
    // as its water and rocks, rather than the authored floor-relative value.
    const { node: design } = pondSiteDesign(node, scene.nodes())
    const y = design.elevation + 0.2
    return axis === 'x' ? [node.width / 2 + node.bankWidth + 0.3, y, 0]
      : [0, y, node.depth / 2 + node.bankWidth + 0.3]
  } },
})
export const pondDefinition: NodeDefinition<typeof PondNode> = {
  kind: POND_KIND, schemaVersion: 1, schema: PondNode, category: 'site', snapProfile: 'item',
  defaults: () => { const { id: _id, type: _type, ...rest } = PondNode.parse({}); return rest },
  capabilities: { selectable: { hitVolume: 'mesh' }, movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] }, duplicable: true, deletable: true,
    alignmentFootprint: raw => { const node = raw as unknown as PondNode; const bounds = pondTerrainBounds(node); return { shape: 'box',
      dimensions: [bounds.maxX - bounds.minX, node.basinDepth * 1.12 + node.thickness, bounds.maxZ - bounds.minZ], rotation: node.rotation } } },
  // The animated renderer owns its geometry and resource lifetime. Declaring
  // geometry here also makes the host GeometrySystem add a second static pond.
  floorplan: buildPondFloorplan,
  renderer: { kind: 'parametric', module: () => import('./renderer') },
  system: { module: () => import('./system') },
  floorplanAffordances: surfaceFloorplanAffordances(POND_KIND),
  tool: () => import('../ground-access/shared/drawing-tool'),
  parametrics: { derive: (next, patch) => circleDerivedSize(next, patch), customPanel: () => import('./inspector'), groups: [] },
  handles: node => [sizeHandle('x', 'width'), ...(node.shape === 'circle' ? [] : [sizeHandle('z', 'depth')])],
  toolHints: [{ key: 'Click / drag', label: 'Draw pond' }, drawingModeHint(POND_KIND),
    { key: 'Enter', label: 'Finish outline' }, { key: 'Esc', label: 'Cancel' }],
  presentation: { label: 'Pond', description: 'An excavated natural pond with smooth shelves, clustered mossy rocks and depth-aware water.',
    icon: { kind: 'iconify', name: 'lucide:waves' }, paletteSection: 'site', hidden: true },
}
