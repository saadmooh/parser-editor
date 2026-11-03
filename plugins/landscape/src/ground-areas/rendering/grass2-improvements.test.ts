import { expect, test } from 'bun:test'
import { sceneRegistry, type GeometryContext } from '@pascal-app/core'
import { Group, InstancedMesh, InterleavedBufferAttribute, Mesh, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { GroundAreaNode, type Point } from '../domain/schema'
import { makeGrass2 } from './grass2'
import { grass2GroundTexture } from './grass2-ground'
import { grassEdgeSampler } from './grass2-edge'
import { Grass2Patch, projectedGrassPixels } from './grass2-lod'
import { buildGroundAreaLiveGeometry } from './geometry'
import { Grass2Stream } from './grass2-stream'

const square: Point[] = [[0, 0], [8, 0], [8, 8], [0, 8]]

test('both grass styles sample the actual ground texture at their roots', () => {
  for (const mode of ['blades', 'billboards'] as const) {
    const group = makeGrass2(square, 0, () => true, { mode })
    const mesh = group.getObjectByName(`grass2-${mode}`) as InstancedMesh
    const material = mesh.material as MeshBasicNodeMaterial | MeshStandardNodeMaterial
    let matches = 0
    material.colorNode!.traverse((node) => {
      if ((node as unknown as { value?: unknown }).value === grass2GroundTexture(mode)) matches++
    })
    expect(matches).toBeGreaterThan(0)
    expect(material.vertexColors).toBe(false)
  }
})

test('flower species have detailed petals and visible rooted stems at every distance', () => {
  const group = makeGrass2(square, 0, () => true, { flowerDensity: 1 })
  const patch = group.children[0] as Grass2Patch
  const flowers = patch.content.children.filter((object) =>
    ['grass2-dandelion', 'grass2-clover', 'grass2-violet', 'grass2-blue'].includes(object.name)) as InstancedMesh[]
  expect(group.getObjectByName('grass2-flower-stems')).toBeUndefined()
  expect(new Set(flowers.map((flower) => flower.name)).size).toBe(4)
  for (const flower of flowers) {
    expect(flower.geometry.getAttribute('color')).toBeDefined()
    flower.geometry.computeBoundingBox()
    expect(flower.geometry.boundingBox!.min.y).toBe(0)
    expect(flower.geometry.boundingBox!.max.y).toBeGreaterThan(1)
    const positions = flower.geometry.getAttribute('position')
    expect(positions.getX(0)).toBeCloseTo(-0.008)
    expect(positions.getY(2)).toBe(1)
    expect(flower.geometry.getIndex()!.count / 3).toBeGreaterThan(20)
    expect((flower.userData.grass2Counts as number[])[2]).toBeGreaterThan(0)
    const ranges = flower.geometry.userData.grass2Ranges as { start: number; count: number }[]
    expect(ranges).toHaveLength(3)
    expect(ranges[0]!.count).toBeGreaterThan(ranges[1]!.count)
    expect(ranges[1]!.count).toBeGreaterThan(ranges[2]!.count)
    const index = flower.geometry.getIndex()!
    for (const range of ranges) {
      const vertices = Array.from({ length: range.count }, (_, i) => index.getX(range.start + i))
      expect(vertices.includes(0)).toBe(true)
      expect(vertices.includes(2)).toBe(true)
    }
    const weights = flower.geometry.getAttribute('windWeight')
    expect(weights.getX(0)).toBe(0)
    expect(weights.getX(2)).toBe(1)
    expect(flower.instanceMatrix.array[13]).toBeCloseTo(0.025, 5)
  }
})

test('screen size controls geometry detail without reallocating instance buffers', () => {
  const group = makeGrass2(square, 0, () => true, { flowerDensity: 0 })
  const patch = group.children[0] as Grass2Patch
  const mesh = patch.getObjectByName('grass2-blades') as InstancedMesh
  const buffer = mesh.instanceMatrix
  expect(patch.getObjectByName('grass2-distant-cards')).toBeUndefined()
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 1000)
  camera.position.set(4, 20, 4)
  camera.lookAt(4, 0, 4)
  camera.updateMatrixWorld()
  group.updateMatrixWorld(true)
  for (const [zoom, level, triangles] of [[4,0,21], [1,1,4], [0.2,2,2]]) {
    camera.zoom = zoom!
    camera.updateProjectionMatrix()
    patch.update(camera)
    expect(patch.getCurrentLevel()).toBe(level!)
    expect(mesh.visible).toBe(true)
    expect(mesh.geometry.drawRange.count / 3).toBe(triangles!)
    expect(mesh.instanceMatrix).toBe(buffer)
  }
  const position = new Vector3(0, 0, -20)
  const perspective = new PerspectiveCamera(50)
  expect(projectedGrassPixels(perspective, position, 1, 1440))
    .toBeCloseTo(projectedGrassPixels(perspective, position, 1, 720) * 2)
  camera.zoom = 1
  camera.updateProjectionMatrix()
  patch.viewportHeight = 1440
  patch.update(camera)
  expect(patch.getCurrentLevel()).toBe(0)
})

