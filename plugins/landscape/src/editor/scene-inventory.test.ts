import { expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { catalogMatches, levelDescendants } from './scene-inventory'

test('inventory includes grouped descendants and excludes other levels', () => {
  const nodes = Object.fromEntries([
    { id: 'group', parentId: 'level' }, { id: 'plant', parentId: 'group' },
    { id: 'other', parentId: 'other-level' },
  ].map((node) => [node.id, node])) as unknown as Record<string, AnyNode>
  expect(levelDescendants(nodes, 'level').map((node) => String(node.id))).toEqual(['group', 'plant'])
  expect(levelDescendants(nodes, null)).toEqual([])
})

test('malformed hierarchy cannot loop forever', () => {
  const nodes = { a: { id: 'a', parentId: 'b' }, b: { id: 'b', parentId: 'a' } } as unknown as Record<string, AnyNode>
  expect(levelDescendants(nodes, 'a').map((node) => String(node.id))).toEqual(['b'])
})

test('search combines category and name words', () => {
  expect(catalogMatches('Pampas grass', 'Grasses and meadows', 'meadows pampas')).toBe(true)
  expect(catalogMatches('Pampas grass', 'Grasses and meadows', 'pine')).toBe(false)
})
