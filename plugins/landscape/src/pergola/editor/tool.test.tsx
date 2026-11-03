import { expect, mock, test } from 'bun:test'
import type { AnyNode, AnyNodeDefinition } from '@pascal-app/core'
import type { WebGLRenderer } from 'three'
import * as THREE from 'three'

// R3F's CommonJS build requires Three synchronously; preload its ESM namespace.
mock.module('three', () => THREE)
const { createSceneApi, emitter, LevelNode, nodeRegistry, registerNode, sceneRegistry, useScene } = await import('@pascal-app/core')
const { useEditor, usePlacementPreview, useViewer } = await import('@pascal-app/editor')
const { _roots, act, createRoot } = await import('@react-three/fiber')
const { createElement } = await import('react')
const { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera } = THREE
const { RegistryToolProvider } = await import('../../../node_modules/@pascal-app/editor/src/components/tools/registry-tool-context')
const { deckDefinition } = await import('../../ground-access/deck/definition')
const { DeckNode } = await import('../../ground-access/deck/domain/schema')
const { patioDefinition } = await import('../../ground-access/patio/definition')
const { PatioNode } = await import('../../ground-access/patio/domain/schema')
const { landingDefinition } = await import('../../ground-access/landing/definition')
const { LandingNode } = await import('../../ground-access/landing/domain/schema')
const { pergolaSupportSurfaceTop, PERGOLA_SUPPORT_CLEARANCE } = await import('../domain/support-surface')
const { default: PergolaTool } = await import('./tool')

test.each([
  { label: 'deck', schema: DeckNode, definition: deckDefinition, levelY: 0, baseY: 0, yaw: 0 },
  { label: 'raised rotated deck', schema: DeckNode, definition: deckDefinition, levelY: 2, baseY: 0.4, yaw: Math.PI / 4 },
  { label: 'patio', schema: PatioNode, definition: patioDefinition, levelY: 0, baseY: 0.4, yaw: Math.PI / 4 },
  { label: 'landing', schema: LandingNode, definition: landingDefinition, levelY: 2, baseY: 0.4, yaw: 0 },
])('$label: pergola grid hover rides the top and matches commit', async ({ schema, definition, levelY, baseY, yaw }) => {
  const originalScene = useScene.getState()
  const originalViewer = useViewer.getState()
  const originalEditor = useEditor.getState()
  const restoreRegistry = nodeRegistry._snapshot()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const previousAct = actGlobal.IS_REACT_ACT_ENVIRONMENT
  actGlobal.IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() })
  const canvas = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }) as unknown as HTMLCanvasElement
  const root = createRoot(canvas)
  const camera = new PerspectiveCamera(60, 1, 0.1, 100)
  camera.position.set(0, 10 + levelY, 10)
  camera.lookAt(0, levelY, 0)
  camera.updateMatrixWorld()
  const level = LevelNode.parse({})
  const deck = schema.parse({ parentId: level.id, width: 6, depth: 6, thickness: 1, position: [0, baseY, 0], rotation: [0, yaw, 0] })
  const top = pergolaSupportSurfaceTop(deck, [0, 0])
  const geometryHeight = top - baseY - PERGOLA_SUPPORT_CLEARANCE
  const levelMesh = new Group()
  const deckMesh = new Mesh(new BoxGeometry(6, geometryHeight, 6), new MeshBasicMaterial())
  levelMesh.position.y = levelY
  deckMesh.position.y = baseY + geometryHeight / 2
  deckMesh.rotation.y = yaw
  levelMesh.add(deckMesh)
  levelMesh.updateMatrixWorld(true)
  try {
    registerNode(definition as unknown as AnyNodeDefinition)
    useScene.setState({ nodes: { [level.id]: level, [deck.id]: deck as unknown as AnyNode } })
    useViewer.setState({ selection: { buildingId: null, levelId: level.id, zoneId: null, selectedIds: [] } })
    useEditor.setState({ gridSnapStep: 0.25 })
    sceneRegistry.nodes.set(level.id, levelMesh)
    sceneRegistry.nodes.set(deck.id, deckMesh)
    sceneRegistry.byType[deck.type]!.add(deck.id)
    await root.configure({ gl: { domElement: canvas, render() {}, setSize() {}, setPixelRatio() {}, xr: { isPresenting: false } } as unknown as WebGLRenderer, camera, frameloop: 'never', dpr: 1, size: { width: 100, height: 100, top: 0, left: 0 } })
    await act(async () => root.render(createElement(RegistryToolProvider, {
      value: { activeLevelId: level.id, selectNode() {}, isCameraDragging: () => false, sceneApi: createSceneApi(useScene), unit: 'metric' },
      children: createElement(PergolaTool),
    })))
    // Native grid events hit y=0 even when the pointer ray crosses the deck at y=1.
    await act(async () => emitter.emit('grid:move', { position: [0, levelY, 0], localPosition: [0, levelY, 0], nativeEvent: { button: 0, stopPropagation() {} } } as never))
    const preview = usePlacementPreview.getState().node as AnyNode & { supportSurfaceId: string; position: number[] }
    expect(preview.supportSurfaceId).toBe(deck.id)
    expect(preview.position[1]).toBeCloseTo(top - baseY)
    const scene = _roots.get(canvas)!.store.getState().scene
    expect(scene.children[0]!.position.y).toBeCloseTo(levelY + top)
    await act(async () => emitter.emit('grid:move', { position: [8, levelY, 0], localPosition: [8, levelY, 0], nativeEvent: { button: 0 } } as never))
    expect((usePlacementPreview.getState().node as unknown as { supportSurfaceId: string | null }).supportSurfaceId).toBeNull()
    expect(scene.children[0]!.position.y).toBeCloseTo(levelY)
    await act(async () => emitter.emit('grid:move', { position: [0, levelY, 0], localPosition: [0, levelY, 0], nativeEvent: { button: 0 } } as never))
    await act(async () => emitter.emit('grid:click', { position: [0, levelY, 0], localPosition: [0, levelY, 0], nativeEvent: { button: 0, stopPropagation() {} } } as never))
    const placed = Object.values(useScene.getState().nodes).find(node => String(node.type) === 'landscape:pergola') as typeof preview
    expect(placed.supportSurfaceId).toBe(preview.supportSurfaceId)
    expect(placed.position).toEqual(preview.position)
  } finally {
    await act(async () => root.unmount())
    sceneRegistry.nodes.delete(level.id)
    sceneRegistry.nodes.delete(deck.id)
    sceneRegistry.byType[deck.type]!.delete(deck.id)
    deckMesh.geometry.dispose()
    deckMesh.material.dispose()
    restoreRegistry()
    useScene.setState(originalScene)
    useViewer.setState(originalViewer)
    useEditor.setState(originalEditor)
    actGlobal.IS_REACT_ACT_ENVIRONMENT = previousAct
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
