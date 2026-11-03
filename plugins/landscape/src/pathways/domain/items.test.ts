import { expect, test } from 'bun:test'
import { lerp, type Curve } from './curves'
import { addCurves, PathwayGradeConflictError } from './network'
import { pathComponents } from './components'
import { planPathwayItems } from './items'
import { PathwayNode, type Point } from './schema'

const line = (a: Point, b: Point): Curve => [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]
const base = PathwayNode.parse({ parentId: 'level_test' })

test('merging existing crossings rejects incompatible heights without changing either saved route', () => {
  const first = PathwayNode.parse({ ...base, ...addCurves({ vertices: [], edges: [] }, [line([-4, 0], [4, 0])], 1) })
  const second = PathwayNode.parse({ ...base, id: undefined, ...addCurves({ vertices: [], edges: [] }, [line([0, -4], [0, 4])], 1) })
  first.vertices[1]!.elevationOffset = 2
  const before = JSON.stringify([first, second])
  expect(() => planPathwayItems([first, second], [], 1, first)).toThrow(PathwayGradeConflictError)
  expect(JSON.stringify([first, second])).toBe(before)
  second.vertices.forEach((vertex) => { vertex.elevationOffset = 1 })
  const joined = planPathwayItems([first, second], [], 1, first)
  expect(joined.update[0]!.edges).toHaveLength(4)
  expect(joined.update[0]!.vertices.find((vertex) => vertex.point[0] === 0 && vertex.point[1] === 0)?.elevationOffset).toBeCloseTo(1)
})

test('unconnected drawings become individually selectable pathway nodes', () => {
  const first = planPathwayItems([], [line([0, 0], [4, 0])], 1, base)
  expect(first.create).toHaveLength(1)
  const second = planPathwayItems(first.create, [line([20, 0], [24, 0])], 1, base)
  expect(second.create).toHaveLength(1)
  expect(second.update).toHaveLength(0)
  expect(second.delete).toEqual([])
  expect(second.create[0]!.id).not.toBe(first.create[0]!.id)
  expect(first.create[0]!.edges).toHaveLength(1)
})

test('a connecting stroke merges two items while keeping one original node ID', () => {
  const first = PathwayNode.parse({ ...base, ...addCurves({ vertices: [], edges: [] }, [line([0, 0], [4, 0])], 1) })
  const second = PathwayNode.parse({ ...base, id: undefined,
    ...addCurves({ vertices: [], edges: [] }, [line([8, 0], [12, 0])], 1) })
  const connected = planPathwayItems([first, second], [line([4, 0], [8, 0])], 1, first)
  expect(connected.create).toHaveLength(0)
  expect(connected.update).toHaveLength(1)
  expect(connected.update[0]!.id).toBe(first.id)
  expect(connected.delete).toEqual([second.id])
  expect(connected.update[0]!.edges).toHaveLength(3)
})

test('older disconnected graph splits into separate items without losing edges', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [
    line([0, 0], [4, 0]), line([20, 0], [24, 0]),
  ], 1)
  const old = PathwayNode.parse({ ...base, ...graph })
  expect(pathComponents(old).map((part) => part.edges.length)).toEqual([1, 1])
  const split = planPathwayItems([old], [], 1, old)
  expect(split.update.map((node) => node.id)).toEqual([old.id])
  expect(split.create).toHaveLength(1)
  expect(split.create[0]!.id).not.toBe(old.id)
})