test('scene lighting is optional and stored with the grass settings', () => {
  for (const lighting of [true, false]) {
    const node = GroundAreaNode.parse({ surface: 'grass2', outline: square, grass2Settings: { lighting } })
    expect(GroundAreaNode.parse(JSON.parse(JSON.stringify(node))).grass2Settings.lighting).toBe(lighting)
    const mesh = makeGrass2(square, 0, () => true, node.grass2Settings).getObjectByName('grass2-blades') as InstancedMesh
    expect(mesh.material).toBeInstanceOf(lighting ? MeshStandardNodeMaterial : MeshBasicNodeMaterial)
  }
})

test('soft edges bend into grass and away from holes without moving roots', () => {
  const sample = grassEdgeSampler([[square, [[3,3],[5,3],[5,5],[3,5]]]])
  expect(sample(0.1, 2).x).toBeGreaterThan(0.9)
  expect(sample(2.9, 4).x).toBeLessThan(-0.9)
  expect(sample(1, 2).amount).toBe(0)
  expect(sample(0.1, 2).amount).toBeGreaterThan(sample(0.3, 2).amount)
})

test('live geometry rebuild transfers reusable grass before the host disposes old children', () => {
  const node = GroundAreaNode.parse({ surface: 'grass2', outline: square })
  const host = new Group()
  const ctx = { resolve: () => undefined, children: [], siblings: [], parent: null, sceneNodes: {} } as GeometryContext
  sceneRegistry.nodes.set(node.id, host)
  try {
    const built = buildGroundAreaLiveGeometry(node, ctx)
    host.add(...built.children.slice())
    host.updateMatrixWorld(true)
    const stream = host.getObjectByName('ground-area-grass2-stream') as Grass2Stream
    const camera = new OrthographicCamera(-6, 6, 6, -6, 0.1, 100)
    camera.position.set(4, 20, 4)
    camera.lookAt(4, 0, 4)
    camera.updateMatrixWorld()
    stream.update(camera)
    for (let i = 0; i < 100 && stream.pendingPatchCount; i++) stream.update(camera)
    const mesh = stream.getObjectByName('grass2-blades') as InstancedMesh
    expect(mesh).toBeDefined()
    let disposed = false
    mesh.geometry.addEventListener('dispose', () => { disposed = true })
    const rebuilt = buildGroundAreaLiveGeometry({ ...node, grass2Settings: { ...node.grass2Settings, wind: 0 } }, ctx)
    expect(rebuilt.getObjectByName('ground-area-grass2-stream')).toBe(stream)
    host.traverse((object) => { if (object instanceof Mesh) object.geometry.dispose() })
    expect(disposed).toBe(false)
    expect((mesh.material as MeshStandardNodeMaterial).userData.grass2Wind.value).toBe(0)
  } finally {
    sceneRegistry.nodes.delete(node.id)
  }
})


test('billboard vertex buffers fit the eight-buffer GPU limit even when a pass needs normals', () => {
  const mesh = makeGrass2(square, 0, () => true, { mode: 'billboards' })
    .getObjectByName('grass2-billboards') as InstancedMesh
  // Include every geometry attribute, including normals used by auxiliary passes.
  // Matrix columns share one backing buffer; instance color requires another.
  const attributes = [...Object.values(mesh.geometry.attributes), mesh.instanceMatrix, mesh.instanceColor!]
  const buffers = new Set(attributes.map((attribute) => attribute instanceof InterleavedBufferAttribute
    ? attribute.data : attribute))
  expect(buffers.size).toBeLessThanOrEqual(8)
})
