import { test, expect } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { PathwayNode } from '../pathways/domain/schema'
import { landscapeDesignChecks } from './design-checks'

test('review identifies disconnected path networks and unused junctions', () => {
  const path = PathwayNode.parse({ vertices: [{id:'a',point:[0,0]},{id:'b',point:[3,0]},{id:'c',point:[5,0]},{id:'d',point:[8,0]},{id:'e',point:[9,9]}],edges:[{id:'ab',from:'a',to:'b',width:1},{id:'cd',from:'c',to:'d',width:1}] })
  expect(landscapeDesignChecks([path as unknown as AnyNode]).map((issue) => issue.message)).toEqual(['1 unused walkway junction.', 'Walkway contains 2 disconnected networks. Confirm this is intentional.'])
})
test('review uses existing outline validation and accepts a valid area', () => {
  const valid = GroundAreaNode.parse({outline:[[0,0],[3,0],[3,3],[0,3]]})
  expect(landscapeDesignChecks([valid as unknown as AnyNode])).toEqual([])
  const empty = GroundAreaNode.parse({})
  expect(landscapeDesignChecks([empty as unknown as AnyNode])[0]?.message).toContain('at least three')
})
