import { describe, expect, spyOn, test } from 'bun:test'
import { SiteNode, type AnyNode, type GeometryContext } from '@pascal-app/core'
import { Mesh, Raycaster, Vector3 } from 'three'
import { PondNode } from './schema'
import { createPondTerrainField, pondCapacity, pondTerrainBounds } from './terrain'
import { createWaveField } from './wave-field.js'
import { disturbPondWater, getPondWaterState, stirPondWater, updatePondWaterSettings } from './water'
import { resolvePondTerrainPatch } from './site-terrain'
import { buildPondFloorplan, buildPondGeometry, disposePondGeometry, pondOutline, pondWaterHeight, updatePondWater } from './geometry'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { buildGroundAreaGeometry } from '../ground-areas/rendering/geometry'
import { poolCutoutSignature, subtractPoolCutouts } from '../shared/pool-cutouts'
import { landscapeQuantity, polygonArea } from '../editor/quantities'

const parentId = 'level_pondtest'
const ground = GroundAreaNode.parse({ parentId, surface: 'soil', outline: [[-12, -12], [12, -12], [12, 12], [-12, 12]] })
const context = (pond: PondNode) => ({ sceneNodes: { [pond.id]: pond, [ground.id]: ground } }) as unknown as GeometryContext
const hitsAt = (group: ReturnType<typeof buildPondGeometry>, x = 0, z = 0) => {
  group.updateMatrixWorld(true)
  return new Raycaster(new Vector3(x, 10, z), new Vector3(0, -1, 0)).intersectObject(group, true)
}

describe('Pond model and rendering', () => {
  test('water always stays above the bed, with finite bounded settings', () => {
    const node = PondNode.parse({ basinDepth: 0.15, waterDrop: 0.12 })
    expect(pondWaterHeight(node)).toBeGreaterThan(node.elevation - node.basinDepth)
    for (const patch of [{ basinDepth: -1 }, { width: NaN }, { bankWidth: 0 }, { rippleStrength: 2 }, { waterColor: 'red' }])
      expect(PondNode.safeParse(patch).success).toBe(false)
  })
  for (const shape of ['rectangle', 'oval', 'circle', 'custom', 'freehand'] as const) {
    test(`${shape} pond renders water and rocks without another ground plane`, () => {
      const node = PondNode.parse({ shape, width: 5, depth: 3, elevation: 0.2,
        outline: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [0.1, 0.1], [-0.5, 0.5]] })
      const group = buildPondGeometry(node)
      const water = group.getObjectByName('pond-water') as Mesh
      expect(water.position.y).toBeCloseTo(0.16)
      expect(group.getObjectByName('pond-terrain')).toBeUndefined()
      expect(group.getObjectByName('pond-bed')).toBeUndefined()
      expect(hitsAt(group).filter(hit => hit.object.name === 'pond-bank')).toHaveLength(0)
      expect(hitsAt(group).some(hit => hit.object.name === 'pond-water')).toBe(true)
      group.traverse(object => {
        if (object instanceof Mesh) expect(Array.from(object.geometry.attributes.position!.array).every(Number.isFinite)).toBe(true)
      })
      expect(buildPondFloorplan(node, {} as GeometryContext).kind).toBe('group')
      expect(landscapeQuantity(node as unknown as AnyNode).area).toBeGreaterThan(0)
      disposePondGeometry(group)
    })
  }
  test('circle ignores stale length, quantities match its circular footprint', () => {
    const node = PondNode.parse({ shape: 'circle', width: 4, depth: 9 })
    expect(polygonArea(pondOutline(node))).toBeCloseTo(Math.PI * 4, 1)
    expect(landscapeQuantity(node as unknown as AnyNode).area).toBeCloseTo(pondCapacity(node).area)
  })
  test('water uses a native node material and updates its time without rebuilding geometry', () => {
    const group = buildPondGeometry(PondNode.parse({ width: 30, depth: 30, rockBorder: 'clusters' }))
    const water = group.getObjectByName('pond-water') as Mesh
    const material = water.material as import('three/webgpu').MeshBasicNodeMaterial
    expect(material.isNodeMaterial).toBe(true)
    expect(material.colorNode).toBeDefined()
    expect(material.positionNode).toBeDefined()
    updatePondWater(group, 2.5)
    expect(getPondWaterState(water)!.time.value).toBe(.05)
    const stones = group.getObjectByName('pond-underwater-pebbles') as import('three').InstancedMesh
    expect(stones.count).toBeLessThanOrEqual(1600)
    expect(group.getObjectByName('pond-rocks')!.userData.pondRockObstacles.filter((rock: { kind: string }) => rock.kind === 'pond-shore-rock')).toHaveLength(32)
    expect(group.getObjectByName('pond-rocks')!.children.filter(object => object.name === 'pond-shore-rock-batch')).toHaveLength(1)
    disposePondGeometry(group)
  })
  test('appearance and motion edits preserve live water resources and wave energy', () => {
    const node = PondNode.parse({})
    const group = buildPondGeometry(node), water = group.getObjectByName('pond-water') as Mesh
    const state = getPondWaterState(water)!, material = water.material, geometry = water.geometry
    disturbPondWater(group, new Vector3(0, 0, 0), .5)
    updatePondWater(group, .032)
    const energy = state.waves.stats().energy
    updatePondWaterSettings(group, { ...node, waterClarity: 1.8, waterColor: '#224466', rain: .5, fishResponse: .4 })
    expect(water.material).toBe(material)
    expect(water.geometry).toBe(geometry)
    expect(getPondWaterState(water)).toBe(state)
    expect(state.settings.waterClarity.value).toBe(1.8)
    expect(state.settings.tint.value.getHexString()).toBe('224466')
    expect(state.waves.stats().energy).toBe(energy)
    expect(state.rain).toBe(.5)
    disposePondGeometry(group)
  })
  test('water continues animating when the editor replaces its material with a clone', () => {
    const group = buildPondGeometry(PondNode.parse({}))
    const water = group.getObjectByName('pond-water') as Mesh
    const original = water.material as import('three/webgpu').MeshBasicNodeMaterial
    const state = getPondWaterState(water)!
    const clone = original.clone()
    water.material = clone
    expect(clone.colorNode).toBe(original.colorNode)
    expect(clone.positionNode).toBe(original.positionNode)
    expect(clone.userData.pondWater).toBeUndefined()
    const version = state.waveTexture.version
    disturbPondWater(group, new Vector3(0, 0, 0), .5)
    stirPondWater(group, new Vector3(0, 0, 0), new Vector3(.1, 0, .1), .016)
    expect(() => updatePondWater(group, .032)).not.toThrow()
    expect(state.time.value).toBe(.032)
    expect(state.waveTexture.version).toBeGreaterThan(version)
    expect(state.waves.stats().stepCount).toBeGreaterThan(0)
    expect(state.waves.stats().energy).toBeGreaterThan(0)
    const waveDispose = spyOn(state.waveTexture, 'dispose')
    const terrainDispose = spyOn(state.terrainTexture, 'dispose')
    const originalDispose = spyOn(original, 'dispose')
    const cloneDispose = spyOn(clone, 'dispose')
    expect(() => disposePondGeometry(group)).not.toThrow()
    for (const dispose of [waveDispose, terrainDispose, originalDispose, cloneDispose]) {
      expect(dispose).toHaveBeenCalledTimes(1)
      dispose.mockRestore()
    }
    expect(getPondWaterState(water)).toBeUndefined()
    expect(() => updatePondWater(group, .064)).not.toThrow()
  })
})

