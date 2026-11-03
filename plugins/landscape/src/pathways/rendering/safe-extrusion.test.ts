import { expect, test } from 'bun:test'
import { Box3, Mesh } from 'three'
import { extrudePaving } from './safe-extrusion'
import { addCurves } from '../domain/network'
import { PathwayNode } from '../domain/schema'
import type { Curve } from '../domain/curves'
import { buildPathwayGeometry, disposePathwayGeometry } from './geometry'

test('collapsed holes are removed and invalid exterior rings are skipped', () => {
  const geometry = extrudePaving([
    [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
    [[1, 1], [1, 1], [1, 1]],
  ], { depth: 0.1, bevelEnabled: false })
  expect(geometry?.getAttribute('position').count).toBeGreaterThan(0)
  geometry?.dispose()
  expect(extrudePaving([[[0, 0], [1, 0], [2, 0]]], {})).toBeNull()
  expect(extrudePaving([[[NaN, 0], [1, 0], [0, 1]]], {})).toBeNull()
})

test('wide tight curves and closing loop holes remain renderable', () => {
  const routes: Curve[][] = [
    [[[0, 0], [0, 3], [1, -3], [1, 0]]],
    [[[0, 0], [4, 0], [4, 4], [0, 4]], [[0, 4], [-4, 4], [-4, 0], [0, 0]]],
  ]
  for (const route of routes) for (const width of [1.2, 3, 4, 6, 10]) {
    for (const finish of ['concrete', 'concreteSlabs', 'laidStone'] as const) {
      const graph = addCurves({ vertices: [], edges: [] }, route, width, 'spline')
      const mesh = buildPathwayGeometry(PathwayNode.parse({ ...graph, finish }))
      expect(new Box3().setFromObject(mesh).isEmpty()).toBe(false)
      mesh.traverse((child) => {
        if (child instanceof Mesh)
          expect(Array.from(child.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
      })
      disposePathwayGeometry(mesh)
    }
  }
})
