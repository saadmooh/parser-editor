'use client'

import { sceneRegistry, useScene, type AnyNodeId } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import GroundAreaBoundarySystem from '../editor/boundary-system'
import { PoolCutoutDirtySystem } from '../../shared/pool-cutout-system'
import { affectedGrassAreaIds } from './footprint-invalidation'
import { GROUND_AREA_KIND, type GroundAreaNode } from '../domain/schema'
import { Grass2Stream } from './grass2-stream'
import { updateGrass2Wind } from './grass2'

export function onlyGrassWindChanged(previous: GroundAreaNode, current: GroundAreaNode) {
  if (previous.surface !== 'grass2' || current.surface !== 'grass2' ||
    previous.grass2Settings.wind === current.grass2Settings.wind) return false
  const withoutWind = (node: GroundAreaNode) => JSON.stringify({ ...node,
    grass2Settings: { ...node.grass2Settings, wind: 0 } })
  return withoutWind(previous) === withoutWind(current)
}

export default function GrassFootprintSystem() {
  useEffect(() => useScene.subscribe((current, previous) => {
    if (current.nodes === previous.nodes) return
    const changed = Object.keys(current.nodes).filter((id) => current.nodes[id as AnyNodeId] !== previous.nodes[id as AnyNodeId])
    if (changed.length === 1 && Object.keys(current.nodes).length === Object.keys(previous.nodes).length) {
      const id = changed[0]! as AnyNodeId
      const before = previous.nodes[id], after = current.nodes[id]
      if ((before?.type as string) === GROUND_AREA_KIND && (after?.type as string) === GROUND_AREA_KIND && !previous.dirtyNodes.has(id) &&
        onlyGrassWindChanged(before as unknown as GroundAreaNode, after as unknown as GroundAreaNode)) {
        const stream = sceneRegistry.nodes.get(id)?.getObjectByName('ground-area-grass2-stream')
        if (stream instanceof Grass2Stream) {
          updateGrass2Wind(stream, (after as unknown as GroundAreaNode).grass2Settings.wind)
          current.clearDirty(id)
        }
      }
    }
    for (const id of affectedGrassAreaIds(current.nodes, previous.nodes))
      current.markDirty(id as AnyNodeId)
  }), [])
  useFrame(({ size, gl }) => {
    const ids = (sceneRegistry.byType as Record<string, Set<string> | undefined>)[GROUND_AREA_KIND]
    if (!ids) return
    for (const id of ids) {
      const stream = sceneRegistry.nodes.get(id)?.getObjectByName('ground-area-grass2-stream')
      if (stream instanceof Grass2Stream) stream.setViewportHeight(size.height * gl.getPixelRatio())
    }
  }, 1)
  return <><PoolCutoutDirtySystem /><GroundAreaBoundarySystem /></>
}