describe('Terrain based ground integration', () => {
  test('ponds no longer punch rectangular pool holes in landscape ground', () => {
    const pond = PondNode.parse({ parentId })
    const geometry = buildGroundAreaGeometry(ground, context(pond))
    expect(hitsAt(geometry).length).toBeGreaterThan(0)
    expect(hitsAt(geometry, 8)).not.toHaveLength(0)
    disposePondGeometry(geometry)
  })
  test('ground surface drapes down into the actual sculpted site basin', () => {
    const site = SiteNode.parse({ id: 'site_drape' })
    const pond = PondNode.parse({ parentId: site.id })
    const earth = GroundAreaNode.parse({ ...ground, parentId: site.id, elevation: .3 })
    const nodes = { [site.id]: site, [pond.id]: pond, [earth.id]: earth } as unknown as NonNullable<GeometryContext['sceneNodes']>
    const patch = resolvePondTerrainPatch(site, nodes)!
    const sculpted = SiteNode.parse({ ...site, ...patch })
    const geometry = buildGroundAreaGeometry(earth, { sceneNodes: { ...nodes, [site.id]: sculpted } } as GeometryContext)
    expect(hitsAt(geometry)[0]!.point.y).toBeLessThan(-.65)
    expect(hitsAt(geometry, 8)[0]!.point.y).toBeCloseTo(.318)
    disposePondGeometry(geometry)
  })
  test('pond outline and transforms are excluded from the old pool cutout machinery', () => {
    const pond = PondNode.parse({ parentId, shape: 'rectangle', width: 4, depth: 2,
      rotation: [0, Math.PI / 2, 0], position: [3, 0, 2] })
    const source: [number, number][][][] = [[ground.outline]]
    const cut = subtractPoolCutouts(source, ground, context(pond))
    expect(cut).toEqual(source)
    expect(subtractPoolCutouts(source, ground, context({ ...pond, visible: false }))).toEqual(source)
    expect(subtractPoolCutouts(source, ground, context({ ...pond, parentId: 'level_other' }))).toEqual(source)
    expect(poolCutoutSignature(pond)).toBeNull()
  })
})


