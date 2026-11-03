import { expect, test } from 'bun:test'
import { pathBacktracks, pathOverlaps } from './path-conflicts'
test('shared length is rejected while endpoint contact and different depths remain valid', () => {
 expect(pathOverlaps([[0, 0, 0], [4, 0, 0]], [[3, 0, 0], [1, 0, 0]])).toBe(true)
 expect(pathOverlaps([[0, 0, 0], [4, 0, 0]], [[4, 0, 0], [6, 0, 0]])).toBe(false)
 expect(pathOverlaps([[0, 0, 0], [4, 0, 0]], [[1, -.3, 0], [3, -.3, 0]])).toBe(false)
 expect(pathBacktracks([[0, 0, 0], [2, 0, 0], [1, 0, 0]])).toBe(true)
})
test('unconnected crossings at the same depth are detected', async () => {
 const { pathsCross } = await import('./path-conflicts')
 expect(pathsCross([[0, -.3, 0], [4, -.3, 0]], [[2, -.3, -2], [2, -.3, 2]])).toBe(true)
 expect(pathsCross([[0, -.3, 0], [4, -.3, 0]], [[2, -.4, -2], [2, -.4, 2]])).toBe(false)
})
