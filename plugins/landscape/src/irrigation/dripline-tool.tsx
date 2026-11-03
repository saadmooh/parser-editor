'use client'
import { type AnyNode, createSceneApi, nodeRegistry, emitter, type GridEvent, type NodeEvent, sceneRegistry, useScene } from '@pascal-app/core'
import { type FloorplanToolContext, useEditor, usePlacementPreview, useRegistryToolContext, useInteractionScope } from '@pascal-app/editor'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Html } from '@react-three/drei'
import { Group, Mesh } from 'three'
import { DriplineNode, driplineGeometry, driplineMetrics } from './dripline'
import { equipmentEventPoint } from './equipment-tool'
import { nearestDriplineFeed, snapDriplineInlet, planDriplinePlacement } from './dripline-connection'
import { irrigationPlanPreview } from './preview'
import { applyIrrigationPlan, type IrrigationPlan } from './network'
import { irrigationPorts, type IrrigationPort } from './ports'
import type { Point } from './ports'
export default function DriplineTool() {
  const context = useRegistryToolContext(), view = useEditor(s => s.viewMode)
  return view === '2d' ? null : <DriplineDrawing {...context} render3D />
}
export function DriplineFloorplanTool(context: FloorplanToolContext) { return <DriplineDrawing {...context} /> }
function DriplineDrawing({ activeLevelId, selectNode, render3D = false }: Pick<FloorplanToolContext, 'activeLevelId' | 'selectNode'> & { render3D?: boolean }) {
  const defaults = useEditor(s => s.toolDefaults['landscape:dripline'])
  const [path, setPath] = useState<Point[]>([]), [message, setMessage] = useState('Click points to draw a dripline')
  const backRef = useRef<() => void>(() => {})
  const [pointCount, setPointCount] = useState(0)
  const commitRef = useRef<() => void>(() => {})
  const [routePreview, setRoutePreview] = useState<IrrigationPlan | null>(null)
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => {
    if (!activeLevelId) return
    let feed: IrrigationPort | undefined
    let points: Point[] = [], lastClick: { event: object; x: number; y: number; time: number } | undefined
    setHost(document.querySelector('[data-floorplan-scene]')?.parentElement?.parentElement ?? document.querySelector('canvas')?.parentElement ?? null)
    useInteractionScope.getState().begin({ kind: 'drafting', tool: 'landscape:dripline' })
    const finish = () => { useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    const showPreview = (path: Point[]) => {
      setPath(path)
      const parsed = DriplineNode.safeParse({ ...defaults, parentId: activeLevelId, path })
      if (!parsed.success) { setRoutePreview(null); usePlacementPreview.getState().clear(); return }
      try {
        const plan = planDriplinePlacement(parsed.data, feed, useScene.getState().nodes)
        setRoutePreview(plan)
        usePlacementPreview.getState().set(irrigationPlanPreview(plan, useScene.getState().nodes, activeLevelId))
        if (feed) setMessage(`Connected preview from ${feed.name}. Enter to save tubing and fittings.`)
      } catch (error) {
        setRoutePreview(null)
        usePlacementPreview.getState().set(parsed.data as unknown as AnyNode)
        setMessage((error as Error).message)
      }
    }
    const move = (event: GridEvent | NodeEvent<AnyNode>) => {
      const point = equipmentEventPoint(event, activeLevelId)
      const candidate = !points.length && !event.nativeEvent?.altKey ? nearestDriplineFeed(point, activeLevelId, (defaults as { zone?: string })?.zone || 'Zone 1', useScene.getState().nodes) : undefined
      if (!points.length) setMessage(candidate ? `Start from ${candidate.name}. Feed pipe and fittings will be added.` : 'Click the inlet near a valve or pipe socket. Alt draws without connecting.')
      showPreview([...points, candidate ? snapDriplineInlet(point, candidate) : point])
    }
    const refresh = () => { setPointCount(points.length); showPreview([...points]) }
    backRef.current = () => { points.pop(); if (!points.length) feed = undefined; refresh(); setMessage('Click to add a point. Enter to finish.'); }
    const click = (event: GridEvent | NodeEvent<AnyNode>) => {
      if (event.nativeEvent?.button !== undefined && event.nativeEvent.button !== 0 || useScene.getState().readOnly) return
      const native = event.nativeEvent
      if (native) {
        // A mesh pointer-up and the following canvas click are one gesture.
        if (lastClick && (lastClick.event === native || native.clientX === lastClick.x && native.clientY === lastClick.y && Math.abs(native.timeStamp - lastClick.time) < 100)) return
        lastClick = { event: native, x: native.clientX, y: native.clientY, time: native.timeStamp }
      }
      let p = equipmentEventPoint(event, activeLevelId)
      if (!points.length) {
        feed = !native?.altKey ? nearestDriplineFeed(p, activeLevelId, (defaults as { zone?: string })?.zone || 'Zone 1', useScene.getState().nodes) : undefined
        if (feed) p = snapDriplineInlet(p, feed)
      }
      if (points.at(-1)?.every((v, i) => v === p[i])) return
      if (points.length >= 256) { setMessage('Maximum 256 points. Finish this line to start another.'); return }
      points.push(p); setMessage('Click to add a point. Enter to finish.'); refresh(); event.nativeEvent?.stopPropagation()
    }
    commitRef.current = () => {
      const parsed = DriplineNode.safeParse({ ...defaults, parentId: activeLevelId, path: points, name: 'Dripline' })
      if (!parsed.success) { setMessage('Add at least two distinct points. The line must be between 0.1 and 300 m.'); return }
      if (useScene.getState().readOnly) return
      try {
        const nodes = useScene.getState().nodes
        const currentFeed = feed ? irrigationPorts(nodes[feed.nodeId as keyof typeof nodes]).find(p => p.id === feed!.id) : undefined
        if (feed && !currentFeed) throw new Error('The feed was removed. Undo the inlet point and choose another socket.')
        const plan = planDriplinePlacement(parsed.data, currentFeed, nodes)
        applyIrrigationPlan(createSceneApi(useScene), plan, activeLevelId)
        selectNode(parsed.data.id as never); finish()
      } catch (error) { setMessage((error as Error).message) }
    }
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      if (event.key === 'Backspace') { event.preventDefault(); backRef.current() }
      if (event.key === 'Escape') { event.preventDefault(); finish() }
      if (event.key === 'Enter') { event.preventDefault(); commitRef.current() }
    }
    emitter.on('grid:move', move); emitter.on('node:move', move); emitter.on('grid:click', click); emitter.on('node:click', click); window.addEventListener('keydown', key)
    return () => { emitter.off('grid:move', move); emitter.off('node:move', move); emitter.off('grid:click', click); emitter.off('node:click', click); window.removeEventListener('keydown', key); usePlacementPreview.getState().clear(); useInteractionScope.getState().endIf(s => s.kind === 'drafting' && s.tool === 'landscape:dripline') }
  }, [activeLevelId, defaults, selectNode])
  const draft = useMemo(() => DriplineNode.safeParse({ ...defaults, path }), [defaults, path])
  const ghost = useMemo(() => {
    const group = new Group()
    if (routePreview) for (const node of routePreview.create) {
      const object = nodeRegistry.get(node.type)?.geometry?.(node, {} as never)
      if (object instanceof Group) {
        const posed = node as unknown as { position?: Point; rotation?: Point }
        if (posed.position) object.position.set(...posed.position)
        if (posed.rotation) object.rotation.set(...posed.rotation)
        group.add(object)
      }
    }
    else if (draft.success) group.add(driplineGeometry(draft.data))
    group.traverse(part => { part.raycast = () => {} })
    return group
  }, [draft, routePreview])
  useEffect(() => () => ghost.traverse(part => {
    const mesh = part as Mesh
    mesh.geometry?.dispose()
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  }), [ghost])
  const metrics = draft.success ? driplineMetrics(draft.data) : null
  const level = activeLevelId ? sceneRegistry.nodes.get(activeLevelId) : null
  const controls = host ? createPortal(<div className="absolute left-4 top-28 z-50 rounded-md border border-border bg-background p-3 text-xs text-foreground" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}><p role="status">{message}</p><p>{metrics ? `${metrics.length.toFixed(1)} m · ${metrics.emitters} emitters` : 'Choose the inlet, then click along the bed'}</p><button type="button" onClick={() => backRef.current()} disabled={!path.length} className="mr-2 mt-2 rounded border border-border px-3 py-1 disabled:opacity-40">Undo point</button><button type="button" disabled={pointCount < 2} onClick={() => commitRef.current()} className="mt-2 rounded border border-border px-3 py-1">Finish dripline</button></div>, host) : null
  return <>{render3D && <group position={[0, level?.position.y ?? 0, 0]}><primitive object={ghost} dispose={null} /></group>}{render3D ? <Html>{controls}</Html> : controls}</>
}
