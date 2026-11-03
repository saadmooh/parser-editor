import { expect, test } from 'bun:test'
import { PathwayNode } from './schema'
import { insertPathCurvePoint } from './edit-curve'
import { edgeGradeProfile } from './grade'
const edge = { id: 'edge', from: 'a', to: 'b', width: 1 }
test('old flat paths retain base elevation while explicit offsets grade by station', () => {
  const path = PathwayNode.parse({ elevation: 2, vertices: [{ id: 'a', point: [0, 0] }, { id: 'b', point: [10, 0] }], edges: [edge] })
  expect(edgeGradeProfile(path, path.edges[0]!).samples.every((point) => point.elevation === 2)).toBe(true)
  const graded = PathwayNode.parse({ ...path, vertices: [path.vertices[0], { ...path.vertices[1], elevationOffset: 1 }] })
  const profile = edgeGradeProfile(graded, graded.edges[0]!)
  expect(profile.slopePercent).toBeCloseTo(10)
  expect(profile.samples[0]!.elevation).toBe(2)
  expect(profile.samples.at(-1)!.elevation).toBe(3)
})


test('inserting a junction preserves the authored grade rather than resetting it', () => {
  const path = PathwayNode.parse({ vertices: [{ id: 'a', point: [0, 0], elevationOffset: 2 }, { id: 'b', point: [10, 0], elevationOffset: 4 }], edges: [edge] })
  const inserted = insertPathCurvePoint(path, 'edge', 0.25)!
  expect(inserted.vertices.at(-1)!.elevationOffset).toBeCloseTo(2.5)
  const graded = PathwayNode.parse({ ...path, ...inserted })
  expect(edgeGradeProfile(graded, graded.edges[0]!).slopePercent).toBeCloseTo(20)
  expect(edgeGradeProfile(graded, graded.edges[1]!).slopePercent).toBeCloseTo(20)
})

test('segment bearing uses parent-local clockwise axes and is undefined for coincident endpoints', () => {
  for (const [point, expected] of [[[0, -10], 0], [[10, 0], 90], [[0, 10], 180], [[-10, 0], 270]] as const) {
    const path = PathwayNode.parse({ vertices: [{ id: 'a', point: [0, 0] }, { id: 'b', point }], edges: [edge] })
    expect(edgeGradeProfile(path, path.edges[0]!).bearingDegrees).toBeCloseTo(expected)
  }
  const path = PathwayNode.parse({ vertices: [{ id: 'a', point: [0, 0] }, { id: 'b', point: [0, 0] }], edges: [edge] })
  expect(edgeGradeProfile(path, path.edges[0]!).bearingDegrees).toBeNull()
})
