import { expect, spyOn, test } from 'bun:test'
import { Box3, BoxGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { buildPlantGeometry, disposePlantGeometry } from './geometry'
import { PlantNode } from '../domain/schema'
import { mergePlantParts } from './merge-parts'

test('merging bakes local transforms without changing bounds, triangles or materials', () => {
  const root = new Group()
  root.scale.setScalar(2)
  const material = new MeshStandardMaterial()
  for (let i = 0; i < 4; i++) {
    const mesh = new Mesh(new BoxGeometry(), material)
    mesh.position.set(i * 3, i, -i)
    mesh.rotation.y = i * 0.3
    mesh.scale.set(1, i + 1, 0.5)
    mesh.castShadow = true
    root.add(mesh)
  }
  const original = new Box3().setFromObject(root)
  const geometries = root.children.map((part) => (part as Mesh).geometry)
  const disposals = geometries.map((geometry) => spyOn(geometry, 'dispose'))
  mergePlantParts(root)
  expect(root.children).toHaveLength(1)
  const mesh = root.children[0] as Mesh
  expect(mesh.material).toBe(material)
  expect(mesh.castShadow).toBe(true)
  expect(mesh.geometry.index!.count).toBe(4 * 36)
  expect(mesh.geometry.groups).toHaveLength(0)
  const merged = new Box3().setFromObject(root)
  expect(merged.min.distanceTo(original.min)).toBeLessThan(0.00001)
  expect(merged.max.distanceTo(original.max)).toBeLessThan(0.00001)
  disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1))
  disposePlantGeometry(root)
})

test('merging preserves instancing and different shadow settings', () => {
  const root = new Group()
  const material = new MeshStandardMaterial()
  const blades = new InstancedMesh(new BoxGeometry(), material, 5)
  const shadow = new Mesh(new BoxGeometry(), material)
  shadow.castShadow = true
  root.add(blades, shadow, new Mesh(new BoxGeometry(), material), new Mesh(new BoxGeometry(), material))
  mergePlantParts(root)
  expect(root.children).toHaveLength(3)
  expect(root.children).toContain(blades)
  expect(root.children).toContain(shadow)
  const dispose = spyOn(blades, 'dispose')
  disposePlantGeometry(root)
  expect(dispose).toHaveBeenCalledTimes(1)
})

test('procedural bamboo, ferns and tree canopies collapse to material meshes', () => {
  for (const [preset, expected] of [['fab:bamboo', 1], ['fab:fern', 1], ['fab:oak', 2], ['fab:cherry', 3]] as const) {
    const group = buildPlantGeometry(PlantNode.parse({ preset, density: 1, scale: 2 }))
    expect(group.children).toHaveLength(expected)
    expect(group.scale).toEqual(new Vector3(2, 2, 2))
    disposePlantGeometry(group)
  }
})
