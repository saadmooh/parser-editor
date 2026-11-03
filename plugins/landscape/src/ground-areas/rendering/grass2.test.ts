import { expect, test } from 'bun:test'
import { LOD, Matrix4, Mesh, OrthographicCamera, PerspectiveCamera, Vector3, type InstancedMesh } from 'three'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import type { GeometryContext } from '@pascal-app/core'
import { GroundAreaNode, type Point } from '../domain/schema'
import { buildGroundAreaGeometry } from './geometry'
import { makeGrass2 } from './grass2'

const square: Point[] = [[0, 0], [5, 0], [5, 5], [0, 5]]

function positions(mesh: InstancedMesh) {
  const matrix = new Matrix4(), point = new Vector3()
  return Array.from({ length: mesh.count }, (_, index) => {
    mesh.getMatrixAt(index, matrix)
    point.setFromMatrixPosition(matrix)
    return [point.x, point.z] as const
  })
}

test('Grass 2 keeps blades, billboards, and flowers inside the usable ground footprint', () => {
  const usable = (x: number, z: number) => !(x > 2 && x < 3 && z > 2 && z < 3)
  const group = makeGrass2(square, 0, usable, { flowerDensity: 1, flowerMix: 'clover' })
  const blades = group.getObjectByName('grass2-blades') as InstancedMesh
  const billboardGroup = makeGrass2(square, 0, usable, { mode: 'billboards', flowerDensity: 1, flowerMix: 'clover' })
  const billboards = billboardGroup.getObjectByName('grass2-billboards') as InstancedMesh
  const stems = group.getObjectByName('grass2-clover') as InstancedMesh
  expect(blades.count).toBeGreaterThan(0)
  expect(billboards.count).toBeGreaterThan(0)
  expect(stems.count).toBeGreaterThan(0)
  for (const [x, z] of [...positions(blades), ...positions(billboards), ...positions(stems)]) {
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThanOrEqual(5)
    expect(z).toBeGreaterThanOrEqual(0)
    expect(z).toBeLessThanOrEqual(5)
    expect(usable(x, z)).toBe(true)
  }
})

test('Grass 2 placement is stable by seed and flower amount can be zero', () => {
  const first = makeGrass2(square, 0, () => true, { seed: 7, flowerDensity: 0 })
  const second = makeGrass2(square, 0, () => true, { seed: 7, flowerDensity: 0 })
  const changed = makeGrass2(square, 0, () => true, { seed: 8, flowerDensity: 0 })
  const a = positions(first.getObjectByName('grass2-blades') as InstancedMesh)
  const b = positions(second.getObjectByName('grass2-blades') as InstancedMesh)
  const c = positions(changed.getObjectByName('grass2-blades') as InstancedMesh)
  expect(a).toEqual(b)
  expect(c).not.toEqual(a)
  expect(first.getObjectByName('grass2-clover')).toBeUndefined()
})

test('Grass 2 preserves grass and flower density when the area grows', () => {
  const expanded: Point[] = [[0, 0], [30, 0], [30, 30], [0, 30]]
  for (const mode of ['blades', 'billboards'] as const) {
    const small = makeGrass2(square, 0, () => true, { mode, flowerDensity: 1, flowerMix: 'clover' })
    const large = makeGrass2(expanded, 0, () => true, { mode, flowerDensity: 1, flowerMix: 'clover' })
    const nearPositions = (group: ReturnType<typeof makeGrass2>, name: string) =>
      (group.children as LOD[]).flatMap((patch) => {
        const mesh = patch.levels[0]!.object.getObjectByName(name) as InstancedMesh | undefined
        return mesh ? positions(mesh) : []
      })
    for (const name of [`grass2-${mode}`, 'grass2-clover']) {
      const original = nearPositions(small, name)
      const grown = nearPositions(large, name)
      expect(grown.filter(([x, z]) => x <= 5 && z <= 5).sort()).toEqual(original.sort())
      // The area grows 36 times; spatial variation allows a small density difference.
      expect(grown.length / original.length).toBeGreaterThan(28)
      expect(grown.length / original.length).toBeLessThan(44)
    }
    expect(nearPositions(large, 'grass2-clover').length).toBeGreaterThan(800)
  }
})

test('Grass 2 keeps its near blade cost within the budget for a 25 square metre area', () => {
  const group = makeGrass2(square, 0, () => true, { flowerDensity: 0 })
  const blades = group.getObjectByName('grass2-blades') as InstancedMesh
  expect(blades.count).toBeLessThanOrEqual(850)
  expect(blades.geometry.drawRange.count).toBe(63)
  expect(blades.count * blades.geometry.drawRange.count / 3).toBeLessThanOrEqual(18000)
})