describe('Natural excavated terrain', () => {
  test('bed rises through a broad shelf with a continuous tangent at the shore', () => {
    const node = PondNode.parse({ shape: 'circle', width: 6, basinDepth: 1.5, waterDrop: 0 })
    const field = createPondTerrainField(node)
    expect(field.height(0, 0)).toBeLessThan(-1.5)
    expect(field.height(1.5, 0)).toBeLessThan(-1.4)
    expect(field.height(2.25, 0)).toBeGreaterThan(-.9)
    expect(field.height(2.25, 0)).toBeLessThan(-.6)
    expect(field.height(2.85, 0)).toBeGreaterThan(-.05)
    expect(Math.abs(field.height(3 + .0001, 0) - field.height(3 - .0001, 0))).toBeLessThan(.00001)
    const b = field.bounds
    for (const [x, z] of [[b.minX, 0], [b.maxX, 0], [0, b.minZ], [0, b.maxZ]]) {
      expect(field.height(x!, z!)).toBeCloseTo(.018)
      expect(field.blendAt(x!, z!)).toBe(0)
    }
  })
  test('natural oval has the reference perturbation rather than an exact ellipse', () => {
    const node = PondNode.parse({ width: 18.2, depth: 13.6, basinDepth: 1.5 })
    const outline = pondOutline(node), field = createPondTerrainField(node)
    expect(outline).toHaveLength(128)
    expect(outline[0]![0]).not.toBe(9.1)
    for (const [x, z] of outline) {
      expect(field.radial(x, z)).toBeCloseTo(1)
      expect(Math.abs(field.height(x, z))).toBeLessThan(.00001)
    }
  })
  test('water triangulation ends at the actual shelf intersection', () => {
    const node = PondNode.parse({ waterDrop: .12 })
    const field = createPondTerrainField(node), group = buildPondGeometry(node)
    const water = group.getObjectByName('pond-water') as Mesh, p = water.geometry.attributes.position!
    const indices = water.geometry.index!
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i), b = indices.getX(i+1), c = indices.getX(i+2)
      const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3
      const z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3
      expect(field.height(x, z)).toBeLessThan(pondWaterHeight(node) + .002)
    }
    disposePondGeometry(group)
  })
  test('capacity reflects shelves, dry land and the off-centre deep pocket', () => {
    const node = PondNode.parse({ waterDrop: 0 }), capacity = pondCapacity(node)
    const footprint = polygonArea(pondOutline(node))
    expect(capacity.area).toBeCloseTo(footprint, 0)
    expect(capacity.volume).toBeLessThan(footprint * node.basinDepth * .8)
    expect(capacity.volume).toBeGreaterThan(footprint * node.basinDepth * .4)
    expect(pondCapacity({ ...node, waterDrop: .12 }).volume).toBeLessThan(capacity.volume)
  })
})

describe('Reference wave solver', () => {
  const makeField = () => createWaveField({ width: 6, depth: 4, nx: 48, nz: 32, terrain: (x, z) => Math.hypot(x / 3, z / 2) < .9 ? -.8 : .1 })
  test('impacts conserve volume, exclude dry land, and decay stably', () => {
    const field = makeField()
    field.disturb(0, 0, .5)
    expect(Math.abs(field.stats().mass)).toBeLessThan(.000001)
    expect(field.stats().wetCells).toBeLessThan(48 * 32)
    const initialEnergy = field.stats().energy
    for (let i = 0; i < 600; i++) field.update(1 / 60)
    expect(field.stats().energy).toBeLessThan(initialEnergy)
    expect(Array.from(field.heights).every(Number.isFinite)).toBe(true)
    expect(Math.abs(field.stats().mass)).toBeLessThan(.00001)
    expect(field.heightAt(2.9, 1.9)).toBe(0)
  })
  test('fixed-step evolution is independent of render frame grouping', () => {
    const a = makeField(), b = makeField()
    a.disturb(0, 0); b.disturb(0, 0)
    for (let i = 0; i < 60; i++) a.update(1 / 60)
    for (let i = 0; i < 120; i++) b.update(1 / 120)
    expect(a.heights).toEqual(b.heights)
    expect(a.stats().stepCount).toBe(120)
    b.setObstacles([{ x: 0, z: 0, radius: .3 }])
    b.disturb(0, 0)
    expect(b.heightAt(0, 0)).toBe(0)
  })
})
