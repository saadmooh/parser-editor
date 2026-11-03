'use client'
import { useEffect, useMemo } from 'react'
import type { Object3D } from 'three'
import type { PlantNode } from '../domain/schema'
import { buildPlantGeometry, disposePlantGeometry } from './geometry'
import FabModel from './fab-model'
import ClaudeTree, { isClaudeTree } from './claude-tree'

export default function PlantPreview({ node }: { node: PlantNode }) {
  if (node.preset.startsWith('fab:')) return <FabModel node={node} />
  if (isClaudeTree(node.preset)) return <ClaudeTree node={node} />
  return <ProceduralPreview node={node} />
}

function ProceduralPreview({ node }: { node: PlantNode }) {
  const design = JSON.stringify([node.preset, node.scale, node.density, node.variation, node.seed, node.tint])
  const group = useMemo(() => {
    const result = buildPlantGeometry(node)
    result.traverse((object: Object3D) => { object.raycast = () => {} })
    return result
  }, [design])
  useEffect(() => () => disposePlantGeometry(group), [group])
  return <primitive object={group} />
}
