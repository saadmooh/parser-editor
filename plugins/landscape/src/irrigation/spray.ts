import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'
import { SPRINKLER_OUTLET_HEIGHT } from './sprinkler-model'
import type { IrrigationHeadNode } from './schema'

/** Looping visual preview of the configured reach, independent of pipe pressure. */
export function createSprinklerSpray(node: IrrigationHeadNode) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(768 * 3), 3))
  const spray = new Points(geometry, new PointsMaterial({ color: '#a6e0ff', size: .035, transparent: true, opacity: .75, depthWrite: false }))
  spray.name = 'Sprinkler water droplets'
  spray.frustumCulled = false
  spray.raycast = () => {}
  updateSprinklerSpray(spray, node, 0)
  return spray
}

export function updateSprinklerSpray(spray: Points<BufferGeometry, PointsMaterial>, node: IrrigationHeadNode, time: number) {
  const positions = spray.geometry.getAttribute('position') as BufferAttribute
  const count = positions.count
  for (let i = 0; i < count; i++) {
    const t = (i / count + time * .65) % 1
    const angle = ((i * 73) % count) / count * node.arc * Math.PI / 180
    const reach = node.radius * (.55 + .45 * ((i * 137) % count) / count)
    positions.setXYZ(i, Math.sin(angle) * reach * t, SPRINKLER_OUTLET_HEIGHT * (1 - t) + Math.max(.12, node.radius * .22) * 4 * t * (1 - t), Math.cos(angle) * reach * t)
  }
  positions.needsUpdate = true
}
