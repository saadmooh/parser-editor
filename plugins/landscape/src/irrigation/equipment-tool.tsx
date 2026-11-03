'use client'
import { type AnyNode, type AnyNodeId, emitter, type GridEvent, type NodeEvent, nodeRegistry, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { type FloorplanToolContext, isGridSnapActive, useEditor, usePlacementPreview, useRegistryToolContext, useInteractionScope } from '@pascal-app/editor'
import { useEffect, useMemo, useState } from 'react'
import { Vector3, Object3D, Mesh } from 'three'
export default function EquipmentTool() {
  const context = useRegistryToolContext(), view = useEditor(s => s.viewMode)
  return view === '2d' ? null : <EquipmentPlacement {...context} render3D />
}
export function EquipmentFloorplanTool(context: FloorplanToolContext) {
  return <EquipmentPlacement {...context} />
}
export function equipmentEventPoint(event: GridEvent | NodeEvent<AnyNode>, levelId: AnyNodeId): [number, number, number] {
  const point = new Vector3(...event.position), parent = sceneRegistry.nodes.get(levelId)
  if (parent) { parent.updateWorldMatrix(true, false); parent.worldToLocal(point) }
  else if ('localPosition' in event) point.set(...event.localPosition)
  const [x, z] = isGridSnapActive() ? snapPointToGrid([point.x, point.z], useEditor.getState().gridSnapStep) : [point.x, point.z]
  return [x, 0, z]
}
function EquipmentPlacement({ activeLevelId, selectNode, render3D = false }: Pick<FloorplanToolContext, 'activeLevelId' | 'selectNode'> & { render3D?: boolean }) {
  const kind = useEditor(s => s.tool), defaults = useEditor(s => s.tool ? s.toolDefaults[s.tool] : undefined)
  const [preview, setPreview] = useState<AnyNode | null>(null)
  useEffect(() => {
    if (!kind || !activeLevelId) return
    const def = nodeRegistry.get(kind)
    if (!def) return
    useInteractionScope.getState().begin({ kind: 'drafting', tool: kind })
    const resolve = (event: GridEvent | NodeEvent<AnyNode>) => def.schema.parse({ ...def.defaults(), ...defaults, parentId: activeLevelId, position: equipmentEventPoint(event, activeLevelId) }) as AnyNode
    const move = (event: GridEvent | NodeEvent<AnyNode>) => { const node = resolve(event); setPreview(node); usePlacementPreview.getState().set(node) }
    const finish = () => { useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    let committed = false, repeatFrame = 0
    const click = (event: GridEvent | NodeEvent<AnyNode>) => {
      if (committed || useScene.getState().readOnly || event.nativeEvent?.button !== undefined && event.nativeEvent.button !== 0) return
      const node = resolve(event); committed = true; useScene.getState().createNode(node, activeLevelId); event.nativeEvent?.stopPropagation()
      if (useEditor.getState().getContinuation('point') !== 'repeat') { selectNode(node.id); finish() }
      else repeatFrame = requestAnimationFrame(() => { committed = false })
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); finish() } }
    emitter.on('grid:move', move); emitter.on('node:move', move); emitter.on('grid:click', click); emitter.on('node:click', click)
    window.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(repeatFrame); emitter.off('grid:move', move); emitter.off('node:move', move); emitter.off('grid:click', click); emitter.off('node:click', click); window.removeEventListener('keydown', key); usePlacementPreview.getState().clear(); useInteractionScope.getState().endIf(s => s.kind === 'drafting' && s.tool === kind) }
  }, [activeLevelId, kind, defaults, selectNode])
  const object = useMemo(() => {
    if (!preview || !kind) return null
    const obj = nodeRegistry.get(kind)?.geometry?.(preview, {} as never)
    if (obj instanceof Object3D) obj.traverse(o => { if (o instanceof Mesh) o.raycast = () => {} })
    return obj instanceof Object3D ? obj : null
  }, [preview, kind])
  useEffect(() => () => object?.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()) } }), [object])
  const position = (preview as unknown as { position?: [number, number, number] })?.position
  const rotation = (preview as unknown as { rotation?: [number, number, number] })?.rotation
  const level = activeLevelId ? sceneRegistry.nodes.get(activeLevelId) : null
  return render3D && object && position ? <group rotation={rotation} position={[position[0], position[1] + (level?.position.y ?? 0), position[2]]}><primitive object={object} dispose={null} /></group> : null
}
