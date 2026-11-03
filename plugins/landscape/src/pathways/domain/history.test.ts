import { expect, test } from 'bun:test'
import {
  LevelNode,
  nodeRegistry,
  registerNode,
  useScene,
  type AnyNode,
  type AnyNodeDefinition,
  type AnyNodeId,
} from '@pascal-app/core'
import { pathwayDefinition } from '../definition'
import { lerp, type Curve } from './curves'
import { addCurves } from './network'
import { PathwayNode, type Point } from './schema'

test('one network update is one undo step, and redo restores junction IDs and curves', () => {
  const restoreRegistry = nodeRegistry._snapshot()
  const saved = useScene.getState()
  const temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  let frame: FrameRequestCallback | undefined
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback) => { frame = callback; return 1 } })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => { frame = undefined } })
  const line = (a: Point, b: Point): Curve => [
    a,
    lerp(a, b, 1 / 3),
    lerp(a, b, 2 / 3),
    b,
  ]
  try {
    registerNode(pathwayDefinition as unknown as AnyNodeDefinition)
    const level = LevelNode.parse({})
    useScene.getState().setScene({ [level.id]: level }, [level.id])
    const first = PathwayNode.parse({
      parentId: level.id,
      ...addCurves({ vertices: [], edges: [] }, [line([-4, 0], [4, 0])], 1),
    })
    useScene.getState().createNode(first as unknown as AnyNode, level.id)
    temporal.clear()
    const joined = {
      ...first,
      ...addCurves(first, [line([0, 4], [0, 0])], 1.5),
    }
    useScene
      .getState()
      .updateNode(first.id as AnyNodeId, joined as unknown as Partial<AnyNode>)
    frame?.(0)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    temporal.undo()
    expect(
      PathwayNode.parse(useScene.getState().nodes[first.id as AnyNodeId]),
    ).toEqual(first)
    temporal.redo()
    expect(
      PathwayNode.parse(useScene.getState().nodes[first.id as AnyNodeId]),
    ).toEqual(joined)
  } finally {
    useScene.getState().setScene(saved.nodes, saved.rootNodeIds)
    temporal.clear()
    restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf)
    else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf)
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})