test('Grass 2 billboards face the camera and bend tips without changing instance matrices', () => {
  const group = makeGrass2(square, 0, () => true, { wind: 1, flowerDensity: 1, flowerMix: 'clover' })
  const blades = group.getObjectByName('grass2-blades') as InstancedMesh
  const billboardGroup = makeGrass2(square, 0, () => true, { mode: 'billboards', wind: 1 })
  const billboards = billboardGroup.getObjectByName('grass2-billboards') as InstancedMesh
  const stems = group.getObjectByName('grass2-clover') as InstancedMesh

  expect(blades.material).toBeInstanceOf(MeshStandardNodeMaterial)
  expect(billboards.material).toBeInstanceOf(MeshBasicNodeMaterial)
  for (const mesh of [blades, billboards, stems]) {
    expect((mesh.material as MeshStandardNodeMaterial).positionNode).not.toBeNull()
    expect(mesh.geometry.getAttribute('windData').count).toBe(mesh.count)
    expect(Object.hasOwn(mesh, 'onBeforeRender')).toBe(false)
  }
  const weights = billboards.geometry.getAttribute('windWeight')
  expect(weights.getX(0)).toBe(0)
  expect(weights.getX(2)).toBe(1)
  expect(billboards.geometry.getAttribute('uv').count).toBe(4)
  expect(billboards.geometry.getAttribute('atlasCell').count).toBe(billboards.count)
  expect(blades.geometry.getAttribute('windWeight').getX(4)).toBe(1)
  expect(blades.geometry.getAttribute('color').count).toBe(53)
  expect(stems.material).toBeInstanceOf(MeshStandardNodeMaterial)
  const stemWeights = stems.geometry.getAttribute('windWeight')
  expect(stemWeights.getX(0)).toBe(0)
  expect(stemWeights.getX(2)).toBe(1)
  expect(stems.geometry.getAttribute('windData').getW(0)).toBeGreaterThan(0)
})

test('Grass 2 splits larger areas into patches with stable billboard density levels', () => {
  const outline: Point[] = [[-2, -2], [12, -2], [12, 12], [-2, 12]]
  const usable = (x: number, z: number) => !(x > 4 && x < 7 && z > 4 && z < 7)
  const group = makeGrass2(outline, 0, usable, { mode: 'billboards', flowerDensity: 0 })
  const patches = group.children as LOD[]
  expect(patches.length).toBeGreaterThan(1)
  expect(patches.every((patch) => patch instanceof LOD && patch.levels.length === 4)).toBe(true)

  const nearPositions: string[] = []
  for (const patch of patches) {
    const mesh = patch.levels[0]!.object.getObjectByName('grass2-billboards') as InstancedMesh
    const counts = mesh.userData.grass2Counts as number[]
    expect(counts[0]).toBeGreaterThanOrEqual(counts[1]!)
    expect(counts[1]).toBeGreaterThanOrEqual(counts[2]!)
    expect(mesh.geometry.index!.count).toBe(6)
    expect(mesh.geometry.getAttribute('atlasCell').count).toBe(mesh.count)
    expect((mesh.material as MeshBasicNodeMaterial).colorNode).not.toBeNull()
    expect((mesh.material as MeshBasicNodeMaterial).maskNode).not.toBeNull()
    const near = positions(mesh).map(([x, z]) => `${x},${z}`)
    const actual = positions(mesh)
    expect(patch.position.x).toBeGreaterThanOrEqual(Math.min(...actual.map(([x]) => x)))
    expect(patch.position.x).toBeLessThanOrEqual(Math.max(...actual.map(([x]) => x)))
    expect(patch.position.z).toBeGreaterThanOrEqual(Math.min(...actual.map(([, z]) => z)))
    expect(patch.position.z).toBeLessThanOrEqual(Math.max(...actual.map(([, z]) => z)))
    nearPositions.push(...near)
  }
  expect(new Set(nearPositions).size).toBe(nearPositions.length)
  for (const position of nearPositions) {
    const [x, z] = position.split(',').map(Number)
    expect(usable(x!, z!)).toBe(true)
  }

  const camera = new PerspectiveCamera()
  group.updateMatrixWorld(true)
  camera.position.copy(patches[0]!.position).add(new Vector3(0, 5, 0))
  camera.lookAt(patches[0]!.position)
  camera.updateMatrixWorld()
  patches[0]!.update(camera)
  expect(patches[0]!.getCurrentLevel()).toBe(0)
  camera.position.y += 60
  camera.lookAt(patches[0]!.position)
  camera.updateMatrixWorld()
  patches[0]!.update(camera)
  expect(patches[0]!.getCurrentLevel()).toBe(2)
  expect(patches[0]!.levels.filter(({ object }) => object.visible).length).toBe(1)
  camera.position.y += 1000
  camera.lookAt(patches[0]!.position)
  camera.updateMatrixWorld()
  patches[0]!.update(camera)
  expect(patches[0]!.getCurrentLevel()).toBe(3)
  expect(patches[0]!.levels[3]!.object.children).toHaveLength(0)
})

