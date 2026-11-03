'use client'
import { createElement, useEffect, useMemo } from 'react'
import { Mesh } from 'three'
import type { EdgingNode } from '../domain/schema'
import { buildEdgingGeometry } from './geometry'

export default function EdgingPreview({ node }: { node: EdgingNode }) {
  const group = useMemo(() => {
    const built = buildEdgingGeometry(node)
    built.traverse((object) => {
      object.raycast = () => {}
      if (!(object instanceof Mesh)) return
      object.castShadow = false
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.transparent = true
        material.opacity = 0.48
        material.depthWrite = false
      }
    })
    return built
  }, [node])
  useEffect(() => () => group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
  }), [group])
  return createElement('primitive', { object: group })
}
