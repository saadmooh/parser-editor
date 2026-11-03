'use client'
import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useEffect, useMemo } from 'react'
import { Mesh } from 'three'
import type { PergolaNode } from '../domain/schema'
import { buildPergolaGeometry, disposePergolaGeometry } from './geometry'

export default function PergolaPreview({ node }: { node: PergolaNode }) {
  const parent = useScene((state) =>
    node.supportSurfaceId ? state.nodes[node.supportSurfaceId as AnyNodeId] ?? null : null,
  )
  const group = useMemo(() => {
    const built = buildPergolaGeometry(node, { parent } as Parameters<typeof buildPergolaGeometry>[1])
    built.traverse((object) => {
      object.raycast = () => {}
      if (object instanceof Mesh) {
        object.castShadow = false
        for (const m of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          m.transparent = true
          m.opacity = 0.45
          m.depthWrite = false
        }
      }
    })
    return built
  }, [node, parent])
  useEffect(() => () => disposePergolaGeometry(group), [group])
  return <primitive object={group} />
}
