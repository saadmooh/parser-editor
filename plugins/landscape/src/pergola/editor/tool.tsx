'use client'
import {
  type AnyNode,
  type AnyNodeId,
  emitter,
  type GridEvent,
  type NodeEvent,
  resolveSupportSlabPatch,
  sceneRegistry,
  snapPointToGrid,
  useScene,
} from '@pascal-app/core'
import {
  getFloorStackPreviewPosition,
  isGridSnapActive,
  resolvePointerSupportSurface,
  useEditor,
  usePlacementPreview,
  useRegistryToolContext,
} from '@pascal-app/editor'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Group, Vector3 } from 'three'
import { PergolaNode, PERGOLA_KIND } from '../domain/schema'
import { findPergolaSupportSurface, pergolaPointOnSupport, pergolaSupportPose, pergolaSupportSurfaceTop } from '../domain/support-surface'
import PergolaPreview from '../rendering/preview'

type PlacementEvent = GridEvent | NodeEvent<AnyNode>
export default function PergolaTool() {
  const camera = useThree((state) => state.camera)
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const { activeLevelId, selectNode, isCameraDragging } =
    useRegistryToolContext()
  const defaults = useEditor((s) => s.toolDefaults[PERGOLA_KIND])
  const preview = useMemo(
    () => PergolaNode.parse({ ...defaults, name: 'Pergola' }),
    [defaults],
  )
  const previewRef = useRef(preview)
  const [ghostNode, setGhostNode] = useState(preview)
  const refreshPreview = useRef<() => void>(() => {})
  const cursor = useRef<Group>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    previewRef.current = preview
    setGhostNode(preview)
    refreshPreview.current()
  }, [preview])
  useEffect(() => {
    if (!activeLevelId) return
    let last: PlacementEvent | null = null
    let yaw = 0
    let committed = false
    const finish = () => {
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const resolve = (event: PlacementEvent) => {
      // Grid events hit the construction plane, which can lie beneath a deck.
      // Resolve the actual walking face along the pointer ray for hover and commit.
      const pointed = resolvePointerSupportSurface(cameraRef.current, event.position, {
        includeNodeTopSurfaces: true,
        pointerRay: 'node' in event ? event.nativeEvent?.ray : undefined,
      })
      const point = new Vector3(...(pointed?.worldPoint ?? event.position))
      const level = sceneRegistry.nodes.get(activeLevelId)
      if (level) {
        level.updateWorldMatrix(true, false)
        level.worldToLocal(point)
      } else if ('localPosition' in event) point.set(...event.localPosition)
      const [x, z] = isGridSnapActive()
        ? snapPointToGrid([point.x, point.z], useEditor.getState().gridSnapStep)
        : [point.x, point.z]
      const n = PergolaNode.parse({
        ...previewRef.current,
        parentId: activeLevelId,
        position: [x, 0, z],
        rotation: [0, yaw, 0],
      })
      const patch = resolveSupportSlabPatch(
        n as unknown as AnyNode,
        useScene.getState().nodes,
      )
      const preferredId = pointed?.sourceNodeId ?? ('node' in event ? event.node.id : undefined)
      const support = findPergolaSupportSurface(n, useScene.getState().nodes, preferredId, point.y)
      const local = support ? pergolaPointOnSupport(support, [x, z]) : [x, z]
      return PergolaNode.parse({
        ...n,
        ...patch,
        parentId: support?.id ?? activeLevelId,
        supportSlabId: support ? undefined : patch.supportSlabId,
        supportSurfaceId: support?.id ?? null,
        position: support
          ? [local[0], pergolaSupportSurfaceTop(support, [x, z]) - (support.position?.[1] ?? 0), local[1]]
          : [x, 0, z],
        rotation: [0, yaw - (support ? pergolaSupportPose(support).yaw : 0), 0],
      })
    }
    const move = (event: PlacementEvent) => {
      last = event
      const node = resolve(event)
      setGhostNode(node)
      // The preview cursor is inside the building-local tool group, while
      // hosted node positions are local to the active level / support.
      const levelY = sceneRegistry.nodes.get(activeLevelId)?.position.y ?? 0
      const position = node.supportSurfaceId
        ? (() => {
            const host = useScene.getState().nodes[node.supportSurfaceId! as AnyNodeId] as { position?: [number, number, number]; rotation?: [number, number, number] } | undefined
            const angle = host?.rotation?.[1] ?? 0
            const c = Math.cos(angle), s = Math.sin(angle)
            return [
              (host?.position?.[0] ?? 0) + c * node.position[0] + s * node.position[2],
              levelY + (host?.position?.[1] ?? 0) + node.position[1],
              (host?.position?.[2] ?? 0) - s * node.position[0] + c * node.position[2],
            ] as [number, number, number]
          })()
        : (() => {
            const floorPosition = getFloorStackPreviewPosition({
              node: node as unknown as AnyNode,
              position: node.position,
              levelId: activeLevelId,
            })
            return [floorPosition[0], floorPosition[1] + levelY, floorPosition[2]] as [
              number,
              number,
              number,
            ]
          })()
      cursor.current?.position.set(...position)
      cursor.current?.rotation.set(0, yaw, 0)
      setVisible(true)
      usePlacementPreview.getState().set(node as unknown as AnyNode)
    }
    refreshPreview.current = () => { if (last) move(last) }
    const click = (event: PlacementEvent) => {
      if (committed || isCameraDragging()) return
      if (
        event.nativeEvent &&
        'button' in event.nativeEvent &&
        event.nativeEvent.button !== 0
      )
        return
      const node = resolve(event)
      // One gesture produces one persistent node; the ghost never enters history.
      const { id: _previewId, ...fields } = node
      const placed = PergolaNode.parse(fields)
      committed = true
      useScene
        .getState()
        .createNode(placed as unknown as AnyNode, placed.parentId as AnyNodeId)
      selectNode(placed.id as AnyNodeId)
      event.nativeEvent?.stopPropagation()
      finish()
    }
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      )
        return
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      } else if (['r', 't'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        yaw += ((event.key.toLowerCase() === 'r' ? 1 : -1) * Math.PI) / 4
        if (last) move(last)
      }
    }
    emitter.on('grid:move', move)
    emitter.on('node:move', move)
    emitter.on('grid:click', click)
    emitter.on('node:click', click)
    window.addEventListener('keydown', key)
    return () => {
      emitter.off('grid:move', move)
      emitter.off('node:move', move)
      emitter.off('grid:click', click)
      emitter.off('node:click', click)
      window.removeEventListener('keydown', key)
      usePlacementPreview.getState().clear()
      refreshPreview.current = () => {}
    }
  }, [activeLevelId, selectNode, isCameraDragging])
  return (
    <group ref={cursor} visible={visible}>
      <PergolaPreview node={ghostNode} />
    </group>
  )
}
