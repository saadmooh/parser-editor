'use client'
import { landscapeToolColors } from '../../shared/tool-colors'
import { type AnyNode, type AnyNodeId, sceneRegistry, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { boundaryReshapeScope, EDITOR_LAYER, useInteractionScope } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { createPortal, type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, Matrix4, OrthographicCamera, Plane, Vector2, Vector3 } from 'three'
import { CURVE_ARM_SCALE, curveEditPatch, curveInLevel, displayedHandle, type CurveNode } from '../domain/curve-edit'
import { curveAt, editCurve, type CurveAction, type CurvePoint } from '../domain/freehand-curve'
import type { Point } from '../domain/schema'

function TangentLine({ points, height }: { points: Point[]; height: number }) {
  const geometry = useMemo(() => new BufferGeometry().setFromPoints(points.map(([x, z]) => new Vector3(x, height, z))), [points, height])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <lineSegments geometry={geometry} raycast={() => null} renderOrder={1010}>
    <lineBasicMaterial color="#8381ed" depthTest={false} depthWrite={false} />
  </lineSegments>
}

export function FreehandCurveEditor({ node, height }: { node: CurveNode; height: number }) {
  const { camera, gl, raycaster } = useThree()
  const fitted = useMemo(() => curveInLevel(node), [node])
  const [preview, setPreview] = useState<CurvePoint[] | null>(null)
  const cleanup = useRef<(() => void) | null>(null)
  const level = node.parentId ? sceneRegistry.nodes.get(node.parentId as AnyNodeId) : undefined
  const curve = preview ?? fitted
  const y = height + 0.08
  const radius = 0.10 * (camera instanceof OrthographicCamera ? 1 / camera.zoom : 1)
  useEffect(() => () => cleanup.current?.(), [node.id])

  const start = (event: ThreeEvent<PointerEvent>, index: number, action: CurveAction) => {
    if (event.button !== 0 || cleanup.current) return
    event.stopPropagation()
    const id = node.id as AnyNodeId
    level?.updateWorldMatrix(true, false)
    const matrix = level?.matrixWorld.clone() ?? new Matrix4()
    const inverse = matrix.clone().invert()
    const plane = new Plane().setFromNormalAndCoplanarPoint(new Vector3(0, 1, 0).transformDirection(matrix), new Vector3(0, y, 0).applyMatrix4(matrix))
    let next = action === 'insert' ? editCurve(fitted, index, action, curveAt(fitted, index, 0.5)) : fitted
    let patch = action === 'insert' ? curveEditPatch(node, next) : null
    const scope = useInteractionScope.getState()
    scope.begin(boundaryReshapeScope(id))
    useViewer.getState().setInputDragging(true)
    const publish = () => {
      if (!patch) return
      setPreview(next)
      useLiveNodeOverrides.getState().set(id, patch)
      useScene.getState().markDirty(id)
    }
    publish()
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key, true)
      cleanup.current = null
      useLiveNodeOverrides.getState().clear(id)
      setPreview(null)
      useViewer.getState().setInputDragging(false)
      scope.endIf((s) => s.kind === 'reshaping' && s.reshape === 'boundary' && s.nodeId === id)
      if (commit && patch) useScene.getState().updateNode(id, patch as Partial<AnyNode>)
      useScene.getState().markDirty(id)
    }
    const move = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), camera)
      const hit = raycaster.ray.intersectPlane(plane, new Vector3())?.applyMatrix4(inverse)
      if (!hit) return
      const anchor = fitted[index]!.anchor
      const target: Point = action === 'incoming' || action === 'outgoing'
        ? [anchor[0] + (hit.x - anchor[0]) / CURVE_ARM_SCALE, anchor[1] + (hit.z - anchor[1]) / CURVE_ARM_SCALE]
        : [hit.x, hit.z]
      const candidate = editCurve(fitted, index, action, target)
      const candidatePatch = curveEditPatch(node, candidate)
      if (!candidatePatch) return
      next = candidate; patch = candidatePatch; publish()
    }
    const up = (e: PointerEvent) => {
      if (e.button !== 0) return
      finish(true)
      const swallow = (click: MouseEvent) => { click.preventDefault(); click.stopPropagation() }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 300)
    }
    const cancel = () => finish(false)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) {
        e.preventDefault(); e.stopImmediatePropagation(); cancel()
      }
    }
    cleanup.current = cancel
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key, true)
  }
  const dot = (point: Point, index: number, action: CurveAction) => <mesh
    key={`${index}-${action}`} position={[point[0], y, point[1]]} renderOrder={1011}
    onPointerDown={(event: ThreeEvent<PointerEvent>) => start(event, index, action)}>
    <sphereGeometry args={[radius * (action === 'anchor' ? 1.25 : 0.8), 12, 8]} />
    <meshBasicMaterial color={action === 'insert' ? '#68c99b' : action === 'anchor' ? landscapeToolColors.spline : '#8381ed'} depthTest={false} depthWrite={false} />
  </mesh>
  const content = <group layers={EDITOR_LAYER}>{curve.map((point, index) => <group key={index}>
    <TangentLine points={[
      ...(node.closed !== false || index > 0 ? [displayedHandle(point, 'incoming'), point.anchor] : []),
      ...(node.closed !== false || index < curve.length - 1 ? [point.anchor, displayedHandle(point, 'outgoing')] : []),
    ]} height={y} />
    {(node.closed !== false || index > 0) && dot(displayedHandle(point, 'incoming'), index, 'incoming')}
    {(node.closed !== false || index < curve.length - 1) && dot(displayedHandle(point, 'outgoing'), index, 'outgoing')}
    {(node.closed !== false || index < curve.length - 1) && dot(curveAt(curve, index, 0.5), index, 'insert')}
    {dot(point.anchor, index, 'anchor')}
  </group>)}</group>
  return level ? createPortal(content, level) : content
}
