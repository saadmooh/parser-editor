'use client'
import { type AnyNode, type AnyNodeId, emitter, type GridEvent, type NodeEvent,
  sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { isGridSnapActive, useEditor, usePlacementPreview,
  useRegistryToolContext } from '@pascal-app/editor'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { type Group, Vector3 } from 'three'
import { accessItemFor } from './items'
import { snapToHardscape } from './hardscape-snap'
import AccessPreview from './preview'

type PlacementEvent = GridEvent | NodeEvent<AnyNode>

export default function AccessTool() {
  const { activeLevelId, selectNode, isCameraDragging } = useRegistryToolContext()
  const kind = useEditor((state) => state.tool)
  const defaults = useEditor((state) => kind ? state.toolDefaults[kind] : undefined)
  const item = accessItemFor(kind ?? '')
  const preview = useMemo(() => item?.schema.parse({ ...defaults, name: item.label }), [item, defaults])
  const cursor = useRef<Group>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!activeLevelId || !item || !preview) return
    let last: PlacementEvent | null = null
    let yaw = 0
    let committed = false
    const finish = () => {
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const resolve = (event: PlacementEvent) => {
      const point = new Vector3(...event.position)
      const level = sceneRegistry.nodes.get(activeLevelId)
      if (level) {
        level.updateWorldMatrix(true, false)
        level.worldToLocal(point)
      } else if ('localPosition' in event) point.set(...event.localPosition)
      const raw: [number, number] = [point.x, point.z]
      const hardscape = !('nativeEvent' in event && event.nativeEvent?.altKey)
        ? snapToHardscape(raw, useScene.getState().nodes, activeLevelId, undefined, 0.24) : null
      const [x, z] = hardscape?.point ?? (isGridSnapActive()
        ? snapPointToGrid([point.x, point.z], useEditor.getState().gridSnapStep)
        : [point.x, point.z])
      return item.schema.parse({ ...preview, parentId: activeLevelId,
        position: [x, 0, z], rotation: [0, yaw, 0] })
    }
    const move = (event: PlacementEvent) => {
      last = event
      const node = resolve(event)
      cursor.current?.position.set(...node.position)
      cursor.current?.rotation.set(0, node.rotation[1], 0)
      setVisible(true)
      usePlacementPreview.getState().set(node as unknown as AnyNode)
    }
    const click = (event: PlacementEvent) => {
      if (committed || isCameraDragging()) return
      if (event.nativeEvent && 'button' in event.nativeEvent && event.nativeEvent.button !== 0) return
      const node = resolve(last ?? event)
      const { id: _previewId, ...fields } = node
      const placed = item.schema.parse(fields)
      committed = true
      useScene.getState().createNode(placed as unknown as AnyNode, activeLevelId as AnyNodeId)
      selectNode(placed.id as AnyNodeId)
      event.nativeEvent?.stopPropagation()
      finish()
    }
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      if (event.key === 'Escape') { event.preventDefault(); finish() }
      else if (['r', 't'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        yaw += (event.key.toLowerCase() === 'r' ? 1 : -1) * Math.PI / 4
        if (last) move(last)
      }
    }
    emitter.on('grid:move', move)
    emitter.on('grid:click', click)
    emitter.on('node:click', click)
    window.addEventListener('keydown', key)
    return () => {
      emitter.off('grid:move', move)
      emitter.off('grid:click', click)
      emitter.off('node:click', click)
      window.removeEventListener('keydown', key)
      usePlacementPreview.getState().clear()
    }
  }, [activeLevelId, item, preview, selectNode, isCameraDragging])

  return createElement('group', { ref: cursor, visible }, preview && <AccessPreview node={preview} />)
}
