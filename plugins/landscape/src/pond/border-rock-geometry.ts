import { IcosahedronGeometry, SphereGeometry } from 'three'
import type { PondNode } from './schema'

/** Coherent deformation keeps shared positions coincident, with no vertex noise or cracks. */
export function borderRockGeometry(node: PondNode, seed: number) {
  let state = seed
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
  const angular = node.rockBorderShape === 'angular' || node.rockBorderShape === 'mixed' && random() < .55
  const geometry = angular ? new IcosahedronGeometry(.5, 1) : new SphereGeometry(.5, 12, 8)
  const phases = Array.from({ length: 6 }, () => random() * Math.PI * 2)
  const positions = geometry.getAttribute('position')
  const strength = node.rockBorderShapeVariation
  const squash = 1 - random() * .3 * strength
  const shear = (random() - .5) * .5 * strength
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const displacement = 1 + strength * (
      .22 * Math.sin(x * 5 + phases[0]!) * Math.cos(z * 4 + phases[1]!) +
      .13 * Math.sin(y * 7 + z * 3 + phases[2]!) +
      .09 * Math.cos(x * 9 - y * 5 + phases[3]!))
    positions.setXYZ(i, (x * displacement + y * shear), y * displacement * squash, z * displacement)
  }
  // Give the size control a consistent meaning regardless of deformation.
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!, width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2)
  geometry.scale(1 / width, 1 / width, 1 / width)
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}
