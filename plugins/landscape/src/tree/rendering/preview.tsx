'use client'
import { useEffect, useState } from 'react'
import type { LOD, Object3D } from 'three'
import type { TreeNode } from '../domain/schema'
import { acquireTreeGeometry, releaseTreeGeometry, treeDesignKey } from './prototype-cache'

export default function TreePreview({ node }: { node: TreeNode }) {
  const [group, setGroup] = useState<LOD | null>(null)
  const design = treeDesignKey(node)
  useEffect(() => {
    // Tool mode and placement changes do not change the tree design. Share the
    // same owned prototype with placements so finishing a brush cannot dispose
    // geometry still used by its newly created trees.
    const result = acquireTreeGeometry(node)
    result.traverse((object: Object3D) => { object.raycast = () => {} })
    setGroup(result)
    return () => releaseTreeGeometry(result)
  }, [design])
  return group ? <primitive object={group} dispose={null} /> : null
}
