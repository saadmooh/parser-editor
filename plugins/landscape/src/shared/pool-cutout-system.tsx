'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useEffect } from 'react'
import { affectedPoolCutoutSurfaceIds } from './pool-cutout-invalidation'

/** Rebuilds landscape geometry when a pool changes its opening footprint. */
export function PoolCutoutDirtySystem() {
  useEffect(() => useScene.subscribe((current, previous) => {
    if (current.nodes === previous.nodes) return
    for (const id of affectedPoolCutoutSurfaceIds(current.nodes, previous.nodes))
      current.markDirty(id as AnyNodeId)
  }), [])
  return null
}

export default function LandscapePoolCutoutSystem() {
  return <PoolCutoutDirtySystem />
}
