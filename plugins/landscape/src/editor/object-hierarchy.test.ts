import { expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { objectHierarchy } from './object-hierarchy'

test('matching objects retain nested ancestors and share one parent branch', () => {
  const nodes = Object.fromEntries([
    { id: 'level', parentId: 'building' }, { id: 'group', parentId: 'level' },
    { id: 'plant', parentId: 'group' }, { id: 'tree', parentId: 'group' },
    { id: 'unmatched', parentId: 'level' }, { id: 'building' },
  ].map((node) => [node.id, node])) as unknown as Record<string, AnyNode>
  const roots = objectHierarchy(nodes, 'level', [nodes.plant!, nodes.tree!])
  expect(roots.map((branch) => String(branch.node.id))).toEqual(['level'])
  expect(roots[0]!.landscape).toBe(false)
  expect(roots[0]!.children[0]!.children.map((branch) => String(branch.node.id))).toEqual(['plant', 'tree'])
  expect(roots[0]!.children[0]!.children.every((branch) => branch.landscape)).toBe(true)
})

test('missing parents and cycles remain inspectable without recursive branches', () => {
  const nodes = { a: { id: 'a', parentId: 'b' }, b: { id: 'b', parentId: 'a' }, orphan: { id: 'orphan', parentId: 'missing' } } as unknown as Record<string, AnyNode>
  const roots = objectHierarchy(nodes, 'level', [nodes.a!, nodes.orphan!])
  expect(roots.map((branch) => String(branch.node.id))).toEqual(['a', 'b', 'orphan'])
  expect(roots.every((branch) => !branch.children.length)).toBe(true)
  expect(objectHierarchy(nodes, null, [])).toEqual([])
})
