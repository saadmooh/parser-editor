'use client'
import { type AnyNodeId, useScene, useLiveNodeOverrides, useLiveTransforms, useRegistry } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import { type Group, type Mesh } from 'three'
import { IrrigationControllerNode, IRRIGATION_CONTROLLER_KIND } from './controller'
import { irrigationControllerGeometry } from './controller-model'
import { controllerLinksGeometry } from './controller-links'

export default function IrrigationControllerRenderer({ node }: { node: IrrigationControllerNode }) {
  const ref = useRef<Group>(null!)
  useRegistry(node.id, IRRIGATION_CONTROLLER_KIND, ref)
  const handlers = useNodeEvents(node as never, IRRIGATION_CONTROLLER_KIND as never)
  const nodes = useScene(s => s.nodes), overrides = useLiveNodeOverrides(s => s.overrides), transforms = useLiveTransforms(s => s.transforms)
  const resolve = (id: string) => {
    const raw = nodes[id as AnyNodeId], live = transforms.get(id)
    if (!raw) return undefined
    return { ...raw, ...overrides.get(id), ...(live?.position ? { position: live.position } : {}), ...(live?.rotation !== undefined ? { rotation: [0, live.rotation, 0] } : {}) }
  }
  const design = IrrigationControllerNode.parse(resolve(node.id) ?? node)
  const cabinet = useMemo(() => irrigationControllerGeometry(design), [design.enabled, design.startTime, JSON.stringify(design.stations), JSON.stringify(design.wateringDays)])
  const links = useMemo(() => controllerLinksGeometry(design, resolve), [nodes, overrides, transforms, node])
  const dispose = (group: Group) => group.traverse(object => {
    const mesh = object as Mesh; mesh.geometry?.dispose()
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
  useEffect(() => () => dispose(cabinet), [cabinet])
  useEffect(() => () => dispose(links), [links])
  return <group ref={ref} position={design.position} rotation={design.rotation} visible={design.visible} {...handlers}><primitive object={cabinet} dispose={null} /><primitive object={links} dispose={null} /></group>
}
