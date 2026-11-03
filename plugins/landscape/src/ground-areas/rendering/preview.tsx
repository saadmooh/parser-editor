'use client'
import { useEffect, useMemo } from 'react'
import { Mesh } from 'three'
import type { GroundAreaNode } from '../domain/schema'
import { buildGroundAreaPreviewGeometry, disposeGroundAreaGeometry } from './geometry'

export default function GroundAreaPreview({ node }: { node: GroundAreaNode }) {
  const group = useMemo(() => {
    const group = buildGroundAreaPreviewGeometry(node)
    group.traverse((object) => {
      object.raycast = () => {}
      if (object instanceof Mesh) {
        object.material.transparent = true
        object.material.opacity = 0.62
        object.material.depthWrite = false
      }
    })
    return group
  }, [node])
  useEffect(() => () => disposeGroundAreaGeometry(group), [group])
  return <primitive object={group} />
}
