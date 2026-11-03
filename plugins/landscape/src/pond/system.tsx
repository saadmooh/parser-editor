'use client'
import SurfaceBoundarySystem from '../ground-access/shared/boundary-system'
import { useScene } from '@pascal-app/core'
import { useEffect } from 'react'
import { syncPondTerrain } from './terrain-sync'
import { pondTerrainInputKey } from './terrain-input'
import PondTerrainAppearance from './terrain-appearance'
export default function PondSystem() {
  useEffect(() => {
    let queued = false, disposed = false
    const schedule = () => {
      if (queued || disposed) return
      queued = true
      queueMicrotask(() => { queued = false; if (!disposed) syncPondTerrain() })
    }
    let key = pondTerrainInputKey(useScene.getState().nodes)
    schedule()
    const unsubscribe = useScene.subscribe(current => {
      const next = pondTerrainInputKey(current.nodes)
      if (next !== key) { key = next; schedule() }
    })
    return () => { disposed = true; unsubscribe() }
  }, [])
  return <><SurfaceBoundarySystem kind="landscape:pond" /><PondTerrainAppearance /></>
}
