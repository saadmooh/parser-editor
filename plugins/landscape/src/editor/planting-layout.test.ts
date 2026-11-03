import { expect, test } from 'bun:test'
import { areaPlanting, containsPoint, pathPlanting } from './planting-layout'
import { PathwayNode } from '../pathways/domain/schema'
const options = { spacing: 1, setback: 0.4, seed: 7, natural: false, limit: 500 }

test('area planting respects concave boundaries, setback, spacing and existing plants', () => {
  const outline: [number, number][] = [[0,0],[5,0],[5,2],[2,2],[2,5],[0,5]]
  const { points } = areaPlanting(outline, options, [[0.5,0.5]])
  expect(points.length).toBeGreaterThan(0)
  for (const point of points) {
    expect(containsPoint(point, outline)).toBe(true)
    expect(Math.hypot(point[0] - 0.5, point[1] - 0.5)).toBeGreaterThanOrEqual(1)
    for (const other of points) if (other !== point) expect(Math.hypot(point[0]-other[0], point[1]-other[1])).toBeGreaterThanOrEqual(1)
  }
})
test('natural layouts are deterministic and capped', () => {
  const outline: [number, number][] = [[0,0],[10,0],[10,10],[0,10]]
  const settings = { ...options, natural: true, limit: 5 }
  expect(areaPlanting(outline, settings)).toEqual(areaPlanting(outline, settings))
  expect(areaPlanting(outline, settings).points).toHaveLength(5)
  expect(areaPlanting(outline, settings).truncated).toBe(true)
})
test('path planting offsets from pavement edges and respects repeat spacing', () => {
  const path = PathwayNode.parse({ vertices: [{id:'a',point:[0,0]},{id:'b',point:[4,0]}], edges:[{id:'e',from:'a',to:'b',width:2}] })
  const layout = pathPlanting(path, options, 'both')
  expect(layout.points).toHaveLength(8)
  expect(layout.points[0]).toEqual([0.5,1.4])
  expect(layout.points[1]).toEqual([0.5,-1.4])
})

test('path planting preserves station heights for both sides and rejected occupied candidates', () => {
  const path = PathwayNode.parse({ elevation: 3, vertices: [{id:'a',point:[0,0],elevationOffset:1},{id:'b',point:[4,0],elevationOffset:3}], edges:[{id:'e',from:'a',to:'b',width:2}] })
  const layout = pathPlanting(path, options, 'both', [[0.5,1.4]])
  expect(layout.points).toHaveLength(7)
  expect(layout.elevationOffsets).toEqual([1.25,1.75,1.75,2.25,2.25,2.75,2.75])
  const capped = pathPlanting(path, {...options,limit:2}, 'both')
  expect(capped.elevationOffsets).toEqual([1.25,1.25])
  expect(capped.truncated).toBe(true)
})
