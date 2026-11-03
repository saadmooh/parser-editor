import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeDefinition, LevelNode, nodeRegistry, registerNode, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { landscapePlugin } from '../../index'
import { GROUND_SURFACES } from '../domain/schema'
import { curveInLevel, type CurveNode } from '../domain/curve-edit'
import { curveAt } from '../domain/freehand-curve'

test('every freehand surface and edging preserves curve controls through editing, save, undo and redo', () => {
  const restore = nodeRegistry._snapshot(), original = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    const definitions = (landscapePlugin.nodes ?? []) as AnyNodeDefinition[]
    definitions.forEach(registerNode)
    const variants = [
      ...GROUND_SURFACES.map(surface => ({ type: 'landscape:ground-area', surface })),
      ...['patio', 'deck', 'concrete-slab', 'landing', 'edging'].map(kind => ({ type: 'landscape:' + kind })),
    ]
    for (const variant of variants) {
      const definition = definitions.find(d => d.kind === variant.type)!
      expect(definition).toBeDefined()
      const level = LevelNode.parse({})
      const outline = Array.from({ length: 80 }, (_, i) => [0.45 * Math.cos(i * Math.PI / 40), 0.45 * Math.sin(i * Math.PI / 40)])
      const node = definition.schema.parse({ ...variant, parentId: level.id, shape: 'freehand',
        drawMode: 'freehand', outline, points: outline, closed: true }) as AnyNode
      useScene.getState().setScene({ [level.id]: level }, [level.id])
      useScene.getState().createNode(node, level.id)
      temporal.clear(); temporal.resume()
      const adapter = (raw: AnyNode) => ({ ...raw, outline: 'outline' in raw ? raw.outline : (raw as unknown as {points: number[][]}).points }) as CurveNode
      const before = curveInLevel(adapter(node))
      const handler = definition.floorplanAffordances?.['freehand-curve']
      expect(handler).toBeDefined()
      const start = (payload: unknown) => handler!.start({ node: useScene.getState().nodes[node.id]!,
        payload, nodes: useScene.getState().nodes, initialPlanPoint: curveAt(before, 0, 0.5), gridSnapStep: 0.1 })
      const insertion = start({ index: 0, action: 'insert' })
      expect(insertion.canCommit()).toBe(true)
      insertion.commit!()
      const inserted = useScene.getState().nodes[node.id]!
      const controls = curveInLevel(adapter(inserted))
      expect(controls).toHaveLength(before.length + 1)
      expect(useScene.temporal.getState().pastStates).toHaveLength(1)
      const saved = definition.schema.parse(JSON.parse(JSON.stringify(inserted))) as AnyNode
      expect(curveInLevel(adapter(saved))).toEqual(controls)
      temporal.undo()
      expect((useScene.getState().nodes[node.id] as unknown as CurveNode).curvePoints).toBeUndefined()
      temporal.redo()
      expect(curveInLevel(adapter(useScene.getState().nodes[node.id]!))).toEqual(controls)
      const drag = start({ index: 1, action: 'anchor' })
      const target: [number, number] = [controls[1]!.anchor[0] + 0.05, controls[1]!.anchor[1]]
      drag.apply({ planPoint: target, modifiers: { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false } })
      expect(useScene.temporal.getState().pastStates).toHaveLength(1)
      expect(useLiveNodeOverrides.getState().overrides.has(node.id)).toBe(true)
      expect(drag.canCommit()).toBe(true)
      drag.commit!()
      expect(useLiveNodeOverrides.getState().overrides.has(node.id)).toBe(false)
      expect(useScene.temporal.getState().pastStates).toHaveLength(2)
      temporal.undo()
      expect(curveInLevel(adapter(useScene.getState().nodes[node.id]!))).toEqual(controls)
    }
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds)
    temporal.clear()
    restore()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf)
    else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf)
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})
