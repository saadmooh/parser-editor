import { expect, test } from 'bun:test'
import { Mesh } from 'three'
import { lerp, type Curve } from '../domain/curves'
import { addCurves } from '../domain/network'
import { PathwayNode, type Point } from '../domain/schema'
import { buildPathwayGeometry, disposePathwayGeometry } from './geometry'

const line = (a: Point, b: Point): Curve => [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]

test('stone and border bevels can be changed independently and survive a save', () => {
  const graph = addCurves({ vertices: [], edges: [] }, [line([0, 0], [3, 0])], 1.8)
  const base = PathwayNode.parse({ ...graph, finish: 'laidStone' })
  expect(base.stoneEdge).toBe('soft')
  expect(base.borderEdge).toBe('soft')
  const counts = (stoneEdge: 'sharp' | 'soft' | 'rounded', borderEdge: 'sharp' | 'soft' | 'rounded') => {
    const node = PathwayNode.parse(JSON.parse(JSON.stringify({ ...base, stoneEdge, borderEdge })))
    const mesh = buildPathwayGeometry(node)
    const groups = mesh.children.filter((child): child is Mesh => child instanceof Mesh)
    const vertices = groups.map((child) => child.geometry.getAttribute('position').count)
    expect(vertices.every((count) => count > 0)).toBe(true)
    disposePathwayGeometry(mesh)
    return vertices
  }
  const sharp = counts('sharp', 'sharp')
  const smoothStone = counts('rounded', 'sharp')
  const smoothBorder = counts('sharp', 'rounded')
  expect(smoothStone).not.toEqual(sharp)
  expect(smoothBorder).not.toEqual(sharp)
})
