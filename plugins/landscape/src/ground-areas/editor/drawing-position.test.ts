import { expect, test } from 'bun:test'
import { Group, Vector3 } from 'three'
import { groundDrawingPosition } from './drawing-position'

test('grid events retain level-local coordinates', () => {
  const level = new Group()
  level.position.set(30, 5, -20)
  expect(groundDrawingPosition({ localPosition: [2, 0, 3], position: [32, 5, -17] }, level).toArray())
    .toEqual([2, 0, 3])
})

test('object hits use world coordinates transformed through nested levels', () => {
  const building = new Group()
  building.position.set(30, 5, -20)
  building.rotation.y = Math.PI / 3
  const level = new Group()
  level.position.set(4, 2, -3)
  level.rotation.y = -Math.PI / 4
  building.add(level)
  building.updateMatrixWorld(true)
  const expected = new Vector3(2, 0.25, 3)
  const world = level.localToWorld(expected.clone())
  const result = groundDrawingPosition({ node: {}, localPosition: [99, 99, 99], position: world.toArray() }, level)
  expect(result.distanceTo(expected)).toBeLessThan(1e-10)
})
