import { expect, test } from 'bun:test'
import { Mesh } from 'three'
import { TreeNode } from '../domain/schema'
import { acquireTreeGeometry, releaseTreeGeometry, treeDesignKey } from './prototype-cache'

test('preview and placed tree retain shared geometry until the last owner releases it', () => {
  const node = TreeNode.parse({ species: 'whiteOak' })
  const preview = acquireTreeGeometry(node)
  const placed = acquireTreeGeometry({ ...node, position: [8, 0, 2] })
  const meshes: Mesh[] = []
  preview.traverse((object) => { if (object instanceof Mesh && !object.geometry.userData.shared) meshes.push(object) })
  expect(meshes.length).toBeGreaterThan(0)
  const geometry = meshes[0]!.geometry
  let disposed = 0
  geometry.addEventListener('dispose', () => disposed++)
  expect(treeDesignKey(node)).toBe(treeDesignKey({ ...node, position: [8, 0, 2] }))
  releaseTreeGeometry(preview)
  expect(disposed).toBe(0)
  releaseTreeGeometry(placed)
  expect(disposed).toBe(1)
})