test('Grass 2 surface, billboards, and flower stems follow sampled ground height', () => {
  const node = GroundAreaNode.parse({
    outline: square, surface: 'grass2', elevation: 0.4,
    grass2Settings: { flowerDensity: 1, flowerMix: 'clover' },
  })
  const baseAt = (x: number, z: number) =>
    0.45 * Math.max(0, 1 - Math.hypot(x - 2.5, z - 2.5) / 2)
  const ctx = {
    resolve: () => undefined,
    children: [], siblings: [], parent: null,
    sceneNodes: {},
    levelBaseAt: baseAt,
  } as GeometryContext
  const group = buildGroundAreaGeometry(node, ctx)
  group.updateMatrixWorld(true)
  const surface = group.getObjectByName('ground-area-grass2') as Mesh
  const vertices = surface.geometry.getAttribute('position')
  expect(vertices.count).toBeGreaterThan(100)
  let highest = -Infinity
  for (let index = 0; index < vertices.count; index++) {
    const x = vertices.getX(index), z = vertices.getZ(index)
    const y = vertices.getY(index)
    highest = Math.max(highest, y)
    expect(y).toBeCloseTo(0.4 + baseAt(x, z) + 0.018, 5)
  }
  expect(highest).toBeGreaterThan(0.8)

  const grass = group.getObjectByName('grass2-patch-0-0') as LOD
  expect(grass).toBeInstanceOf(LOD)
  const matrix = new Matrix4(), point = new Vector3()
  for (const { object } of grass.levels) {
    for (const name of ['grass2-blades', 'grass2-billboards', 'grass2-clover']) {
      const mesh = object.getObjectByName(name) as InstancedMesh | undefined
      if (!mesh) continue
      for (let index = 0; index < mesh.count; index++) {
        mesh.getMatrixAt(index, matrix)
        point.setFromMatrixPosition(matrix.premultiply(mesh.matrixWorld))
        expect(point.y).toBeCloseTo(
          0.4 + baseAt(point.x, point.z) + (name === 'grass2-clover' ? 0.025 : 0.024), 5)
      }
    }
  }
})

test('Grass 2 settings are saved on ground areas without changing existing grass', () => {
  const existing = GroundAreaNode.parse({ outline: square, surface: 'grass' })
  const flowering = GroundAreaNode.parse({ outline: square, surface: 'grass2',
    grass2Settings: { density: 1.4, flowerMix: 'clover' } })
  expect(existing.surface).toBe('grass')
  expect(flowering.grass2Settings.density).toBe(1.4)
  expect(flowering.grass2Settings.flowerMix).toBe('clover')
  expect(flowering.grass2Settings.wind).toBe(0.55)
})

test('Grass 2 preserves the selected style across every distance level and saves it', () => {
  for (const mode of ['blades', 'billboards'] as const) {
    const node = GroundAreaNode.parse({ outline: square, surface: 'grass2', grass2Settings: { mode } })
    const restored = GroundAreaNode.parse(JSON.parse(JSON.stringify(node)))
    expect(restored.grass2Settings.mode).toBe(mode)
    const group = makeGrass2(square, 0, () => true, restored.grass2Settings)
    for (const patch of group.children as LOD[]) {
      for (const { object } of patch.levels.slice(0, 1)) {
        expect(object.getObjectByName(`grass2-${mode}`)).toBeDefined()
        expect(object.getObjectByName(mode === 'blades' ? 'grass2-billboards' : 'grass2-blades')).toBeUndefined()
        if (mode === 'blades') expect(object.getObjectByName('grass2-distant-cards')).toBeUndefined()
      }
    }
  }
  expect(GroundAreaNode.parse({ outline: square, grass2Settings: { density: 1.4 } }).grass2Settings.mode).toBe('blades')
})


