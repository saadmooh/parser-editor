'use client'
import { landscapeToolColors } from '../shared/tool-colors'
import { nodeRegistry } from '@pascal-app/core'
import { useEffect, useMemo } from 'react'
import { Group, Mesh, MeshBasicMaterial } from 'three'
import type { IrrigationPlan } from './network'

/** Feed pipes remain visible above the ground while reviewing placement. */
export function IrrigationRoutePreview({ plan }: { plan: IrrigationPlan | null }) {
  const group = useMemo(() => {
    const group = new Group()
    const material = new MeshBasicMaterial({ color: landscapeToolColors.draft, transparent: true, opacity: .8, depthTest: false, depthWrite: false })
    for (const node of plan?.create ?? []) {
      if (!['landscape:irrigation-run', 'landscape:irrigation-fitting'].includes(node.type)) continue
      const object = nodeRegistry.get(node.type)?.geometry?.(node, {} as never)
      if (!(object instanceof Group)) continue
      const posed = node as unknown as { position?: [number, number, number]; rotation?: [number, number, number] }
      if (posed.position) object.position.set(...posed.position)
      if (posed.rotation) object.rotation.set(...posed.rotation)
      object.traverse(part => {
        part.raycast = () => {}
        if (part instanceof Mesh) {
          for (const old of Array.isArray(part.material) ? part.material : [part.material]) old.dispose()
          part.material = material; part.renderOrder = 1000
        }
      })
      group.add(object)
    }
    group.userData.previewMaterial = material
    return group
  }, [plan])
  useEffect(() => () => {
    group.traverse(part => { if (part instanceof Mesh) part.geometry.dispose() })
    group.userData.previewMaterial.dispose()
  }, [group])
  return <primitive object={group} dispose={null} />
}
