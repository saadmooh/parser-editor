'use client'
import { FreehandCurveEditor } from '../../../ground-areas/editor/freehand-curve-editor'
import { edgingCurveNode } from '../domain/curve'
import { acquireSceneHistoryPause, type AnyNode, type AnyNodeId, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { EDITOR_LAYER, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, Line, LineBasicMaterial, ExtrudeGeometry, OrthographicCamera, Plane, Shape, Vector2, Vector3 } from 'three'
import { levelPoints, localPoints, type Point } from '../domain/route'
import { EdgingNode, EDGING_KIND, type EdgingNode as Edging } from '../domain/schema'
import { clearEdgingSnapFeedback, resolveEdgingSnap } from './snap'
import { edgingControlHandle, edgingCurveTangents } from '../domain/sampling'
import { edgingEditIndices, moveEdgingControls } from '../domain/edit'
import { edgingInsertPosition, insertEdgingPoint } from '../domain/insert-point'
import { editHandleColors } from '../../../shared/edit-handle-style'

function arrowGeometry() {
  const shape = new Shape()
  shape.moveTo(0.2, 0)
  shape.lineTo(-0.04, 0.12)
  shape.lineTo(-0.04, 0.035)
  shape.lineTo(-0.18, 0.035)
  shape.lineTo(-0.18, -0.035)
  shape.lineTo(-0.04, -0.035)
  shape.lineTo(-0.04, -0.12)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
  geometry.translate(0, 0, -0.02)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function swallowNextClick() {
  const swallow = (event: Event) => { event.preventDefault(); event.stopPropagation() }
  window.addEventListener('click', swallow, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 300)
}

function RouteControl({ node, index, endIndex, controls, edge, tangent = 0 }: {
  node: Edging; index: number; endIndex: number; controls: number[]; edge: boolean; tangent?: number
}) {
  const { camera, gl, raycaster } = useThree()
  const [hovered, setHovered] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)
  const geometry = useMemo(arrowGeometry, [])
  useEffect(() => () => { cleanup.current?.(); geometry.dispose() }, [geometry])
  const points = levelPoints(node)
  const a = points[index]!, b = points[endIndex]!
  const handle = edgingControlHandle(node, index)
  const handlePoint = levelPoints({ ...node, points: [[node.points[index]![0] + handle[0] * tangent * 3,
    node.points[index]![1] + handle[1] * tangent * 3]] })[0]!
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  const normal: Point = length > 1e-5 ? [-(b[1] - a[1]) / length, (b[0] - a[0]) / length] : [0, 1]
  const middleIndex = (index + Math.floor(((endIndex - index + points.length) % points.length) / 2)) % points.length
  const middle = node.drawMode === 'freehand' && middleIndex !== index ? points[middleIndex]!
    : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const x = tangent ? handlePoint[0] : edge ? middle[0]! + normal[0] * 0.38 : a[0]
  const z = tangent ? handlePoint[1] : edge ? middle[1]! + normal[1] * 0.38 : a[1]
  const height = node.profile === 'flush' ? Math.min(node.thickness, 0.035)
    : node.profile === 'low' ? Math.min(node.thickness, 0.12) : node.thickness
  const y = node.position[1] + height + 0.16
  const scale = (camera instanceof OrthographicCamera ? 1 / camera.zoom : 1) * 0.65

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const plane = new Plane(new Vector3(0, 1, 0), -y)
    const start = event.ray.intersectPlane(plane, new Vector3())
    if (!start) return
    const id = node.id as AnyNodeId
    const pointer = new Vector2()
    let latest: Point[] | null = null
    let latestTangents: Array<Point | null> | null = null
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
      clearEdgingSnapFeedback()
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
      const dx = hit.x - start.x, dz = hit.z - start.z
      if (tangent) {
        const local = localPoints(node, [[handlePoint[0] + dx, handlePoint[1] + dz]])[0]!
        latestTangents = node.points.map((_, i) => edgingCurveTangents(node)?.[i] ?? null)
        latestTangents[index] = [(local[0] - node.points[index]![0]) / (tangent * 3),
          (local[1] - node.points[index]![1]) / (tangent * 3)]
        useLiveNodeOverrides.getState().set(id, { tangents: latestTangents })
        useScene.getState().markDirty(id)
        return
      }
      const moves = new Map<number, Point>()
      if (edge) {
        const travel = dx * normal[0] + dz * normal[1]
        moves.set(index, [travel * normal[0], travel * normal[1]])
        moves.set(endIndex, [travel * normal[0], travel * normal[1]])
      } else {
        const raw: Point = [a[0] + dx, a[1] + dz]
        const snapped = resolveEdgingSnap(raw, raw, node.parentId, node.id)
        moves.set(index, [snapped[0] - a[0], snapped[1] - a[1]])
      }
      const next = moveEdgingControls(points, controls, node.closed, moves)
      const segments = controls.length - 1 + (node.closed ? 1 : 0)
      if (Array.from({ length: segments }, (_, segment) =>
        Math.hypot(next[controls[segment]!]![0] - next[controls[(segment + 1) % controls.length]!]![0],
          next[controls[segment]!]![1] - next[controls[(segment + 1) % controls.length]!]![1])).some((distance) => distance < 0.05)) return
      latest = localPoints(node, next)
      useLiveNodeOverrides.getState().set(id, { points: latest })
      useScene.getState().markDirty(id)
    }
    const onUp = () => {
      releaseHistory()
      if (latestTangents) useScene.getState().updateNode(id, { tangents: latestTangents } as Partial<AnyNode>)
      if (latest) useScene.getState().updateNode(id, { points: latest } as Partial<AnyNode>)
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

  return <group layers={EDITOR_LAYER} position={[x, y, z]}
    rotation={[0, edge ? -Math.atan2(normal[1], normal[0]) : 0, 0]}
    scale={scale * (hovered ? 1.12 : 1)}>
    <mesh geometry={edge ? geometry : undefined} raycast={() => null} renderOrder={1010}>
      {!edge && <sphereGeometry args={[tangent ? 0.11 : 0.18, 16, 12]} />}
      <meshBasicMaterial color={hovered ? editHandleColors.hover : tangent ? editHandleColors.tangent : editHandleColors.anchor} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh visible={false} onPointerDown={onPointerDown}
      onPointerEnter={() => { if (!cleanup.current) document.body.style.cursor = 'grab'; setHovered(true) }}
      onPointerLeave={() => { if (!cleanup.current) document.body.style.cursor = ''; setHovered(false) }}>
      <boxGeometry args={[0.52, 0.2, 0.52]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>
}

function TangentGuide({ node, index }: { node: Edging; index: number }) {
  const object = useMemo(() => {
    const point = node.points[index]!
    const handle = edgingControlHandle(node, index)
    const ends = levelPoints({ ...node, points: [-1, 1].map((side): Point =>
      [point[0] + handle[0] * side * 3, point[1] + handle[1] * side * 3]) })
    const height = node.profile === 'flush' ? Math.min(node.thickness, 0.035)
      : node.profile === 'low' ? Math.min(node.thickness, 0.12) : node.thickness
    const line = new Line(new BufferGeometry().setFromPoints(ends.map(([x, z]) =>
      new Vector3(x, node.position[1] + height + 0.16, z))),
      new LineBasicMaterial({ color: editHandleColors.tangent, depthTest: false, depthWrite: false }))
    line.layers.set(EDITOR_LAYER)
    line.renderOrder = 1009
    line.raycast = () => {}
    return line
  }, [node, index])
  useEffect(() => () => { object.geometry.dispose(); object.material.dispose() }, [object])
  return <primitive object={object} />
}

function InsertControl({ node, segment }: { node: Edging; segment: number }) {
  const { camera } = useThree()
  const point = edgingInsertPosition(node, segment)
  if (!point) return null
  const [x, z] = levelPoints({ ...node, points: [point] })[0]!
  const scale = (camera instanceof OrthographicCamera ? 1 / camera.zoom : 1)
  return <group layers={EDITOR_LAYER} position={[x, node.position[1] + node.thickness + 0.17, z]}>
    <mesh raycast={() => null} renderOrder={1011}>
      <sphereGeometry args={[0.11 * scale, 12, 8]} />
      <meshBasicMaterial color={editHandleColors.insert} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh visible={false} onPointerDown={(event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0) return
      event.stopPropagation()
      const patch = insertEdgingPoint(node, segment)
      if (!patch) return
      useScene.getState().updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
      swallowNextClick()
    }} onPointerEnter={() => { document.body.style.cursor = 'crosshair' }}
      onPointerLeave={() => { document.body.style.cursor = '' }}>
      <boxGeometry args={[0.5 * scale, 0.18 * scale, 0.5 * scale]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>
}

export default function EdgingRouteSystem() {
  const mode = useEditor((state) => state.mode)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const id = selectedIds.length === 1 ? selectedIds[0] : undefined
  const raw = useScene((state) => id ? state.nodes[id as AnyNodeId] : undefined)
  const overrides = useLiveNodeOverrides((state) => id ? state.overrides.get(id) : undefined)
  const node = (raw?.type as string | undefined) === EDGING_KIND && mode === 'select'
    ? EdgingNode.parse({ ...raw, ...overrides }) : null
  if (!node || node.points.length < 2) return null
  if (node.drawMode === 'freehand' || (node.drawMode === 'curve' && node.curvePoints)) return <FreehandCurveEditor
    node={edgingCurveNode(EdgingNode.parse(raw))}
    height={node.position[1] + node.thickness} />
  const controls = edgingEditIndices(node)
  const segments = controls.length - 1 + (node.closed ? 1 : 0)
  return <group>
    {Array.from({ length: segments }, (_, segment) =>
      <InsertControl key={`insert-${segment}`} node={node} segment={controls[segment]!} />)}
    {controls.map((index) => <RouteControl key={`point-${index}`} node={node} index={index}
      endIndex={index} controls={controls} edge={false} />)}
    {node.drawMode === 'curve' && controls.map((index) => <group key={`tangent-${index}`}>
      <TangentGuide node={node} index={index} />
      <RouteControl node={node} index={index} endIndex={index} controls={controls} edge={false} tangent={1} />
      <RouteControl node={node} index={index} endIndex={index} controls={controls} edge={false} tangent={-1} />
    </group>)}
    {node.drawMode !== 'curve' && Array.from({ length: segments }, (_, span) =>
      <RouteControl key={`edge-${controls[span]}`} node={node} index={controls[span]!}
        endIndex={controls[(span + 1) % controls.length]!} controls={controls} edge />)}
  </group>
}
