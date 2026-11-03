import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeDefinition, LevelNode, nodeRegistry, registerNode, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { landscapePlugin } from '../../index'
import { DeckNode } from '../../ground-access/deck/domain/schema'
import { PergolaNode } from '../domain/schema'
import { pergolaFloorplanMoveTarget } from './floorplan-move'

test('floorplan drag previews only the child, commits detachment, and restores hosting on undo', () => {
  const restoreRegistry = nodeRegistry._snapshot()
  const original = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    for (const definition of landscapePlugin.nodes ?? []) registerNode(definition as AnyNodeDefinition)
    const level = LevelNode.parse({})
    const deck = DeckNode.parse({ parentId: level.id, position: [10, 0, 20],
      rotation: [0, Math.PI / 2, 0], width: 6, depth: 6 })
    const pergola = PergolaNode.parse({ parentId: deck.id, supportSurfaceId: deck.id,
      position: [0, deck.thickness + 0.01, 0], rotation: [0, 0.3, 0] })
    const id = (pergola as unknown as AnyNode).id
    useScene.getState().setScene({ [level.id]: level }, [level.id])
    useScene.getState().createNode(deck as unknown as AnyNode, level.id)
    useScene.getState().createNode(pergola as unknown as AnyNode, deck.id as AnyNode['id'])
    temporal.clear()
    temporal.resume()
    const session = pergolaFloorplanMoveTarget({ node: pergola, nodes: useScene.getState().nodes })
    const modifiers = { altKey: true, shiftKey: false, ctrlKey: false, metaKey: false }
    session.apply({ planPoint: [11, 19], modifiers })
    const preview = useLiveNodeOverrides.getState().overrides.get(id) as Partial<PergolaNode>
    expect(preview.position![0]).toBeCloseTo(1)
    expect(preview.position![2]).toBeCloseTo(1)
    expect<unknown>(useScene.getState().nodes[id]).toEqual(pergola)
    session.apply({ planPoint: [11, 15], modifiers })
    expect(session.canCommit()).toBe(true)
    session.commit!()
    const detached = useScene.getState().nodes[id] as unknown as PergolaNode
    expect(detached.parentId).toBe(level.id)
    expect(detached.supportSurfaceId).toBeNull()
    expect(detached.position[0]).toBeCloseTo(11)
    expect(detached.position[2]).toBeCloseTo(15)
    expect(detached.rotation[1]).toBeCloseTo(Math.PI / 2 + 0.3)
    expect<unknown>(useScene.getState().nodes[deck.id as AnyNode['id']]).toEqual(deck)
    temporal.undo()
    expect<unknown>(useScene.getState().nodes[id]).toEqual(pergola)
    temporal.redo()
    expect<unknown>(useScene.getState().nodes[id]).toEqual(detached)
    expect(useLiveNodeOverrides.getState().overrides.has(id)).toBe(false)
  } finally {
    useLiveNodeOverrides.getState().clearAll()
    useScene.getState().setScene(original.nodes, original.rootNodeIds)
    temporal.clear()
    restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf)
    else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf)
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})
