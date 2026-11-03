'use client'
import { useEffect, useMemo } from 'react'
import { Mesh } from 'three'
import type { PathwayNode } from '../domain/schema'
import { buildPathwayGeometry, disposePathwayGeometry } from './geometry'

export default function PathwayPreview({ node }: { node: PathwayNode }) {
  const group = useMemo(() => {
    const group = buildPathwayGeometry(node)
    group.traverse((object) => {
      object.raycast = () => {}
      if (object instanceof Mesh) {
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          material.transparent = true
          material.opacity = 0.55
          material.depthWrite = false
        }
      }
    })
    return group
  }, [node])
  useEffect(() => () => disposePathwayGeometry(group), [group])
  return <primitive object={group} />
}
