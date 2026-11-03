import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeDefinition, LevelNode, SiteNode, applyHeightPatch, createTerrainField, encodeTerrainField,
  flattenPatch, getFloorPlacedElevation, getFloorStackedPosition, nodeRegistry, registerNode, spatialGridManager } from '@pascal-app/core'
import { plantDefinition } from '../plant/definition'
import { treeDefinition } from '../tree/definition'
import { PlantNode } from '../plant/domain/schema'
import { TreeNode } from '../tree/domain/schema'
import { PathwayNode } from '../pathways/domain/schema'
import { pathPlanting } from './planting-layout'

test('trees and plants inherit terrain support without changing their stored elevation', () => {
  const restore = nodeRegistry._snapshot()
  spatialGridManager.clear()
  try {
    registerNode(plantDefinition as unknown as AnyNodeDefinition)
    registerNode(treeDefinition as unknown as AnyNodeDefinition)
    const field = createTerrainField({ cols: 17, rows: 17, spacing: 1, origin: [-8,-8] })
    const terrain = encodeTerrainField(applyHeightPatch(field, flattenPatch(field, { minX: 2, minZ: 2, maxX: 5, maxZ: 5 }, 2.5) as never))
    const site = SiteNode.parse({ terrain }), level = LevelNode.parse({ level: 0 }), upper = LevelNode.parse({ level: 1 })
    for (const schema of [PlantNode, TreeNode]) {
      const node = schema.parse({ parentId: level.id, position: [3,0.2,3] })
      const nodes = Object.fromEntries([site, level, upper, node].map((value) => [value.id, value])) as Record<string, AnyNode>
      expect(getFloorPlacedElevation({ node: node as unknown as AnyNode, nodes, position: node.position })).toBeCloseTo(2.5)
      expect(node.position[1]).toBe(0.2)
      expect(getFloorPlacedElevation({ node: { ...node, parentId: upper.id } as unknown as AnyNode, nodes, position: node.position })).toBe(0)
      expect(getFloorPlacedElevation({ node: node as unknown as AnyNode, nodes, position: [-3,0,-3] })).toBe(0)
    }
  } finally { restore(); spatialGridManager.clear() }
})

test('graded planting station offsets survive the public terrain stacking resolver', () => {
  const restore = nodeRegistry._snapshot()
  spatialGridManager.clear()
  try {
    registerNode(plantDefinition as unknown as AnyNodeDefinition)
    const field = createTerrainField({ cols: 17, rows: 17, spacing: 1, origin: [-8,-8] })
    const terrain = encodeTerrainField(applyHeightPatch(field, flattenPatch(field, { minX: -4, minZ: -4, maxX: 6, maxZ: 4 }, 2.5) as never))
    const site = SiteNode.parse({ terrain }), level = LevelNode.parse({ level: 0 })
    const path = PathwayNode.parse({ elevation: 0.2, vertices: [{ id: 'a', point: [0,0] }, { id: 'b', point: [4,0], elevationOffset: 2 }], edges: [{ id:'e', from:'a', to:'b', width: 1 }] })
    const layout = pathPlanting(path, { spacing: 1, setback: 0.5, seed: 1, natural: false, limit: 500 }, 'both')
    layout.points.forEach(([x,z], index) => {
      const node = PlantNode.parse({ parentId: level.id, position: [x, path.elevation + layout.elevationOffsets![index]!, z] })
      const nodes = Object.fromEntries([site, level, node].map((value) => [value.id, value])) as Record<string, AnyNode>
      const visual = getFloorStackedPosition({ node: node as unknown as AnyNode, nodes, position: node.position })
      expect(visual[1]).toBeCloseTo(2.5 + 0.2 + x * 0.5)
      expect(node.position[1]).toBeCloseTo(0.2 + x * 0.5)
    })
  } finally { restore(); spatialGridManager.clear() }
})
