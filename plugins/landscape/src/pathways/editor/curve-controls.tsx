'use client'
import { acquireSceneHistoryPause, type AnyNode, type AnyNodeId, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { EDITOR_LAYER } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferGeometry, OrthographicCamera, Plane, Vector2, Vector3 } from 'three'
import { edgeCurve, evaluate } from '../domain/curves'
import { insertPathCurvePoint, isCurvedPathEdge, moveInsertedPathPoint, movePathCurveHandle,
  showPathEdgeControls, type CurveSide } from '../domain/edit-curve'
import type { PathGraph, PathwayNode, Point } from '../domain/schema'
import { buildOutline } from '../rendering/outline'
import { pathwayGradeField } from '../rendering/grade-mesh'
import { editHandleColors } from '../../shared/edit-handle-style'

function Guide({ from, to, fromHeight, toHeight }: { from: Point; to: Point; fromHeight: number; toHeight: number }) {
  const geometry = useMemo(() => new BufferGeometry().setFromPoints([
    new Vector3(from[0], fromHeight, from[1]), new Vector3(to[0], toHeight, to[1]),
  ]), [from, to, fromHeight, toHeight])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <lineSegments geometry={geometry} raycast={() => null} layers={EDITOR_LAYER} renderOrder={1010}>
    <lineBasicMaterial color={editHandleColors.tangent} depthTest={false} depthWrite={false} />
  </lineSegments>
}

function CurveGrip({ node, edgeId, side, point }: {
  node: PathwayNode; edgeId: string; side: CurveSide | 'insert'; point: Point
}) {
  const { camera, gl, raycaster } = useThree()
  const cleanup = useRef<(() => void) | null>(null)
  const scale = camera instanceof OrthographicCamera ? 1 / camera.zoom : 1
  const gradeAt = useMemo(() => pathwayGradeField(node), [node])
  const height = node.elevation + node.thickness + 0.24 + gradeAt(point[0], point[1])
  useEffect(() => () => cleanup.current?.(), [])

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || cleanup.current) return
    event.stopPropagation()
    const plane = new Plane(new Vector3(0, 1, 0), -height)
    const start = event.ray.intersectPlane(plane, new Vector3())
    if (!start) return
    const id = node.id as AnyNodeId
    const inserted = side === 'insert' ? insertPathCurvePoint(node, edgeId) : null
    let latest: PathGraph | null = inserted
    const pointer = new Vector2()
    const releaseHistory = useScene.temporal.getState().isTracking
      ? acquireSceneHistoryPause(useScene) : () => {}
    useViewer.getState().setInputDragging(true)
    document.body.style.cursor = 'grabbing'
    const clearPreview = () => {
      useLiveNodeOverrides.getState().clear(id)
      useScene.getState().markDirty(id)
    }
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key, true)
      cleanup.current = null
      document.body.style.cursor = ''
      useViewer.getState().setInputDragging(false)
      releaseHistory()
      if (commit && latest) useScene.getState().updateNode(id, latest as Partial<AnyNode>)
      clearPreview()
    }
    const move = (pointerEvent: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.set((pointerEvent.clientX - rect.left) / rect.width * 2 - 1,
        1 - (pointerEvent.clientY - rect.top) / rect.height * 2)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.ray.intersectPlane(plane, new Vector3())
      if (!hit) return
      const target: Point = [point[0] + hit.x - start.x, point[1] + hit.z - start.z]
      const graph = side === 'insert'
        ? inserted && moveInsertedPathPoint(inserted, inserted.vertices.at(-1)!.id, target)
        : movePathCurveHandle(node, edgeId, side, target)
      if (!graph) return
      try { buildOutline({ ...node, ...graph }) } catch { return }
      latest = graph
      useLiveNodeOverrides.getState().set(id, graph)
      useScene.getState().markDirty(id)
    }
    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.button !== 0) return
      finish(true)
      const swallow = (click: Event) => { click.preventDefault(); click.stopPropagation() }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 300)
    }
    const cancel = () => finish(false)
    const key = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' || ((keyboardEvent.metaKey || keyboardEvent.ctrlKey) && keyboardEvent.key.toLowerCase() === 'z')) {
        keyboardEvent.preventDefault(); keyboardEvent.stopImmediatePropagation(); cancel()
      }
    }
    cleanup.current = cancel
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key, true)
  }

  return <group layers={EDITOR_LAYER} position={[point[0], height, point[1]]}>
    <mesh raycast={() => null} renderOrder={1011}>
      <sphereGeometry args={[(side === 'insert' ? 0.11 : 0.09) * scale, 12, 8]} />
      <meshBasicMaterial color={side === 'insert' ? editHandleColors.insert : editHandleColors.tangent} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh visible={false} onPointerDown={onPointerDown}
      onPointerEnter={() => { if (!cleanup.current) document.body.style.cursor = 'grab' }}
      onPointerLeave={() => { if (!cleanup.current) document.body.style.cursor = '' }}>
      <boxGeometry args={[0.5 * scale, 0.18 * scale, 0.5 * scale]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>
}

export function PathwayCurveControls({ node }: { node: PathwayNode }) {
  const gradeAt = useMemo(() => pathwayGradeField(node), [node])
  const heightAt = (point: Point) => node.elevation + node.thickness + 0.24 + gradeAt(point[0], point[1])
  return <group>{node.edges.map((edge) => {
    if (!showPathEdgeControls(node, edge)) return null
    const curve = edgeCurve(node, edge)
    return <group key={edge.id}>
      <CurveGrip node={node} edgeId={edge.id} side="insert" point={evaluate(curve, 0.5)} />
      {isCurvedPathEdge(node, edge) && <>
        <Guide from={curve[0]} to={curve[1]} fromHeight={heightAt(curve[0])} toHeight={heightAt(curve[1])} />
        <Guide from={curve[3]} to={curve[2]} fromHeight={heightAt(curve[3])} toHeight={heightAt(curve[2])} />
        <CurveGrip node={node} edgeId={edge.id} side="from" point={curve[1]} />
        <CurveGrip node={node} edgeId={edge.id} side="to" point={curve[2]} />
      </>}
    </group>
  })}</group>
}
