import { expect, test } from 'bun:test'
import { BoxGeometry } from 'three'
import { PathwayNode } from '../domain/schema'
import { gradePathwayMesh, pathwayGradeField } from './grade-mesh'
test('graded caps and undersides preserve thickness and receive finite normals', () => {
  const path = PathwayNode.parse({ vertices: [{ id: 'a', point: [0, 0] }, { id: 'b', point: [10, 0], elevationOffset: 1 }], edges: [{ id: 'ab', from: 'a', to: 'b', width: 1 }] })
  const original = new BoxGeometry(10, 0.1, 1)
  original.translate(5, 0.05, 0)
  const geometry = gradePathwayMesh(original, pathwayGradeField(path))
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index++) {
    const residual = positions.getY(index) - positions.getX(index) / 10
    expect(residual).toBeGreaterThanOrEqual(-1e-5)
    expect(residual).toBeLessThanOrEqual(0.10001)
  }
  expect(geometry.boundingBox!.min.y).toBeCloseTo(0)
  expect(geometry.boundingBox!.max.y).toBeCloseTo(1.1)
  expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
  geometry.dispose(); original.dispose()
})

test('branch grade transitions are continuous across the nearest-route boundary', () => {
  const path = PathwayNode.parse({ vertices: [{id:'j',point:[0,0]},{id:'x',point:[4,0],elevationOffset:4},{id:'z',point:[0,4],elevationOffset:2}], edges:[{id:'x',from:'j',to:'x',width:1},{id:'z',from:'j',to:'z',width:1}] })
  const field = pathwayGradeField(path)
  expect(field(2,0)).toBeCloseTo(2)
  expect(field(0,2)).toBeCloseTo(1)
  expect(field(0,0)).toBe(0)
  expect(Math.abs(field(0.5-1e-6,0.5) - field(0.5+1e-6,0.5))).toBeLessThan(1e-5)
  expect(field(0.5,0.5)).toBeCloseTo(0.375)
})

test('full pathway builder applies authored grade to paving and borders', async () => {
  const { buildPathwayGeometry, disposePathwayGeometry } = await import('./geometry')
  const { Box3, Mesh } = await import('three')
  const path = PathwayNode.parse({ vertices:[{id:'a',point:[0,0]},{id:'b',point:[10,0],elevationOffset:1}], edges:[{id:'e',from:'a',to:'b',width:1}], elevation:2, thickness:0.08 })
  const group = buildPathwayGeometry(path)
  const backing = group.children.find((child) => child.name === 'pathway-backing')!
  const bounds = new Box3().setFromObject(backing)
  expect(bounds.min.y).toBeCloseTo(2.005,3)
  expect(bounds.max.y).toBeCloseTo(3.085,3)
  let meshes = 0
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    meshes++
    const position = object.geometry.getAttribute('position')
    expect(Array.from(position.array).every(Number.isFinite)).toBe(true)
    const meshBounds = new Box3().setFromObject(object)
    expect(meshBounds.max.y).toBeGreaterThan(3)
  })
  expect(meshes).toBeGreaterThan(1)
  disposePathwayGeometry(group)
})
