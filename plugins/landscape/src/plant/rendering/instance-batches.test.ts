import { expect, spyOn, test } from 'bun:test'
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  Raycaster, Scene, SkinnedMesh, SphereGeometry, Vector3 } from 'three'
import { belongsToScene, collectPlantParts, PlantInstanceBatches, type PlantPlacement } from './instance-batches'

function asset() {
  const model = new Group()
  const trunk = new Mesh(new BoxGeometry(0.5, 2, 0.5), new MeshStandardMaterial())
  trunk.position.y = 1
  const leaves = new Mesh(new SphereGeometry(1, 8, 6), new MeshStandardMaterial())
  leaves.position.y = 3
  trunk.castShadow = true
  leaves.castShadow = true
  model.add(trunk, leaves)
  return model
}

function place(source: Group, id: string, parent: Group | Scene, x = 0, z = 0): PlantPlacement {
  const root = new Group()
  root.position.set(x, 0, z)
  const model = source.clone(true)
  root.add(model)
  parent.add(root)
  return { id, root, model, parts: collectPlantParts(root, model)! }
}

function setup() {
  const scene = new Scene()
  const batches = new PlantInstanceBatches()
  scene.add(batches.root)
  return { scene, batches }
}

test('100 two-part plants share two draws per chunk and still have per-node bounds', () => {
  const { scene, batches } = setup()
  const source = asset()
  const placements = Array.from({ length: 100 }, (_, i) => place(source, `${i}`, scene, i % 10, Math.floor(i / 10)))
  const bounds = new Box3().setFromObject(placements[0]!.root)
  batches.update(placements, new Set())
  expect(batches.root.children).toHaveLength(2)
  for (const mesh of batches.root.children as InstancedMesh[]) {
    expect(mesh.count).toBe(100)
    expect(mesh.frustumCulled).toBe(true)
    expect(mesh.boundingSphere!.radius).toBeGreaterThan(0)
  }
  expect(placements.every((plant) => !plant.model.visible)).toBe(true)
  expect(new Box3().setFromObject(placements[0]!.root).equals(bounds)).toBe(true)
  batches.dispose()
})

test('world transforms include parent rotation, live scale and source hierarchy transforms', () => {
  const { scene, batches } = setup()
  const parent = new Group()
  parent.position.set(40, 5, 10)
  parent.rotation.y = 0.7
  scene.add(parent)
  const source = asset()
  source.position.set(0.5, 0, 0)
  const plant = place(source, 'tree', parent, 2, 3)
  plant.root.rotation.y = 0.5
  plant.root.scale.setScalar(2)
  batches.update([plant], new Set())
  scene.updateMatrixWorld(true)
  const mesh = batches.root.children[0] as InstancedMesh
  const instance = new Matrix4()
  mesh.getMatrixAt(0, instance)
  const expected = plant.parts[0]!.mesh.matrixWorld
  instance.elements.forEach((value, i) => expect(value).toBeCloseTo(expected.elements[i]!, 5))
  const version = mesh.instanceMatrix.version
  batches.update([plant], new Set())
  expect(mesh.instanceMatrix.version).toBe(version)
  plant.root.position.x += 1
  batches.update([plant], new Set())
  expect(mesh.instanceMatrix.version).toBeGreaterThan(version)
  batches.dispose()
})

test('spatial chunks separate plants and rebatch moves across chunk boundaries', () => {
  const { scene, batches } = setup()
  const source = asset()
  const a = place(source, 'a', scene, 1)
  const b = place(source, 'b', scene, 33)
  const c = place(source, 'c', scene, -1)
  batches.update([a, b, c], new Set())
  expect(batches.root.children).toHaveLength(6)
  b.root.position.x = 2
  c.root.position.x = 3
  batches.update([a, b, c], new Set())
  expect(batches.root.children).toHaveLength(2)
  expect((batches.root.children[0] as InstancedMesh).count).toBe(3)
  batches.dispose()
})

