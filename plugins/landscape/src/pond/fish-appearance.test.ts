import { expect, test } from 'bun:test'
import { Mesh } from 'three'
import { createFishAtlas, fishAppearance, fishSpecies } from './fish-appearance'
import { PondNode } from './schema'
import { buildPondGeometry, disposePondGeometry, updatePondDetails } from './geometry'
import { getPondFishState } from './fish'

test('atlas is deterministic, opaque and has distinct padded species tiles', () => {
  const atlas = createFishAtlas(), second = createFishAtlas()
  expect(atlas.image.data).toEqual(second.image.data)
  expect(atlas.image.width).toBe(640)
  expect(atlas.image.height).toBe(256)
  const signatures = new Set<string>()
  for (const species of fishSpecies) {
    const appearance = fishAppearance(species, 0), region = appearance.uv
    expect(region.x).toBeGreaterThan(0); expect(region.y).toBeGreaterThan(0)
    expect(region.x + region.width).toBeLessThan(1)
    expect(region.y + region.height).toBeLessThan(1)
    const start = fishSpecies.indexOf(species) * 128 * 4
    signatures.add(JSON.stringify(Array.from(atlas.image.data!.slice(start, start + 128 * 4))))
  }
  expect(signatures.size).toBe(5)
  atlas.dispose(); second.dispose()
})

test('mixed school covers all species and shares one atlas; saved selection validates', () => {
  expect(PondNode.parse({}).fishType).toBe('mixed')
  expect(PondNode.safeParse({ fishType: 'invalid' }).success).toBe(false)
  const node = PondNode.parse({ fishCount: 24, width: 8, depth: 6 })
  const group = buildPondGeometry(node), state = getPondFishState(group)!
  expect(new Set(state.fish.map(f => f.mesh.userData.fishSpecies)).size).toBe(5)
  const bodies = state.fish.map(f => f.mesh.getObjectByName('pond-koi-body') as Mesh)
  expect(new Set(bodies.map(body => (body.material as import('three').MeshStandardMaterial).map)).size).toBe(1)
  expect(state.textures).toHaveLength(1)
  for (const body of bodies) {
    const uv = body.geometry.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThan(0); expect(uv.getX(i)).toBeLessThan(1)
      expect(uv.getY(i)).toBeGreaterThan(0); expect(uv.getY(i)).toBeLessThan(1)
    }
  }
  disposePondGeometry(group)
})

test('species edits replace only the school and retain finite geometry and saved selection', async () => {
  const node = PondNode.parse({ fishCount: 5, width: 8, depth: 6 })
  const group = buildPondGeometry(node), water = group.getObjectByName('pond-water'), rocks = group.getObjectByName('pond-rocks')
  for (const species of fishSpecies) {
    const saved = PondNode.parse(JSON.parse(JSON.stringify({ ...node, fishType: species })))
    updatePondDetails(group, saved)
    const state = getPondFishState(group)!
    expect(state.fish.every(fish => fish.mesh.userData.fishSpecies === species)).toBe(true)
    expect(group.getObjectByName('pond-water')).toBe(water)
    expect(group.getObjectByName('pond-rocks')).toBe(rocks)
    for (const fish of state.fish) fish.mesh.traverse(object => {
      if (object instanceof Mesh) expect(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
    })
    await Promise.resolve()
  }
  disposePondGeometry(group)
})

test('schools share an atlas until the final owner releases it', () => {
  const first = buildPondGeometry(PondNode.parse({ fishCount: 5 })), second = buildPondGeometry(PondNode.parse({ fishCount: 5, fishType: 'trout' }))
  const atlas = getPondFishState(first)!.textures[0]!
  expect(getPondFishState(second)!.textures[0]).toBe(atlas)
  let disposed = 0
  atlas.addEventListener('dispose', () => disposed++)
  disposePondGeometry(first)
  expect(disposed).toBe(0)
  disposePondGeometry(second)
  expect(disposed).toBe(1)
})

test('species have distinct body and fin silhouettes while retaining shared resources', () => {
  const group = buildPondGeometry(PondNode.parse({ fishCount: 5 }))
  const state = getPondFishState(group)!
  const bodies = new Set<string>(), fins = new Set<string>()
  for (const fish of state.fish) {
    const body = fish.mesh.getObjectByName('pond-koi-body') as Mesh
    const fin = fish.mesh.children[1] as Mesh
    body.geometry.computeBoundingBox(); fin.geometry.computeBoundingBox()
    bodies.add(JSON.stringify(body.geometry.boundingBox))
    fins.add(JSON.stringify(fin.geometry.boundingBox))
    expect(fish.mesh.children).toHaveLength(3)
    expect(fish.speed).toBeGreaterThan(.15)
  }
  expect(bodies.size).toBe(5)
  expect(fins.size).toBe(5)
  disposePondGeometry(group)
})

test('detailed fish stay under 1500 triangles and reuse body, fin and face geometry', () => {
  const group = buildPondGeometry(PondNode.parse({ fishCount: 15,fishType: 'koi' }))
  const state = getPondFishState(group)!
  const meshes = state.fish[0]!.mesh.children as Mesh[]
  const triangles = meshes.reduce((total,mesh) => total + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,0)
  expect(triangles).toBeLessThan(1500)
  for (const mesh of meshes.slice(1)) {
    const colors = mesh.geometry.getAttribute('color')
    expect(colors.count).toBe(mesh.geometry.getAttribute('position').count)
    expect(new Set(Array.from(colors.array)).size).toBeGreaterThan(1)
  }
  // Repeated atlas variant and species reuse all geometry, including face detail.
  for (let part = 0; part < 3; part++)
    expect((state.fish[10]!.mesh.children[part] as Mesh).geometry).toBe(meshes[part]!.geometry)
  disposePondGeometry(group)
})
