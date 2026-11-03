import { treePaintHints } from '../plant/editor/paint-hints'
import { treeControls } from './domain/species'
import { plantingSchedule } from '../editor/schedules'
import { buildTreeFloorplan } from '../editor/plant-floorplan'
import type { NodeDefinition } from '@pascal-app/core'
import { TreeNode, TREE_KIND } from './domain/schema'

export const treeDefinition: NodeDefinition<typeof TreeNode> = {
  kind: TREE_KIND,
  schemaVersion: 1,
  extensions: { 'pascal:editor/floorplan': { schedule: plantingSchedule, directDrag: true, tool: () => import('./editor/floorplan-tool') } },
  schema: TreeNode,
  category: 'furnish',
  snapProfile: 'item',
  surfaceRole: 'furnishing',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = TreeNode.parse({})
    return defaults
  },
  capabilities: {
    floorPlaced: {
      collides: false,
      footprint: (raw) => {
        const node = raw as unknown as TreeNode
        const value = node.controls.height ?? treeControls(node.species).height
        const height = typeof value === 'number' && Number.isFinite(value) ? Math.max(0.1, value) : 7
        return { dimensions: [0.3, height, 0.3], rotation: node.rotation }
      },
    },
    selectable: { hitVolume: 'bbox' },
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('./rendering/renderer') },
  floorplan: buildTreeFloorplan,
  preview: () => import('./rendering/preview'),
  tool: () => import('./editor/tool'),
  parametrics: { groups: [] },
  toolHints: treePaintHints,
  presentation: {
    label: 'Tree',
    description: 'Procedural trees with editable growth, material, and LOD controls.',
    icon: { kind: 'iconify', name: 'lucide:tree-deciduous' },
    paletteSection: 'furnish',
    hidden: true,
  },
}
