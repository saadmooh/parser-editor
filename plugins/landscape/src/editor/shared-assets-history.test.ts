import { expect, test } from 'bun:test'
import { ItemNode, LevelNode, useScene } from '@pascal-app/core'
import { runUndo } from '@pascal-app/editor'

test('paused root-only asset transaction preserves preceding edit without mounted placement effects', async () => {
  const original = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  const level = LevelNode.parse({ name: 'Before placement' })
  try {
    useScene.getState().setScene({ [level.id]: level }, [level.id])
    temporal.clear(); temporal.resume()
    useScene.getState().updateNode(level.id, { name: 'Preceding edit' })
    const asset = { id: 'history-outdoor', category: 'outdoor', name: 'History outdoor asset',
      thumbnail: '/history-outdoor.png', src: '/history-outdoor.glb', dimensions: [1, 1, 1] as [number, number, number] }
    temporal.pause()
    // useDraftNode.create marks a root-only preview as transient, not a factory-owned isNew subtree.
    const draft = ItemNode.parse({ parentId: level.id, asset, metadata: { isTransient: true } })
    useScene.getState().createNode(draft, level.id)
    useScene.getState().deleteNode(draft.id)
    temporal.resume()
    const committed = ItemNode.parse({ parentId: level.id, asset })
    useScene.getState().applyNodeChanges({ create: [{ node: committed, parentId: level.id }] })
    temporal.pause(); temporal.resume()
    useScene.getState().updateNode(committed.id, { name: 'Unique asset edit' })
    runUndo(); await Promise.resolve()
    expect(useScene.getState().nodes[committed.id]?.name).toBe(committed.name)
    runUndo(); await Promise.resolve()
    expect(useScene.getState().nodes[committed.id]).toBeUndefined()
    expect(useScene.getState().nodes[level.id]?.name).toBe('Preceding edit')
    runUndo(); await Promise.resolve()
    expect(useScene.getState().nodes[committed.id]).toBeUndefined()
    expect(useScene.getState().nodes[level.id]?.name).toBe('Before placement')
  } finally {
    temporal.pause(); useScene.setState(original); temporal.clear(); temporal.resume()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf)
    else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf)
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})
