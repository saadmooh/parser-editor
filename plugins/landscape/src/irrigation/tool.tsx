'use client'
import { type AnyNode, type AnyNodeId, createSceneApi, emitter, type GridEvent, type NodeEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { type FloorplanToolContext, getFloorStackPreviewPosition, isGridSnapActive, useEditor, usePlacementPreview, useRegistryToolContext } from '@pascal-app/editor'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Group, type Mesh, Vector3 } from 'three'
import { IrrigationHeadNode, IRRIGATION_HEAD_KIND } from './schema'

import { createPortal } from 'react-dom'
import { Html } from '@react-three/drei'
import { planNearbySprinkler } from './auto-connect'
import { applyIrrigationPlan, type IrrigationPlan } from './network'
import { irrigationPlanPreview } from './preview'
import { IrrigationRoutePreview } from './route-preview'
import { createSprinklerModel } from './sprinkler-model'
import { zoneColor } from './zone-model'

type PlacementEvent = GridEvent | NodeEvent<AnyNode>
const neverDragging = () => false
export default function IrrigationTool() {
  const context = useRegistryToolContext()
  const viewMode = useEditor((state) => state.viewMode)
  return viewMode === '2d' ? null : <IrrigationPlacement {...context} render3D />
}
export function IrrigationPlacement({ activeLevelId, selectNode, isCameraDragging = neverDragging, render3D = false }:
  Pick<FloorplanToolContext, 'activeLevelId' | 'selectNode'> & { isCameraDragging?: () => boolean; render3D?: boolean }) {
  const [autoConnect, setAutoConnect] = useState(true), [range, setRange] = useState(6)
  const [route, setRoute] = useState<IrrigationPlan | null>(null), [message, setMessage] = useState('Place sprinklers in the same zone to connect them.')
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => { setHost(document.querySelector('[data-floorplan-scene]')?.parentElement?.parentElement ?? document.querySelector('canvas')?.parentElement ?? null) }, [])
  const defaults = useEditor((state) => state.toolDefaults[IRRIGATION_HEAD_KIND])
  const preview = useMemo(() => IrrigationHeadNode.parse({ ...defaults, name: 'Irrigation head' }), [defaults])
  const model = useMemo(() => {
    const object = createSprinklerModel(zoneColor(preview.zoneId || preview.zone), preview.arc)
    object.traverse(part => { part.raycast = () => {} })
    return object
  }, [preview.zoneId, preview.zone, preview.arc])
  useEffect(() => () => {
    model.traverse(part => {
      const mesh = part as Mesh
      mesh.geometry?.dispose()
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
    })
  }, [model])
  const cursor = useRef<Group>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!activeLevelId) return
    let committed = false
    let repeatFrame = 0
    const finish = () => {
      const editor = useEditor.getState()
      editor.setTool(null); editor.setMode('select'); editor.setPhase('building')
      editor.setActiveSidebarPanel('pascal:landscape:landscape')
    }
    const resolve = (event: PlacementEvent) => {
      const point = new Vector3(...event.position)
      const level = sceneRegistry.nodes.get(activeLevelId)
      if (level) { level.updateWorldMatrix(true, false); level.worldToLocal(point) }
      else if ('localPosition' in event) point.set(...event.localPosition)
      const [x, z] = isGridSnapActive() ? snapPointToGrid([point.x, point.z], useEditor.getState().gridSnapStep) : [point.x, point.z]
      return IrrigationHeadNode.parse({ ...preview, parentId: activeLevelId, position: [x, 0, z] })
    }
    const move = (event: PlacementEvent) => {
      const node = resolve(event)
      cursor.current?.position.set(...getFloorStackPreviewPosition({ node: node as unknown as AnyNode, position: node.position, levelId: activeLevelId }))
      setVisible(true)
      try {
      const result = planNearbySprinkler(node, useScene.getState().nodes, range, autoConnect && !event.nativeEvent?.altKey)
      setRoute(result.target ? result.plan : null); setMessage(result.message)
      usePlacementPreview.getState().set(irrigationPlanPreview(result.plan, useScene.getState().nodes, activeLevelId))
      } catch (error) { setRoute(null); usePlacementPreview.getState().clear(); setMessage((error as Error).message) }
    }
    const click = (event: PlacementEvent) => {
      const state = useScene.getState()
      if (committed || state.readOnly || !state.nodes[activeLevelId] || isCameraDragging()) return
      if (event.nativeEvent && 'button' in event.nativeEvent && event.nativeEvent.button !== 0) return
      const { id: _id, ...fields } = resolve(event)
      const placed = IrrigationHeadNode.parse(fields)
      let result: ReturnType<typeof planNearbySprinkler>
      try { result = planNearbySprinkler(placed, state.nodes, range, autoConnect && !event.nativeEvent?.altKey); applyIrrigationPlan(createSceneApi(useScene), result.plan, activeLevelId) }
      catch (error) { setMessage((error as Error).message); return }
      committed = true
      setRoute(null); usePlacementPreview.getState().clear()
      setMessage(result.target ? 'Sprinkler and pipes connected. Place the next sprinkler.' : result.message)
      event.nativeEvent?.stopPropagation()
      if (useEditor.getState().getContinuation('point') === 'repeat') repeatFrame = requestAnimationFrame(() => { committed = false })
      else { selectNode(placed.id as AnyNodeId); finish() }
    }
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) {
        event.preventDefault(); useEditor.getState().cycleContinuation('point'); return
      }
      if (event.key !== 'Escape') return
      event.preventDefault(); finish()
    }
    emitter.on('grid:move', move); emitter.on('node:move', move)
    emitter.on('grid:click', click); emitter.on('node:click', click)
    window.addEventListener('keydown', key)
    return () => {
      cancelAnimationFrame(repeatFrame)
      emitter.off('grid:move', move); emitter.off('node:move', move)
      emitter.off('grid:click', click); emitter.off('node:click', click)
      window.removeEventListener('keydown', key)
      usePlacementPreview.getState().clear()
    }
  }, [activeLevelId, selectNode, isCameraDragging, preview, range, autoConnect])
  const level = activeLevelId ? sceneRegistry.nodes.get(activeLevelId) : null
  const controls = host ? createPortal(<div className="absolute left-4 top-28 z-50 max-w-72 space-y-2 rounded-md border border-border bg-background p-3 text-xs text-foreground" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <label className="flex items-center gap-2"><input type="checkbox" checked={autoConnect} onChange={e => { setAutoConnect(e.target.checked); setRoute(null); usePlacementPreview.getState().clear() }} />Auto-connect nearby devices</label>
    <label className="flex items-center gap-2">Within<input aria-label="Automatic pipe connection distance" type="number" min="1" max="30" step="1" value={range} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 1 && value <= 30) { setRange(value); setRoute(null); usePlacementPreview.getState().clear() } }} className="w-14 rounded border border-border bg-background p-1" />m</label>
    <p role="status">{message}</p><p className="text-muted-foreground">Alt skips connection · C repeats placement · Esc finishes</p>
  </div>, host) : null
  return <>
    {render3D && <>
      <group ref={cursor} visible={visible} rotation={preview.rotation}><primitive object={model} dispose={null} /></group>
      <group position={[0, level?.position.y ?? 0, 0]}><IrrigationRoutePreview plan={route} /></group>
    </>}
    {render3D ? <Html>{controls}</Html> : controls}
  </>
}
