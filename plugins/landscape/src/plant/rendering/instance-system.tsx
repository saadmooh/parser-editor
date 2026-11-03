'use client'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useScene } from '@pascal-app/core'
import { PLANT_KIND } from '../domain/schema'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import { PlantInstanceBatches } from './instance-batches'
import { scenePlants, type RegisteredPlant } from './instance-registry'

export default function PlantInstanceSystem() {
  const scene = useThree((state) => state.scene)
  const batches = useMemo(() => new PlantInstanceBatches(), [])
  const hovered = useRef<RegisteredPlant | null>(null)
  useEffect(() => () => {
    batches.dispose()
  }, [batches, scene])
  useFrame(() => {
    const state = useViewer.getState()
    const promoted = new Set<string>([
      ...state.selection.selectedIds, ...state.previewSelectedIds, ...state.externalSelectedIds,
      ...(state.hoveredId ? [state.hoveredId] : []),
    ])
    batches.update(scenePlants(scene), promoted, state.isExporting)
  })
  useFrame(() => {
    const state = useScene.getState()
    // Clear after the host's priority-1 floor elevation pass has applied the lift.
    for (const id of state.dirtyNodes) if ((state.nodes[id]?.type as string) === PLANT_KIND) state.clearDirty(id)
  }, 2)
  const resolve = <E extends PointerEvent | MouseEvent,>(event: ThreeEvent<E>) => {
    const slot = batches.resolve(event.object, event.instanceId)
    if (!slot) return null
    const plant = slot.placement as RegisteredPlant
    // Use the real per-node mesh for local coordinates, outlines and tools.
    slot.part.updateWorldMatrix(true, false)
    return { plant, event: { ...event, object: slot.part } }
  }
  const forwardPointer = (key: 'onPointerDown' | 'onPointerUp', event: ThreeEvent<PointerEvent>) => {
    const hit = resolve(event)
    if (hit) hit.plant.handlers[key](hit.event)
  }
  const forwardMouse = (key: 'onDoubleClick' | 'onContextMenu', event: ThreeEvent<MouseEvent>) => {
    const hit = resolve(event)
    // The viewer types these two mouse handlers as pointer handlers, although
    // they only read fields common to both event types.
    if (hit) hit.plant.handlers[key](hit.event as unknown as ThreeEvent<PointerEvent>)
  }
  return <primitive object={batches.root} dispose={null}
    onPointerDown={(event: ThreeEvent<PointerEvent>) => forwardPointer('onPointerDown', event)}
    onPointerUp={(event: ThreeEvent<PointerEvent>) => forwardPointer('onPointerUp', event)}
    onDoubleClick={(event: ThreeEvent<MouseEvent>) => forwardMouse('onDoubleClick', event)}
    onContextMenu={(event: ThreeEvent<MouseEvent>) => forwardMouse('onContextMenu', event)}
    onPointerMove={(event: ThreeEvent<PointerEvent>) => {
      const hit = resolve(event)
      if (!hit || useViewer.getState().cameraDragging) return
      if (hovered.current !== hit.plant) {
        if (hovered.current) hovered.current.handlers.onPointerLeave({ ...event, object: hovered.current.root })
        hovered.current = hit.plant
        hit.plant.handlers.onPointerEnter(hit.event)
      }
      hit.plant.handlers.onPointerMove(hit.event)
    }}
    onPointerOut={(event: ThreeEvent<PointerEvent>) => {
      const previous = hovered.current
      hovered.current = null
      if (previous) previous.handlers.onPointerLeave({ ...event, object: previous.root })
    }} />
}
