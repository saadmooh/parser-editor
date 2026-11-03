import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeId, type AnyNodeDefinition, heightAt, nodeRegistry, persistedTerrainFieldOf, registerNode, SiteNode, useScene } from '@pascal-app/core'
import { pondDefinition } from './definition'
import { PondNode } from './schema'
import { syncPondTerrain } from './terrain-sync'

test('derived excavation follows create, resize, delete, undo and redo without extra history steps', () => {
  const restoreRegistry = nodeRegistry._snapshot(), original = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    registerNode(pondDefinition as unknown as AnyNodeDefinition)
    const site = SiteNode.parse({}), pond = PondNode.parse({ parentId: site.id })
    useScene.getState().setScene({ [site.id]: site }, [site.id])
    temporal.clear(); temporal.resume()
    useScene.getState().createNodes([{ node: pond as unknown as AnyNode, parentId: site.id }])
    syncPondTerrain()
    const depth = () => heightAt(persistedTerrainFieldOf(SiteNode.parse(useScene.getState().nodes[site.id]))!, 0, 0)
    expect(depth()).toBeLessThan(-.7)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    useScene.getState().updateNode(pond.id as AnyNodeId, { basinDepth: 1.5 } as Partial<AnyNode>)
    syncPondTerrain()
    expect(depth()).toBeLessThan(-1.4)
    expect(useScene.temporal.getState().pastStates).toHaveLength(2)
    temporal.undo(); syncPondTerrain()
    expect(depth()).toBeGreaterThan(-1)
    temporal.redo(); syncPondTerrain()
    expect(depth()).toBeLessThan(-1.4)
    useScene.getState().deleteNode(pond.id as AnyNodeId); syncPondTerrain()
    expect(SiteNode.parse(useScene.getState().nodes[site.id]).terrain).toBeUndefined()
    temporal.undo(); syncPondTerrain()
    expect(depth()).toBeLessThan(-1.4)
    temporal.redo(); syncPondTerrain()
    expect(SiteNode.parse(useScene.getState().nodes[site.id]).terrain).toBeUndefined()
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds)
    temporal.clear(); restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})
