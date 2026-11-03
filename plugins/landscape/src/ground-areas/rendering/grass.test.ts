import { expect, test } from 'bun:test'
import { Matrix4, PerspectiveCamera, Scene } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { makeGrassBlades } from './grass'

test('standard grass animates in the material and reduces distant instance count', () => {
  const blades = makeGrassBlades([[0, 0], [8, 0], [8, 8], [0, 8]], 0, () => true)
  if (!blades) throw new Error('Expected grass blades')
  const fullCount = blades.count
  const firstMatrix = new Matrix4()
  blades.getMatrixAt(0, firstMatrix)
  expect(blades.material).toBeInstanceOf(MeshStandardNodeMaterial)
  expect((blades.material as MeshStandardNodeMaterial).positionNode).not.toBeNull()
  expect(blades.geometry.getAttribute('windPhase').count).toBe(fullCount)
  expect(blades.geometry.getAttribute('windWeight').getX(0)).toBe(0)
  expect(blades.geometry.getAttribute('windWeight').getX(4)).toBe(1)

  const camera = new PerspectiveCamera()
  const scene = new Scene()
  const beforeRender = blades.onBeforeRender.bind(blades)
  camera.position.set(4, 3, 4)
  camera.updateMatrixWorld()
  beforeRender(null as never, scene, camera, blades.geometry, blades.material as never, null as never)
  expect(blades.count).toBe(fullCount)
  camera.position.set(100, 3, 100)
  camera.updateMatrixWorld()
  beforeRender(null as never, scene, camera, blades.geometry, blades.material as never, null as never)
  expect(blades.count).toBeLessThan(fullCount / 2)
  const afterMatrix = new Matrix4()
  blades.getMatrixAt(0, afterMatrix)
  expect(afterMatrix.elements).toEqual(firstMatrix.elements)
})
