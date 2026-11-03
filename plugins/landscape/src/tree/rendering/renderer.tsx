'use client'

import { type AnyNodeId, useLiveNodeOverrides, useLiveTransforms, useRegistry } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useRef, useState } from 'react'
import type { Group, LOD } from 'three'
import { TREE_KIND, type TreeNode } from '../domain/schema'
import { acquireTreeGeometry, releaseTreeGeometry, treeDesignKey } from './prototype-cache'

export default function TreeRenderer({ node }: { node: TreeNode }) {
  const ref = useRef<Group>(null!)
  useRegistry(node.id, TREE_KIND, ref)
  const handlers = useNodeEvents(node as never, TREE_KIND as never)
  const liveTransform = useLiveTransforms((state) => state.get(node.id as AnyNodeId))
  const override = useLiveNodeOverrides((state) => state.overrides.get(node.id))
  const designKey = treeDesignKey(node)
  const [tree, setTree] = useState<LOD | null>(null)
  useEffect(() => {
    const acquired = acquireTreeGeometry(node)
    setTree(acquired)
    return () => releaseTreeGeometry(acquired)
  }, [designKey])

  const position = liveTransform?.position ?? (override?.position as TreeNode['position'] | undefined) ?? node.position
  const rotation = liveTransform?.rotation ?? (override?.rotation as TreeNode['rotation'] | undefined)?.[1] ?? node.rotation[1]
  return <group ref={ref} position={position} rotation={[0, rotation, 0]}
    visible={node.visible !== false} {...handlers}>
    {tree && <primitive object={tree} />}
  </group>
}
