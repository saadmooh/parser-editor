'use client'
import { type AnyNode, useScene } from '@pascal-app/core'
import { useEffect } from 'react'
import { PERGOLA_KIND } from '../domain/schema'
import { resolvePergolaSupportPatch } from '../domain/support-state'

/** Parents hosted pergolas to their surface and keeps their local foot height current. */
export default function PergolaSupportSurfaceSystem() {
  const nodes = useScene((state) => state.nodes)

  useEffect(() => {
    const tracking = useScene.temporal.getState().isTracking
    try {
      if (tracking) useScene.temporal.getState().pause()
      for (const raw of Object.values(nodes)) {
        if (String(raw.type) !== PERGOLA_KIND) continue
        const patch = resolvePergolaSupportPatch(raw, nodes)
        if (patch) useScene.getState().updateNode(raw.id, patch as Partial<AnyNode>)
      }
    } finally {
      if (tracking) useScene.temporal.getState().resume()
    }
  }, [nodes])

  return null
}
