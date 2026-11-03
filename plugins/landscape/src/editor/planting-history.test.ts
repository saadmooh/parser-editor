import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeId, type AnyNodeDefinition, LevelNode, nodeRegistry, registerNode, useScene } from '@pascal-app/core'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { groundAreaDefinition } from '../ground-areas/definition'
import { plantDefinition } from '../plant/definition'
import { PlantNode } from '../plant/domain/schema'
import { savePlantingBatch } from './planting-batches'
import { areaPlanting } from './planting-layout'

test('a planting layout saves all plants in one undo step and restores provenance on redo', () => {
  const restoreRegistry = nodeRegistry._snapshot(), original = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    registerNode(plantDefinition as unknown as AnyNodeDefinition)
    registerNode(groundAreaDefinition as unknown as AnyNodeDefinition)
    const level = LevelNode.parse({})
    useScene.getState().setScene({ [level.id]: level }, [level.id])
    temporal.clear(); temporal.resume()
    const layout = areaPlanting([[0,0],[3,0],[3,3],[0,3]], { spacing: 1, setback: 0.2, seed: 1, natural: false, limit: 500 })
    const plants = layout.points.map(([x,z]) => PlantNode.parse({ parentId: level.id, preset: 'fab:daisy', position: [x,0,z], metadata: { landscapePlanting: { sourceId: 'ground-area:source', spacing: 1 } } }))
    useScene.getState().createNodes(plants.map((node) => ({ node: node as unknown as AnyNode, parentId: level.id })))
    expect(plants).toHaveLength(9)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    expect(LevelNode.parse(useScene.getState().nodes[level.id]).children).toHaveLength(9)
    temporal.undo()
    expect(Object.keys(useScene.getState().nodes)).toHaveLength(1)
    temporal.redo()
    expect(Object.keys(useScene.getState().nodes)).toHaveLength(10)
    expect(useScene.getState().nodes[plants[0]!.id as AnyNodeId]?.metadata?.landscapePlanting).toEqual({ sourceId: 'ground-area:source', spacing: 1 })
    const regenerated = savePlantingBatch(plants.slice(0, 4).map((plant) => PlantNode.parse({ ...plant, position: [2,0,2], preset: 'fab:poppy' })), plants as unknown as AnyNode[])
    expect(regenerated[0]!.id).toBe(plants[0]!.id)
    expect(LevelNode.parse(useScene.getState().nodes[level.id]).children).toHaveLength(4)
    expect(useScene.temporal.getState().pastStates).toHaveLength(2)
    temporal.undo()
    expect(LevelNode.parse(useScene.getState().nodes[level.id]).children).toHaveLength(9)
    expect(PlantNode.parse(useScene.getState().nodes[plants[0]!.id as AnyNodeId]).preset).toBe('fab:daisy')
    temporal.redo()
    expect(LevelNode.parse(useScene.getState().nodes[level.id]).children).toHaveLength(4)
    expect(PlantNode.parse(useScene.getState().nodes[plants[0]!.id as AnyNodeId]).preset).toBe('fab:poppy')

    const bed = GroundAreaNode.parse({ parentId: level.id, plantingBed: true, surface: 'mulch', outline: [[0,0],[3,0],[3,3],[0,3]] })
    useScene.getState().createNode(bed as unknown as AnyNode, level.id)
    temporal.clear()
    const settings = { batchId: 'bed-layout', sourceId: bed.id, plants: [{preset:'fab:daisy',weight:100}], spacing: 1, setback: .2, seed: 1, natural: false, side: 'both' as const }
    savePlantingBatch([], [], bed as unknown as AnyNode, settings)
    expect(useScene.getState().nodes[bed.id as AnyNodeId]?.metadata?.landscapePlanting).toEqual(settings)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    temporal.undo()
    expect(useScene.getState().nodes[bed.id as AnyNodeId]?.metadata?.landscapePlanting).toBeUndefined()
    temporal.redo()
    expect(useScene.getState().nodes[bed.id as AnyNodeId]?.metadata?.landscapePlanting).toEqual(settings)
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds)
    temporal.clear(); restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})
