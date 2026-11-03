import { expect, test } from 'bun:test'
import { InstancedMesh, Mesh } from 'three'
import { buildPondGeometry, disposePondGeometry } from './geometry'
import { PondNode } from './schema'
import { buildPondTerrain } from './terrain'

// Count instance multiplication: one draw call can still contain expensive geometry.
function triangles(mesh: Mesh) {
  return (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3
    * (mesh instanceof InstancedMesh ? mesh.count : 1)
}

test('pond decoration and water stay within polygon budgets at household and large sizes', () => {
  for (const width of [6,18,30]) {
    const node = PondNode.parse({ width,depth:width*.75,fishCount:0 })
    const group = buildPondGeometry(node)
    try {
      let total = 0
      group.traverse(object => { if (object instanceof Mesh) total += triangles(object) })
      expect(total).toBeLessThan(width === 6 ? 20000 : 65000)
      const pebbles = group.getObjectByName('pond-underwater-pebbles') as InstancedMesh
      expect(pebbles.count).toBeLessThanOrEqual(256)
      expect(triangles(pebbles)).toBeLessThanOrEqual(5120)
      expect(pebbles.castShadow).toBe(false)
      const shelf = group.getObjectByName('pond-shelf-rock-batch') as Mesh
      expect(shelf.castShadow).toBe(false)
    } finally { disposePondGeometry(group) }
    const terrain = buildPondTerrain(node)
    expect(terrain.terrain.index!.count/3).toBeLessThanOrEqual(32768)
    terrain.terrain.dispose();terrain.water.dispose()
  }
})
