import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeDefinition, LevelNode, WallNode, nodeRegistry, registerNode, useScene } from '@pascal-app/core'
import { landscapePlugin } from './index'
import { createRetainingWallFinishSync } from './ground-access/retaining-wall/editor/finish-system'
import { RETAININGWALL_KIND } from './ground-access/retaining-wall/domain/schema'

test('every landscape item can be created, edited, and deleted with undo and redo', () => {
  const restoreRegistry = nodeRegistry._snapshot()
  const original = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true,
    value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true,
    value: () => {} })
  try {
    for (const definition of landscapePlugin.nodes ?? [])
      registerNode(definition as AnyNodeDefinition)
    for (const definition of landscapePlugin.nodes ?? []) {
      const level = LevelNode.parse({})
      useScene.getState().setScene({ [level.id]: level }, [level.id])
      temporal.clear()
      temporal.resume()
      const node = definition.schema.parse({ parentId: level.id }) as AnyNode
      useScene.getState().createNode(node, level.id)
      expect(useScene.getState().nodes[node.id]).toBeDefined()
      temporal.undo()
      expect(useScene.getState().nodes[node.id]).toBeUndefined()
      temporal.redo()
      expect(useScene.getState().nodes[node.id]).toBeDefined()

      useScene.getState().updateNode(node.id, { name: 'Edited landscape item' })
      temporal.undo()
      expect(useScene.getState().nodes[node.id]?.name).not.toBe('Edited landscape item')
      temporal.redo()
      expect(useScene.getState().nodes[node.id]?.name).toBe('Edited landscape item')

      useScene.getState().deleteNode(node.id)
      expect(useScene.getState().nodes[node.id]).toBeUndefined()
      temporal.undo()
      expect(useScene.getState().nodes[node.id]).toBeDefined()
      temporal.redo()
      expect(useScene.getState().nodes[node.id]).toBeUndefined()
    }
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds)
    temporal.clear()
    restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf)
    else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf)
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})

test('a retaining wall and its generated finish undo and redo together', async () => {
  const restoreRegistry = nodeRegistry._snapshot()
  const original = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  let unsubscribe = () => {}
  let dispose = () => {}
  try {
    for (const definition of landscapePlugin.nodes ?? []) registerNode(definition as AnyNodeDefinition)
    const level = LevelNode.parse({})
    useScene.getState().setScene({ [level.id]: level }, [level.id])
    temporal.clear()
    temporal.resume()
    const sync = createRetainingWallFinishSync()
    dispose = sync.dispose
    unsubscribe = useScene.subscribe((current, previous) => sync.schedule(previous))
    const wall = WallNode.parse({ parentId: level.id, start: [0, 0], end: [4, 0],
      metadata: { landscapeRetainingWall: true } })
    expect(useScene.temporal.getState().isTracking).toBe(true)
    useScene.getState().createNode(wall, level.id)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    await Promise.resolve()
    const finishes = () => Object.values(useScene.getState().nodes)
      .filter((node) => (node.type as string) === RETAININGWALL_KIND)
    expect(finishes()).toHaveLength(1)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    temporal.undo()
    await Promise.resolve()
    expect(useScene.getState().nodes[wall.id]).toBeUndefined()
    expect(finishes()).toHaveLength(0)
    temporal.redo()
    await Promise.resolve()
    expect(useScene.getState().nodes[wall.id]).toBeDefined()
    expect(finishes()).toHaveLength(1)
    useScene.getState().updateNode(wall.id, {
      metadata: { landscapeRetainingWall: false, roomBoundary: true },
    })
    await Promise.resolve()
    expect(finishes()).toHaveLength(0)
    expect(useScene.temporal.getState().pastStates).toHaveLength(2)
    temporal.undo()
    await Promise.resolve()
    expect(finishes()).toHaveLength(1)
    temporal.redo()
    await Promise.resolve()
    expect(finishes()).toHaveLength(0)
  } finally {
    unsubscribe()
    dispose()
    useScene.getState().setScene(original.nodes, original.rootNodeIds)
    temporal.clear()
    restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf)
    else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf)
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})
