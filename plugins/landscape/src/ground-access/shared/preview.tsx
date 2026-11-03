'use client'
import { createElement, useEffect, useMemo } from 'react'
import { Mesh } from 'three'
import { buildAccessGeometry, disposeAccessGeometry, type AccessKind } from './geometry'
import type { AccessShape } from './schema'
import { buildPatioGeometry } from '../patio/rendering/geometry'
import type { PatioNode } from '../patio/domain/schema'
import { buildDeckGeometry } from '../deck/rendering/geometry'
import type { DeckNode } from '../deck/domain/schema'

export default function AccessPreview({ node }: { node: AccessShape & { type: string } }) {
  const group = useMemo(() => {
    const built = node.type === 'landscape:patio'
      ? buildPatioGeometry(node as PatioNode)
      : node.type === 'landscape:deck' ? buildDeckGeometry(node as DeckNode)
      : buildAccessGeometry(node, node.type.slice('landscape:'.length) as AccessKind)
    built.traverse((object) => {
      object.raycast = () => {}
      if (!(object instanceof Mesh)) return
      object.castShadow = false
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.transparent = true
        material.opacity = 0.45
        material.depthWrite = false
      }
    })
    return built
  }, [node])
  useEffect(() => () => disposeAccessGeometry(group), [group])
  return createElement('primitive', { object: group })
}
