'use client'
import { acquireSceneHistoryPause, type AnyNode, type AnyNodeId, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { clearSlabSnapFeedback, EDITOR_LAYER, useWallSnapIndicator } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExtrudeGeometry, OrthographicCamera, Ray, Shape, Vector2, Vector3 } from 'three'
import { alignPathTerminalToEdge, pathTerminalEnds, movePathTerminal, type PathTerminal } from '../domain/terminals'
import type { PathwayNode, Point } from '../domain/schema'
import { buildOutline } from '../rendering/outline'
import { snapToHardscape } from '../../ground-access/shared/hardscape-snap'

function swallowNextClick() {
  const swallow = (event: Event) => {
    event.stopPropagation()
    event.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 300)
}

function arrowGeometry() {
  const shape = new Shape()
  shape.moveTo(0.22, 0)
  shape.lineTo(-0.04, 0.12)
  shape.lineTo(-0.04, 0.035)
  shape.lineTo(-0.2, 0.035)
  shape.lineTo(-0.2, -0.035)
  shape.lineTo(-0.04, -0.035)
  shape.lineTo(-0.04, -0.12)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true,
    bevelThickness: 0.018, bevelSize: 0.02, bevelSegments: 8 })
  geometry.translate(0, 0, -0.0225)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function axisParameter(origin: Vector3, direction: Vector3, ray: Ray) {
  const offset = new Vector3().subVectors(origin, ray.origin)
  const parallel = direction.dot(ray.direction)
  const alongAxis = direction.dot(offset)
  const alongRay = ray.direction.dot(offset)
  const denominator = 1 - parallel * parallel
  if (Math.abs(denominator) < 1e-6) return -alongAxis
  const parameter = (parallel * alongRay - alongAxis) / denominator
  return alongRay + parallel * parameter < 0 ? -alongAxis : parameter
}

function ExtensionArrow({ node, terminal }: { node: PathwayNode; terminal: PathTerminal }) {
  const [hovered, setHovered] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)
  const { camera, gl, raycaster } = useThree()
  const geometry = useMemo(arrowGeometry, [])
  const elevation = node.elevation + (node.vertices.find((vertex) => vertex.id === terminal.vertexId)?.elevationOffset ?? 0)
  const scale = (camera instanceof OrthographicCamera ? 1 / camera.zoom : 1) * 0.65
  useEffect(() => () => { cleanup.current?.(); geometry.dispose() }, [geometry])

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const id = node.id as AnyNodeId
    const origin = new Vector3(terminal.point[0], elevation, terminal.point[1])
    const direction = new Vector3(terminal.direction[0], 0, terminal.direction[1])
    const initial = axisParameter(origin, direction, event.ray)
    const pointer = new Vector2()
    let latest: Pick<PathwayNode, 'vertices' | 'edges'> | null = null
    useViewer.getState().setInputDragging(true)
    const releaseHistory = useScene.temporal.getState().isTracking
      ? acquireSceneHistoryPause(useScene) : () => {}
    document.body.style.cursor = 'ew-resize'
    const clearPreview = () => {
      useLiveNodeOverrides.getState().clear(id)
      useScene.getState().markDirty(id)
    }
    const removeListeners = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onCancel)
      document.body.style.cursor = ''
      useViewer.getState().setInputDragging(false)
      cleanup.current = null
    }
    const onMove = (moveEvent: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.set(((moveEvent.clientX - rect.left) / rect.width) * 2 - 1,
        -((moveEvent.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const distance = Math.max(-terminal.maxRetraction,
        axisParameter(origin, direction, raycaster.ray) - initial)
      const rawTarget: Point = [terminal.point[0] + distance * terminal.direction[0],
        terminal.point[1] + distance * terminal.direction[1]]
      const snap = node.parentId ? snapToHardscape(rawTarget, useScene.getState().nodes,
        node.parentId, node.id, Math.max(0.35, node.defaultWidth / 2 + 0.1)) : null
      if (snap) {
        clearSlabSnapFeedback()
        useWallSnapIndicator.getState().set({ x: snap.point[0], z: snap.point[1],
          kind: snap.kind === 'vertex' ? 'endpoint' : 'wall' })
      } else clearSlabSnapFeedback()
      const target = snap?.point ?? rawTarget
      let graph = movePathTerminal(node, terminal.vertexId, target)
      if (!graph) return
      if (snap?.edgeDirection) graph = alignPathTerminalToEdge(graph, terminal.vertexId, snap.edgeDirection)
      try { buildOutline({ ...node, ...graph }) } catch { return }
      latest = graph
      useLiveNodeOverrides.getState().set(id, graph)
      useScene.getState().markDirty(id)
    }
    const onUp = () => {
      releaseHistory()
      if (latest) useScene.getState().updateNode(id, latest as Partial<AnyNode>)
      clearSlabSnapFeedback()
      clearPreview()
      swallowNextClick()
      removeListeners()
    }
    const onCancel = () => {
      releaseHistory()
      clearSlabSnapFeedback()
      clearPreview()
      removeListeners()
    }
    cleanup.current = onCancel
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onCancel)
  }
  return <group layers={EDITOR_LAYER}
    position={[terminal.point[0] + terminal.direction[0] * 0.68,
      elevation + node.thickness + 0.16,
      terminal.point[1] + terminal.direction[1] * 0.68]}
    rotation={[0, -terminal.angle, 0]} scale={scale * (hovered ? 1.12 : 1)}>
    <mesh geometry={geometry} raycast={() => null} renderOrder={1010}>
      <meshBasicMaterial color={hovered ? '#a5b4fc' : '#8381ed'} depthTest={false} depthWrite={false} />
    </mesh>
    {/* Raycaster still hits an invisible Three mesh, while render/edge passes skip it. */}
    <mesh visible={false} onPointerDown={onPointerDown}
      onPointerEnter={() => { document.body.style.cursor = 'ew-resize'; setHovered(true) }}
      onPointerLeave={() => { if (!cleanup.current) document.body.style.cursor = ''; setHovered(false) }}>
      <boxGeometry args={[0.52, 0.12, 0.32]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>
}

export function PathwayExtensionControls({ node }: { node: PathwayNode }) {
  return pathTerminalEnds(node).map((terminal) =>
    <ExtensionArrow key={terminal.vertexId} node={node} terminal={terminal} />)
}
