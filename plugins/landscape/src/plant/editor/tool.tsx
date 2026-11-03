'use client'
import { landscapeToolColors } from '../../shared/tool-colors'
import { type AnyNode, type AnyNodeId, emitter, type GridEvent, type NodeEvent,
  sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { type FloorplanToolContext, getFloorStackPreviewPosition, isGridSnapActive, useEditor,
  usePlacementPreview, useRegistryToolContext } from '@pascal-app/editor'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Group, Vector3 } from 'three'
import { PLANT_KIND, PlantNode } from '../domain/schema'
import { PLANT_PRESET_BY_KEY } from '../domain/catalog'
import PlantPreview from '../rendering/preview'
import { distanceToStroke, strokeSamples, type StrokePoint } from '../../editor/planting-stroke'
import { sceneVisibility } from '../../editor/scene-visibility'
import { TREE_KIND, TreeNode } from '../../tree/domain/schema'
import { TREE_SPECIES_BY_KEY } from '../../tree/domain/species'
import TreePreview from '../../tree/rendering/preview'
import { plantPlanRadius, treePlanRadius } from '../../editor/planting-footprint'

type PlacementEvent = GridEvent | NodeEvent<AnyNode>

export default function PlantTool() {
  const context = useRegistryToolContext()
  const viewMode = useEditor((state) => state.viewMode)
  if (viewMode === '2d') return null
  return <PlantPlacement {...context} render3D />
}

