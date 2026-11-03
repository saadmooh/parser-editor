import { expect, test } from 'bun:test'
import { groundAreaDefinition } from '../definition'
import { GroundAreaNode } from './schema'

test('ground area tool can initialize before an outline is drawn', () => {
  const defaults = groundAreaDefinition.defaults()
  const draft = GroundAreaNode.parse({
    ...defaults,
    name: 'Ground area grass',
    parentId: 'level_demo',
    surface: 'grass',
  })
  expect(draft.outline).toEqual([])
})
