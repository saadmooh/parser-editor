'use client'
import { type AnyNodeId, useLiveNodeOverrides, useLiveTransforms, useRegistry } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { type Group, type Mesh } from 'three'
import { IrrigationHeadNode, IRRIGATION_HEAD_KIND } from './schema'
import { irrigationHeadGeometry } from './geometry'
import { useWateringPlayback, devicePreviewEnabled } from './playback'
import { createSprinklerSpray, updateSprinklerSpray } from './spray'

export default function IrrigationHeadRenderer({ node }: { node: IrrigationHeadNode }) {
  const playback = useWateringPlayback()
  const enabled = devicePreviewEnabled(node.id, playback)
  const ref = useRef<Group>(null!)
  useRegistry(node.id, IRRIGATION_HEAD_KIND, ref)
  const handlers = useNodeEvents(node as never, IRRIGATION_HEAD_KIND as never)
  const live = useLiveTransforms(s => s.get(node.id as AnyNodeId))
  const override = useLiveNodeOverrides(s => s.overrides.get(node.id))
  const design = IrrigationHeadNode.parse({ ...node, ...override })
  const geometry = useMemo(() => irrigationHeadGeometry(design), [design.radius, design.arc, design.showCoverage, design.zone, design.zoneId])
  const spray = useMemo(() => createSprinklerSpray(design), [design.radius, design.arc])
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => () => {
    geometry.traverse(object => {
      const mesh = object as Mesh
      mesh.geometry?.dispose()
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
    })
  }, [geometry])
  useEffect(() => () => { spray.geometry.dispose(); spray.material.dispose() }, [spray])
  useEffect(() => {
    const resume = () => invalidate()
    document.addEventListener('visibilitychange', resume)
    invalidate()
    return () => document.removeEventListener('visibilitychange', resume)
  }, [invalidate, design.showSpray, design.visible, design.flow, enabled])
  useFrame(({ clock }) => {
    if (!enabled || !design.showSpray || design.flow <= 0 || document.visibilityState === 'hidden') return
    for (let object = ref.current; object; object = object.parent as Group) if (!object.visible) return
    updateSprinklerSpray(spray, design, clock.elapsedTime)
    invalidate()
  })
  return <group ref={ref} position={live?.position ?? design.position} rotation={[0, live?.rotation ?? design.rotation[1], 0]} visible={design.visible !== false} {...handlers}>
    <primitive object={geometry} dispose={null} />
    <primitive object={spray} visible={enabled && design.showSpray && design.flow > 0} dispose={null} />
  </group>
}
