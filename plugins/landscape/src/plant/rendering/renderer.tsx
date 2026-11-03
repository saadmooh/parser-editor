'use client'
import { type AnyNodeId, useLiveNodeOverrides, useLiveTransforms, useRegistry } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import { PLANT_KIND, type PlantNode } from '../domain/schema'
import { buildPlantGeometry, disposePlantGeometry } from './geometry'
import FabModel from './fab-model'
import ClaudeTree, { isClaudeTree } from './claude-tree'

export default function PlantRenderer({ node }: { node: PlantNode }) {
  const ref = useRef<Group>(null!)
  useRegistry(node.id, PLANT_KIND, ref)
  const handlers = useNodeEvents(node as never, PLANT_KIND as never)
  const liveTransform = useLiveTransforms((state) => state.get(node.id as AnyNodeId))
  const override = useLiveNodeOverrides((state) => state.overrides.get(node.id))
  const design = JSON.stringify([node.preset, node.scale, node.density, node.variation, node.seed, node.tint])
  const plant = useMemo(() => node.preset.startsWith('fab:') || isClaudeTree(node.preset)
    ? null : buildPlantGeometry(node), [design])
  useEffect(() => () => { if (plant) disposePlantGeometry(plant) }, [plant])
  const position = liveTransform?.position ?? (override?.position as PlantNode['position'] | undefined) ?? node.position
  const rotation = liveTransform?.rotation ?? (override?.rotation as PlantNode['rotation'] | undefined)?.[1] ?? node.rotation[1]
  return <group ref={ref} position={position} rotation={[0, rotation, 0]}
    visible={node.visible !== false} {...handlers}>
    {node.preset.startsWith('fab:') ? <FabModel node={node} instanced />
      : isClaudeTree(node.preset) ? <ClaudeTree node={node} />
        : plant && <primitive object={plant} />}
  </group>
}