test('selection, hover and export promote ordinary meshes without double rendering', () => {
  const { scene, batches } = setup()
  const source = asset()
  const a = place(source, 'a', scene)
  const b = place(source, 'b', scene, 5)
  batches.update([a, b], new Set(['a']))
  expect(a.model.visible).toBe(true)
  expect(b.model.visible).toBe(false)
  const mesh = batches.root.children[0] as InstancedMesh
  expect(mesh.count).toBe(1)
  expect(batches.resolve(mesh, 0)?.placement.id).toBe('b')
  batches.update([a, b], new Set(), true)
  expect(batches.root.children).toHaveLength(0)
  expect(a.model.visible && b.model.visible).toBe(true)
  batches.update([a, b], new Set())
  expect((batches.root.children[0] as InstancedMesh).count).toBe(2)
  batches.dispose()
})

test('hidden ancestors and removed placements disappear from batches and hit routes', () => {
  const { scene, batches } = setup()
  const source = asset()
  const parent = new Group()
  scene.add(parent)
  parent.visible = false
  const a = place(source, 'a', parent)
  const b = place(source, 'b', scene, 5)
  expect(a.parts).toHaveLength(2)
  batches.update([a, b], new Set())
  expect((batches.root.children[0] as InstancedMesh).count).toBe(1)
  parent.visible = true
  batches.update([a, b], new Set())
  batches.update([b], new Set())
  expect(batches.resolve(batches.root.children[0]!, 0)?.placement.id).toBe('b')
  expect(belongsToScene(b.root, scene)).toBe(true)
  expect(belongsToScene(b.root, new Scene())).toBe(false)
  batches.update([], new Set())
  expect(batches.root.children).toHaveLength(0)
  batches.dispose()
})

test('raycasting instances identifies the original plant and primitive', () => {
  const { scene, batches } = setup()
  const source = asset()
  const a = place(source, 'a', scene, 1)
  const b = place(source, 'b', scene, 5)
  batches.update([a, b], new Set())
  scene.updateMatrixWorld(true)
  const ray = new Raycaster(new Vector3(5, 1, 10), new Vector3(0, 0, -1))
  const hit = ray.intersectObject(batches.root, true)[0]!
  const slot = batches.resolve(hit.object, hit.instanceId)!
  expect(slot.placement).toBe(b)
  expect(slot.part).toBe(b.parts[0]!.mesh)
  const allHits = ray.intersectObject(scene, true)
  expect(allHits.length).toBeGreaterThan(0)
  expect(allHits.every((intersection) => intersection.object instanceof InstancedMesh)).toBe(true)
  batches.dispose()
  expect(b.model.visible).toBe(true)
  expect(b.parts[0]!.mesh.layers.mask).toBe(1)
})

test('different tint materials are separate and disposing batches preserves shared assets', () => {
  const { scene, batches } = setup()
  const source = asset()
  const a = place(source, 'a', scene)
  const b = place(source, 'b', scene)
  b.parts[0]!.mesh.material = new MeshStandardMaterial({ color: '#ff0000' })
  const geometryDispose = spyOn(a.parts[0]!.mesh.geometry, 'dispose')
  const materialDispose = spyOn(a.parts[0]!.mesh.material as MeshStandardMaterial, 'dispose')
  batches.update([a, b], new Set())
  expect(batches.root.children).toHaveLength(3)
  const instanceDispose = spyOn(batches.root.children[0] as InstancedMesh, 'dispose')
  batches.dispose()
  expect(instanceDispose).toHaveBeenCalledTimes(1)
  expect(geometryDispose).not.toHaveBeenCalled()
  expect(materialDispose).not.toHaveBeenCalled()
})

test('animated models fall back and authored invisible parts are excluded', () => {
  const root = new Group()
  const source = asset()
  source.children[1]!.visible = false
  root.add(source)
  expect(collectPlantParts(root, source)).toHaveLength(1)
  source.add(new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial()))
  expect(collectPlantParts(root, source)).toBeNull()
})
