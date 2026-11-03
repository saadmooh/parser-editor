import { expect, test } from 'bun:test'
import { distanceToStroke, strokeSamples } from './planting-stroke'

test('fast brush movement fills spacing intervals and honors the stroke limit', () => {
  expect(strokeSamples([0, 0], [5.2, 0], 1, 500)).toEqual([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]])
  expect(strokeSamples([0, 0], [1000, 0], 0.1, 3)).toHaveLength(3)
  expect(strokeSamples([0, 0], [0, 0], 1, 500)).toEqual([])
})

test('erase distance covers the swept segment rather than just cursor samples', () => {
  expect(distanceToStroke([5, 0.5], [0, 0], [10, 0])).toBe(0.5)
  expect(distanceToStroke([12, 0], [0, 0], [10, 0])).toBe(2)
  expect(distanceToStroke([1, 0], [0, 0], [0, 0])).toBe(1)
})
