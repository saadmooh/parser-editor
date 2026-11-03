import { expect, test } from 'bun:test'
import { railFootprint } from './rail-joins'

for (const vertices of [
  [[0, 0], [4, 0], [4, 3], [0, 3]],
  [[0, 3], [4, 3], [4, 0], [0, 0]],
  [[0, 0], [4, 0], [3, 2], [0, 3]],
  [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]],
] as [number, number][][]) {
  test(`connected rail faces meet for ${JSON.stringify(vertices)}`, () => {
    const enabled = vertices.map(() => true)
    vertices.forEach((_, i) => {
      const a = railFootprint(vertices, i, 0.065, enabled)
      const b = railFootprint(vertices, (i + 1) % vertices.length, 0.065, enabled)
      expect(a[1]![0]).toBeCloseTo(b[0]![0], 10)
      expect(a[1]![1]).toBeCloseTo(b[0]![1], 10)
      expect(a[2]![0]).toBeCloseTo(b[3]![0], 10)
      expect(a[2]![1]).toBeCloseTo(b[3]![1], 10)
    })
  })
}
test('an isolated railing has square ends', () => {
  expect(railFootprint([[0, 0], [4, 0], [4, 3], [0, 3]], 0, 0.1, [true, false, false, false]))
    .toEqual([[0, 0.05], [4, 0.05], [4, -0.05], [0, -0.05]])
})
