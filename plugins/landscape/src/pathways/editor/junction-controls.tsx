'use client'
import { acquireSceneHistoryPause, type AnyNode, type AnyNodeId, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { EDITOR_LAYER } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { OrthographicCamera, Plane, Vector2, Vector3 } from 'three'
import { movePathJunction } from '../domain/terminals'
import type { PathVertex, PathwayNode, Point } from '../domain/schema'
import { buildOutline } from '../rendering/outline'
import { editHandleColors } from '../../shared/edit-handle-style'
import { visiblePathVertices } from '../domain/edit-curve'

function swallowNextClick() {
  const swallow = (event: Event) => { event.stopPropagation(); event.preventDefault() }
  window.addEventListener('click', swallow, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 300)
}

function JunctionGrip({ node, vertex }: { node: PathwayNode; vertex: PathVertex }) {
  const { camera, gl, raycaster } = useThree()
  const [hovered, setHovered] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)
  const scale = (camera instanceof OrthographicCamera ? 1 / camera.zoom : 1) * 0.65
  useEffect(() => () => cleanup.current?.(), [])

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const id = node.id as AnyNodeId
    const plane = new Plane(new Vector3(0, 1, 0), -(node.elevation + (vertex.elevationOffset ?? 0) + node.thickness))
    const start = event.ray.intersectPlane(plane, new Vector3())
    if (!start) return
    const pointer = new Vector2()
    let latest: Pick<PathwayNode, 'vertices' | 'edges'> | null = null
    useViewer.getState().setInputDragging(true)
    const releaseHistory = useScene.temporal.getState().isTracking
      ? acquireSceneHistoryPause(useScene) : () => {}
    document.body.style.cursor = 'grabbing'
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
      const hit = raycaster.ray.intersectPlane(plane, new Vector3())
      if (!hit) return
      const point: Point = [vertex.point[0] + hit.x - start.x,
        vertex.point[1] + hit.z - start.z]
      const graph = movePathJunction(node, vertex.id, point)
      if (!graph) return
      try { buildOutline({ ...node, ...graph }) } catch { return }
      latest = graph
      useLiveNodeOverrides.getState().set(id, graph)
      useScene.getState().markDirty(id)
    }
    const onUp = () => {
      releaseHistory()
      if (latest) useScene.getState().updateNode(id, latest as Partial<AnyNode>)
      clearPreview()
      swallowNextClick()
      removeListeners()
    }
    const onCancel = () => {
      releaseHistory()
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
    position={[vertex.point[0], node.elevation + (vertex.elevationOffset ?? 0) + node.thickness + 0.22, vertex.point[1]]}
    scale={scale * (hovered ? 1.12 : 1)}>
    <mesh raycast={() => null} renderOrder={1010}>
      <sphereGeometry args={[0.2, 16, 12]} />
      <meshBasicMaterial color={hovered ? editHandleColors.hover : editHandleColors.anchor} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh visible={false} onPointerDown={onPointerDown}
      onPointerEnter={() => { if (!cleanup.current) document.body.style.cursor = 'grab'; setHovered(true) }}
      onPointerLeave={() => { if (!cleanup.current) document.body.style.cursor = ''; setHovered(false) }}>
      <boxGeometry args={[0.55, 0.16, 0.55]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>
}

export function PathwayJunctionControls({ node }: { node: PathwayNode }) {
  return visiblePathVertices(node).map((vertex) => <JunctionGrip key={vertex.id} node={node} vertex={vertex} />)
}