test('Grass 2 keeps stable flower placements while reducing their distant cost', () => {
  const group = makeGrass2(square, 0, () => true, { flowerDensity: 1, flowerMix: 'clover' })
  group.updateMatrixWorld(true)
  const patch = group.children[0] as LOD
  const blades = patch.getObjectByName('grass2-blades') as InstancedMesh
  const stems = patch.getObjectByName('grass2-clover') as InstancedMesh
  const heads = patch.levels[0]!.object.children.filter((object) =>
    object.name === 'grass2-clover') as InstancedMesh[]
  const matrixBuffer = blades.instanceMatrix
  const windBuffer = blades.geometry.getAttribute('windData')
  const original = positions(blades)
  const originalFlowers = positions(stems)
  const flowerMatrixBuffer = stems.instanceMatrix
  const nearFlowerTriangles = stems.geometry.drawRange.count / 3
  const camera = new PerspectiveCamera(50)
  const move = (distance: number) => {
    camera.position.copy(patch.position).add(new Vector3(0, distance, 0))
    camera.lookAt(patch.position)
    camera.updateMatrixWorld()
    patch.update(camera)
  }
  move(25)
  expect(patch.getCurrentLevel()).toBe(1)
  expect(positions(blades)).toEqual(original.slice(0, blades.count))
  expect(blades.count).toBeLessThan(original.length)
  expect(blades.visible).toBe(true)
  expect(blades.geometry.drawRange.count / 3).toBe(4)
  expect(stems.visible).toBe(true)
  expect(heads.some((mesh) => mesh.visible)).toBe(true)
  expect(stems.count).toBeLessThan(originalFlowers.length)
  expect(positions(stems)).toEqual(originalFlowers.slice(0, stems.count))
  expect(stems.geometry.drawRange.count / 3).toBeLessThan(nearFlowerTriangles)
  move(65)
  expect(patch.getCurrentLevel()).toBe(2)
  expect(blades.visible).toBe(true)
  expect(blades.geometry.drawRange.count / 3).toBe(2)
  expect(positions(blades)).toEqual(original.slice(0, blades.count))
  expect(heads.every((mesh) => mesh.visible)).toBe(true)
  expect(stems.count).toBeLessThan(originalFlowers.length * 0.5)
  expect(positions(stems)).toEqual(originalFlowers.slice(0, stems.count))
  expect(stems.geometry.drawRange.count / 3).toBeLessThan(nearFlowerTriangles / 2)
  expect(blades.instanceMatrix).toBe(matrixBuffer)
  expect(blades.geometry.getAttribute('windData')).toBe(windBuffer)
  expect(stems.instanceMatrix).toBe(flowerMatrixBuffer)
  move(55)
  expect(patch.getCurrentLevel()).toBe(2)
  move(30)
  expect(patch.getCurrentLevel()).toBe(1)
  move(5)
  expect(positions(blades)).toEqual(original)
  expect(blades.visible).toBe(true)
  expect(blades.geometry.drawRange.count / 3).toBe(21)
  expect(positions(stems)).toEqual(originalFlowers)
  expect(stems.visible).toBe(true)
  expect(heads.every((mesh) => mesh.visible)).toBe(true)
  let meshCount = 0
  patch.traverse((object) => { if (object instanceof Mesh) meshCount++ })
  expect(meshCount).toBe(1 + heads.length)
})

test('orbiting an area keeps the same flowers visible from every side', () => {
  const outline: Point[] = [[0, 0], [30, 0], [30, 30], [0, 30]]
  for (const mode of ['blades', 'billboards'] as const) {
    const group = makeGrass2(outline, 0, () => true, { mode, flowerDensity: 1, flowerMix: 'clover' })
    group.updateMatrixWorld(true)
    const camera = new PerspectiveCamera(50)
    for (let side = 0; side < 8; side++) {
      const angle = side * Math.PI / 4
      camera.position.set(15 + 32 * Math.cos(angle), 15, 15 + 32 * Math.sin(angle))
      camera.lookAt(15, 0, 15)
      camera.updateMatrixWorld()
      for (const patch of group.children as LOD[]) {
        patch.update(camera)
        expect(patch.getCurrentLevel()).toBeLessThan(3)
        patch.traverse((object) => {
          const mesh = object as InstancedMesh
          if (!mesh.isInstancedMesh || mesh.name === `grass2-${mode}`) return
          expect(mesh.visible).toBe(true)
          expect(mesh.count).toBeGreaterThan(0)
          expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count)
        })
      }
    }
  }
})

test('Grass 2 orthographic detail follows zoom rather than camera height', () => {
  const group = makeGrass2(square, 0, () => true)
  group.updateMatrixWorld(true)
  const patch = group.children[0] as LOD
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 1000)
  camera.position.set(0, 20, 0)
  camera.updateMatrixWorld()
  patch.update(camera)
  const initial = patch.getCurrentLevel()
  camera.position.y = 200
  camera.updateMatrixWorld()
  patch.update(camera)
  expect(patch.getCurrentLevel()).toBe(initial)
  camera.zoom = 4
  camera.updateProjectionMatrix()
  patch.update(camera)
  expect(patch.getCurrentLevel()).toBe(0)
  camera.zoom = 0.25
  camera.updateProjectionMatrix()
  patch.update(camera)
  expect(patch.getCurrentLevel()).toBe(2)
})