const neverDragging = () => false
export function PlantPlacement({ activeLevelId, selectNode, isCameraDragging = neverDragging, render3D = false, family = 'plant' }:
  Pick<FloorplanToolContext, 'activeLevelId' | 'selectNode'> & { isCameraDragging?: () => boolean; render3D?: boolean; family?: 'plant' | 'tree' }) {
  const kind = family === 'tree' ? TREE_KIND : PLANT_KIND
  const schema = family === 'tree' ? TreeNode : PlantNode
  const radius = (node: PlantNode | TreeNode) => node.type === TREE_KIND ? treePlanRadius(node as TreeNode) : plantPlanRadius(node as PlantNode)
  const defaults = useEditor((state) => state.toolDefaults[kind])
  const preview = useMemo(() => schema.parse({ ...defaults,
    name: family === 'tree' ? TREE_SPECIES_BY_KEY[String(defaults?.species ?? 'whiteOak')]?.name ?? 'Tree'
      : PLANT_PRESET_BY_KEY[String(defaults?.preset ?? 'fab:oak')]?.name ?? 'Plant' }), [defaults, family])
  const previewRef = useRef(preview)
  const refreshPreview = useRef<() => void>(() => {})
  const cursor = useRef<Group>(null)
  const [visible, setVisible] = useState(false)
  const [strokePreview, setStrokePreview] = useState<Array<{ position: [number, number, number]; radius: number; erase: boolean }>>([])
  useEffect(() => { previewRef.current = preview; refreshPreview.current() }, [preview])
  useEffect(() => {
    if (!activeLevelId) return
    let last: PlacementEvent | null = null
    let committed = false
    let repeatFrame = 0
    let stroke: { mode: 'brush' | 'erase'; last: StrokePoint; size: number; plants: Array<PlantNode | TreeNode>; erased: Set<AnyNodeId> } | null = null
    const paintMode = () => useEditor.getState().toolDefaults[kind]?.landscapePaintMode
    const publish = (node: PlantNode | TreeNode) => {
      const entries = stroke ? (stroke.mode === 'brush' ? stroke.plants : [...stroke.erased].flatMap((id) => {
        const parsed = schema.safeParse(useScene.getState().nodes[id])
        return parsed.success ? [parsed.data] : []
      })).map((plant) => ({ position: plant.position, radius: radius(plant), erase: stroke!.mode === 'erase' })) : []
      if (paintMode() === 'erase') {
        const rawSize = Number(useEditor.getState().toolDefaults[kind]?.landscapeBrushSize ?? (family === 'tree' ? 5 : 1))
        entries.push({ position: node.position, radius: Number.isFinite(rawSize) ? Math.max(0.1, Math.min(10, rawSize)) : 1, erase: true })
      }
      setStrokePreview(entries)
      usePlacementPreview.getState().set((entries.length ? { ...node, metadata: { ...node.metadata,
        landscapeStrokePreview: entries.map((entry) => [entry.position[0], entry.position[2], entry.radius, entry.erase ? 'erase' : 'brush']),
      } } : node) as unknown as AnyNode)
    }
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
      const [x, z] = isGridSnapActive()
        ? snapPointToGrid([point.x, point.z], useEditor.getState().gridSnapStep)
        : [point.x, point.z]
      return schema.parse({ ...previewRef.current, parentId: activeLevelId, position: [x, 0, z] })
    }
    const move = (event: PlacementEvent) => {
      last = event
      const node = resolve(event)
      cursor.current?.position.set(...getFloorStackPreviewPosition({
        node: node as unknown as AnyNode, position: node.position, levelId: activeLevelId,
      }))
      setVisible(true)
      if (stroke && !isCameraDragging()) paint([node.position[0], node.position[2]])
      publish(node)
    }
    const paint = (point: StrokePoint) => {
      if (!stroke) return
      if (stroke.mode === 'brush') {
        const samples = strokeSamples(stroke.last, point, stroke.size, 500 - stroke.plants.length)
        for (const [x, z] of samples) {
          const { id: _previewId, ...fields } = previewRef.current
          stroke.plants.push(schema.parse({ ...fields, parentId: activeLevelId, position: [x, 0, z] }))
        }
        if (samples.length) stroke.last = samples.at(-1)!
      } else {
        const nodes = useScene.getState().nodes
        const isVisible = sceneVisibility(nodes)
        for (const raw of Object.values(nodes)) {
          if ((raw.type as string) !== kind || raw.parentId !== activeLevelId || !isVisible(raw)) continue
          const parsed = schema.safeParse(raw)
          if (parsed.success && distanceToStroke([parsed.data.position[0], parsed.data.position[2]], stroke.last, point) <= stroke.size)
            stroke.erased.add(raw.id as AnyNodeId)
        }
        stroke.last = point
      }
    }
    const pointerDown = (event: PointerEvent) => {
      const mode = paintMode()
      if (stroke || (mode !== 'brush' && mode !== 'erase') || !last || event.button !== 0 || event.altKey || event.metaKey || event.ctrlKey || isCameraDragging() || useScene.getState().readOnly) return
      const target = event.target
      // The host grid raycast supplies the fresh 3D pointer-down position.
      // Document capture runs before that raycast and may still hold an old cursor.
      if (target instanceof HTMLCanvasElement && event.eventPhase === Event.CAPTURING_PHASE) return
      if (!(target instanceof HTMLCanvasElement) && !(target instanceof SVGElement && target.closest('svg[data-pascal-floorplan-2d]'))) return
      const node = resolve(last)
      const rawSize = Number(useEditor.getState().toolDefaults[kind]?.landscapeBrushSize ?? (family === 'tree' ? 5 : 1))
      const size = Number.isFinite(rawSize) ? Math.max(0.1, Math.min(10, rawSize)) : 1
      stroke = { mode, size, last: [node.position[0], node.position[2]], plants: [], erased: new Set() }
      if (mode === 'brush') {
        const { id: _previewId, ...fields } = node
        stroke.plants.push(schema.parse(fields))
      } else paint(stroke.last)
      publish(node)
      event.preventDefault()
    }
    const startAtHit = (event: PlacementEvent) => {
      last = event
      if (event.nativeEvent) pointerDown(event.nativeEvent as unknown as PointerEvent)
    }
    const pointerUp = () => {
      const finished = stroke
      stroke = null
      if (last) publish(resolve(last))
      if (!finished || useScene.getState().readOnly) return
      const nodes = useScene.getState().nodes
      const isVisible = sceneVisibility(nodes)
      const erased = [...finished.erased].filter((id) => {
        const node = nodes[id]
        return node && (node.type as string) === kind && node.parentId === activeLevelId && isVisible(node)
      })
      if (finished.plants.length || erased.length) useScene.getState().applyNodeChanges({
        create: finished.plants.map((node) => ({ node: node as unknown as AnyNode, parentId: activeLevelId })),
        delete: erased,
      })
    }
    const cancelStroke = () => { stroke = null; setStrokePreview([]); usePlacementPreview.getState().clear() }
    refreshPreview.current = () => { if (last) move(last) }
    const click = (event: PlacementEvent) => {
      if (paintMode() === 'brush' || paintMode() === 'erase') return
      if (committed || isCameraDragging() || useScene.getState().readOnly) return
      if (event.nativeEvent && 'button' in event.nativeEvent && event.nativeEvent.button !== 0) return
      const { id: _previewId, ...fields } = resolve(event)
      const placed = schema.parse(fields)
      committed = true
      useScene.getState().createNode(placed as unknown as AnyNode, placed.parentId as AnyNodeId)
      event.nativeEvent?.stopPropagation()
      if (useEditor.getState().getContinuation('point') === 'repeat') {
        // Hold the click guard through both grid/node dispatches from this frame.
        repeatFrame = requestAnimationFrame(() => { committed = false })
      } else {
        selectNode(placed.id as AnyNodeId)
        finish()
      }
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      event.preventDefault(); finish()
    }
    emitter.on('grid:move', move); emitter.on('node:move', move)
    emitter.on('grid:click', click); emitter.on('node:click', click)
    emitter.on('grid:pointerdown', startAtHit); emitter.on('node:pointerdown', startAtHit)
    window.addEventListener('keydown', key)
    document.addEventListener('pointerdown', pointerDown, true)
    document.addEventListener('pointerup', pointerUp, true)
    document.addEventListener('pointercancel', cancelStroke, true)
    window.addEventListener('blur', cancelStroke)
    return () => {
      cancelAnimationFrame(repeatFrame)
      setStrokePreview([])
      emitter.off('grid:move', move); emitter.off('node:move', move)
      emitter.off('grid:click', click); emitter.off('node:click', click)
      emitter.off('grid:pointerdown', startAtHit); emitter.off('node:pointerdown', startAtHit)
      window.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', pointerDown, true)
      document.removeEventListener('pointerup', pointerUp, true)
      document.removeEventListener('pointercancel', cancelStroke, true)
      window.removeEventListener('blur', cancelStroke)
      usePlacementPreview.getState().clear()
      refreshPreview.current = () => {}
    }
  }, [activeLevelId, selectNode, isCameraDragging, family])
  if (!render3D) return null
  return <>
    <group ref={cursor} visible={visible && defaults?.landscapePaintMode !== 'erase'}>{family === 'tree' ? <TreePreview node={preview as TreeNode} /> : <PlantPreview node={preview as PlantNode} />}</group>
    {strokePreview.map((entry, index) => <mesh key={index} raycast={() => {}} rotation={[-Math.PI / 2, 0, 0]}
      position={getFloorStackPreviewPosition({ node: preview as unknown as AnyNode,
        position: [entry.position[0], entry.position[1] + 0.025, entry.position[2]], levelId: activeLevelId })}>
      <ringGeometry args={[Math.max(0, entry.radius - 0.025), entry.radius, 48]} />
      <meshBasicMaterial color={entry.erase ? '#e87979' : landscapeToolColors.draft} transparent opacity={0.9} depthTest={false} />
    </mesh>)}
  </>
}
