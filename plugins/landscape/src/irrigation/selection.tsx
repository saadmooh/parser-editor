'use client'
import { type AnyNode, type AnyNodeId, sceneRegistry, useScene, useLiveNodeOverrides } from '@pascal-app/core'
import { ARROW_SCALE, HandleArrow, isGridSnapActive, useEditor, swallowNextClick, useViewer } from '@pascal-app/editor'
import { useThree, type ThreeEvent, createPortal } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { type Object3D, OrthographicCamera, Plane, Vector2, Vector3 } from 'three'
import { IrrigationHeadNode } from './schema'
import { commitIrrigationEdit, planHandleEdit, clearEditPreview, irrigationEditIds, type HandlePayload, type EditBatch } from './editing'
import { irrigationMoveOrigin } from './movement'
import type { Point } from './ports'

export default function IrrigationSelection() {
  const ids = useViewer(s => s.selection.selectedIds), nodes = useScene(s => s.nodes), readOnly = useScene(s => s.readOnly)
  const node = ids.length === 1 ? nodes[ids[0] as AnyNodeId] : null
  return !readOnly && node ? <Handles key={node.id} node={node} /> : null
}
function Arrow({ position, yaw = 0, vertical, tracker, active, onDown }: { position: Point; yaw?: number; vertical?: boolean; tracker?: boolean; active?: boolean; onDown: (event: ThreeEvent<PointerEvent>) => void }) {
  const [hover, setHover] = useState(false), { camera } = useThree()
  const zoom = camera instanceof OrthographicCamera ? 1 / camera.zoom : 1
  return <HandleArrow cursor="grab" hover={hover || !!active} onHoverChange={setHover} hoverScale={1.15}
    placement={{ position, rotation: [0, yaw, 0], baseScale: zoom * (tracker ? .55 : ARROW_SCALE * .8) }}
    shape={tracker ? 'tracker' : 'chevron'} thin={!tracker}
    indicatorRotation={vertical ? [0, Math.PI / 2, Math.PI / 2] : undefined}
    onPointerDown={event => { event.stopPropagation(); event.nativeEvent.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); swallowNextClick(); onDown(event) }} />
}
function Handles({ node }: { node: AnyNode }) {
  const { camera, gl, raycaster } = useThree()
  const cleanup = useRef<(() => void) | null>(null), [target, setTarget] = useState<Object3D | null>(null), [open, setOpen] = useState<string | null>(null)
  useEffect(() => { let frame = 0; const find = () => { const group = sceneRegistry.nodes.get(node.id); if (group) setTarget(group); else frame = requestAnimationFrame(find) }; find(); return () => { cancelAnimationFrame(frame); cleanup.current?.() } }, [node.id])
  if (!target) return null
  const raw = node as unknown as { position?: Point; rotation?: Point; path?: Point[] }, head = IrrigationHeadNode.safeParse(node)
  const yaw = raw.rotation?.[1] || 0
  const toParent = (p: Vector3) => raw.position ? p.applyAxisAngle(new Vector3(0, 1, 0), yaw).add(new Vector3(...raw.position)) : p
  const toLocal = (p: Point): Point => raw.position ? new Vector3(...p).sub(new Vector3(...raw.position)).applyAxisAngle(new Vector3(0, 1, 0), -yaw).toArray() as Point : p
  const origin = irrigationMoveOrigin(node)
  const anchors: { key: string; local: Point; base: Point; payload: HandlePayload }[] = [{ key: 'move', local: toLocal([origin[0], origin[1] + .23, origin[2]]), base: origin, payload: { kind: 'move' } }]
  raw.path?.forEach((p, index) => { if (index > 0 && index < raw.path!.length - 1 && raw.path!.slice(0, index).some(q => Math.hypot(q[0] - p[0], q[2] - p[2]) < .05)) return; anchors.push({ key: `point-${index}`, local: [p[0], p[1] + .08, p[2]], base: p, payload: { kind: 'point', index } }) })
  const down = (event: ThreeEvent<PointerEvent>, payload: HandlePayload, local: Point, base: Point, axis?: 'x' | 'y' | 'z') => {
    if (event.button !== 0 || useScene.getState().readOnly) return
    event.stopPropagation(); cleanup.current?.()
    const initial = useScene.getState().nodes, ids = irrigationEditIds(node, initial)
    target.updateWorldMatrix(true, false)
    const worldInverse = target.matrixWorld.clone().invert()
    const world = target.localToWorld(new Vector3(...local))
    const normal = axis === 'y' ? camera.getWorldDirection(new Vector3()) : new Vector3(0, 1, 0).transformDirection(target.matrixWorld)
    if (axis === 'y') { normal.y = 0; if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0); normal.normalize() }
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, world), screen = new Vector2(), hit = new Vector3()
    const initialHit = event.ray.intersectPlane(plane, new Vector3())
    const parentOrigin = initialHit ? toParent(initialHit.applyMatrix4(worldInverse)) : toParent(new Vector3(...local))
    let started = false
    let batch: EditBatch = [], detach = false
    useViewer.getState().setInputDragging(true)
    const move = (e: PointerEvent) => {
      if (!started && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 3) return
      started = true
      const rect = gl.domElement.getBoundingClientRect(); screen.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(screen, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return
      const current = toParent(hit.clone().applyMatrix4(worldInverse)), delta = current.sub(parentOrigin)
      if (axis) for (const [i, name] of (['x', 'y', 'z'] as const).entries()) if (name !== axis) delta.setComponent(i, 0)
      const point = new Vector3(...base).add(delta).toArray() as Point
      const step = !e.altKey && isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      if (step) for (const [i, name] of (['x', 'y', 'z'] as const).entries()) if (!axis || axis === name) point[i] = Math.round(point[i]! / step) * step
      detach = e.altKey
      const aim = payload.kind === 'move' ? point.map((v, i) => v - base[i]!) as Point : point
      batch = planHandleEdit(node, payload, aim, detach, initial)
      clearEditPreview(ids)
      useLiveNodeOverrides.getState().setMany(batch.map(u => [u.id, u.data as Record<string, unknown>] as const)); batch.forEach(u => useScene.getState().markDirty(u.id))
    }
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key)
      clearEditPreview(ids)
      if (commit && batch.length && !useScene.getState().readOnly && useScene.getState().nodes === initial) commitIrrigationEdit(node, batch, detach)
      useViewer.getState().setInputDragging(false); swallowNextClick(); cleanup.current = null
    }
    const up = () => finish(true), cancel = () => finish(false), key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancel() } }
    cleanup.current = cancel; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel); window.addEventListener('keydown', key)
  }
  return createPortal(<group>
    {anchors.map(a => <group key={a.key}>
      <Arrow position={a.local} tracker active={open === a.key} onDown={e => { setOpen(a.key); down(e, a.payload, a.local, a.base) }} />
      {open === a.key && (['x', 'z', ...(raw.path ? ['y'] : [])] as ('x' | 'y' | 'z')[]).map(axis => {
        const offset = new Vector3(axis === 'x' ? .4 : 0, axis === 'y' ? .4 : 0, axis === 'z' ? .4 : 0).applyAxisAngle(new Vector3(0, 1, 0), -yaw)
        const p = new Vector3(...a.local).add(offset).toArray() as Point
        const payload = a.payload.kind === 'point' ? { ...a.payload, axis } : a.payload
        return <Arrow key={axis} position={p} yaw={(axis === 'z' ? -Math.PI / 2 : 0) - yaw} vertical={axis === 'y'} onDown={e => down(e, payload, p, a.base, axis)} />
      })}
    </group>)}
    {(open && open !== 'move' ? raw.path?.slice(1) : [])?.map((p, index) => {
      const base = p.map((v, i) => (v + raw.path![index]![i]!) / 2) as Point, local: Point = [base[0], base[1] + .08, base[2]]
      return <Arrow key={`insert-${index}`} position={local} tracker onDown={e => down(e, { kind: 'insert', index }, local, base)} />
    })}
    {head.success && open === 'move' && ([{ position: [head.data.radius, .08, 0] as Point, payload: { kind: 'radius' } as HandlePayload }, { position: [Math.sin(head.data.arc * Math.PI / 180) * head.data.radius, .08, Math.cos(head.data.arc * Math.PI / 180) * head.data.radius] as Point, payload: { kind: 'arc' } as HandlePayload }, { position: [0, .08, head.data.radius + .5] as Point, payload: { kind: 'direction' } as HandlePayload }]).map((h, i) => <Arrow key={`coverage-${i}`} position={h.position} tracker onDown={e => down(e, h.payload, h.position, toParent(new Vector3(...h.position)).toArray() as Point)} />)}
  </group>, target)
}
