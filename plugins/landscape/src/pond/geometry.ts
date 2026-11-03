import { landscapeToolColors } from '../shared/tool-colors'
import type { SceneAtmosphereSource } from '@pascal-app/viewer'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import { Group, InstancedMesh, Mesh, Vector3, type Material } from 'three'
import { pavingPolygons } from '../pathways/rendering/paving-polygons'
import { freehandFloorplanHandles } from '../ground-areas/domain/curve-edit'
import { PondNode } from './schema'
import { buildPondTerrain, createPondTerrainField, pondOutline } from './terrain'
import { pondSiteDesign, pondSiteSurfaceField } from './site-terrain'
import { originalPondRockMaterial, updatePondRockAppearance } from './materials'
import { addPondRocks } from './rocks'
import { pondRockBorder } from './rock-border'
import { bindPondWater, getPondWaterState as bindState, disposePondWater, pondWaterHeight, pondWaterMaterial } from './water'
import { addPondFish, disposePondFish, getPondFishState, koiHabitat } from './fish'
export { pondOutline } from './terrain'
export { pondWaterHeight, pondWaterMaterial, updatePondWater, disturbPondWater, stirPondWater } from './water'

export function buildPondGeometry(raw: PondNode, ctx?: GeometryContext, preview = false, atmosphere?:SceneAtmosphereSource|null): Group {
  const authored = PondNode.parse(raw)
  const { design: node, field: savedField } = pondSiteSurfaceField(authored, ctx?.sceneNodes)
  const surfaceField = preview ? createPondTerrainField(pondSiteDesign(authored, ctx?.sceneNodes).node) : savedField
  const group = new Group()
  group.name = 'pond-content'
  const { terrain, water: waterGeometry, field } = buildPondTerrain(node, surfaceField, { preview, terrainAttributes: false })
  terrain.dispose()
  const material = pondWaterMaterial(node, field, atmosphere)
  const water = new Mesh(waterGeometry, material)
  water.name = 'pond-water'; water.position.y = pondWaterHeight(node); water.renderOrder = 2
  bindPondWater(water, material)
  group.add(water)
  details.set(group, { field, node, rockKey: '', fishKey: '' })
  updatePondDetails(group, authored)
  return group
}

type Field = ReturnType<typeof buildPondTerrain>['field']
const details = new WeakMap<Group, { field: Field; node: PondNode; rockKey: string; fishKey: string }>()
export function pondRockKey(node: PondNode) {
  return JSON.stringify([node.bank, node.rockBorder, node.rockBorderPlacement, node.rockBorderSize, node.rockBorderGap,
    node.rockBorderVariation, node.rockBorderSeed, node.rockBorderShape, node.rockBorderShapeVariation,
    node.rockBorderHeightVariation, node.rockBorderPositionVariation, node.rockBorderRotationVariation])
}

/** Rebuild only the affected subsystem; the water and wave field stay alive. */
export function updatePondDetails(group: Group, authored: PondNode) {
  const state = details.get(group)
  if (!state) return
  const node = { ...authored, elevation: state.node.elevation }, field = state.field
  const rockKey = pondRockKey(node), fishKey = JSON.stringify([node.fishCount, node.fishSize, node.fishType])
  const rocksChanged = rockKey !== state.rockKey
  if (rocksChanged) {
    const previous = group.getObjectByName('pond-rocks') as Group | undefined
    const rocks = new Group(); rocks.name = 'pond-rocks'
    addPondRocks(rocks, node, field)
    const water = group.getObjectByName('pond-water') as Mesh
    const waterPosition = new Vector3()
    rocks.traverse(object => {
      if (!(object instanceof Mesh)) return
      const material = object.material as Material
      if (material.userData?.pondBaseElevation) object.onBeforeRender = () => {
        material.userData.pondBaseElevation.value = water.getWorldPosition(waterPosition).y + node.waterDrop
      }
    })
    group.add(rocks)
    if (previous) { group.remove(previous); queueMicrotask(() => disposePondGeometry(previous)) }
    const waterState = bindState(water)
    if (waterState) waterState.waves.setObstacles(rocks.userData.pondRockObstacles
      .filter((rock: RockObstacle) => rock.kind === 'pond-shore-rock' && rock.top > pondWaterHeight(node))
      .map((rock: RockObstacle) => ({ ...rock, x: rock.x - waterState.cx, z: rock.z - waterState.cz })))
    state.rockKey = rockKey
  }
  updatePondRockAppearance(group.getObjectByName('pond-rocks') as Group, node)
  const obstacles = group.getObjectByName('pond-rocks')!.userData.pondRockObstacles as RockObstacle[]
  if (fishKey !== state.fishKey) {
    const previous = group.getObjectByName('pond-fish') as Group | undefined
    const fish = new Group(); fish.name = 'pond-fish'
    addPondFish(fish, node, field, obstacles); group.add(fish)
    if (previous) { group.remove(previous); queueMicrotask(() => disposePondGeometry(previous)) }
    state.fishKey = fishKey
  } else if (rocksChanged) {
    const fish = getPondFishState(group)
    if (fish) Object.assign(fish, koiHabitat(node, field, obstacles))
  }
}
type RockObstacle = { x: number; z: number; radius: number; top: number; kind: string }

const path = (ring: number[][]) => ring.map(([x, z], i) => `${i ? 'L' : 'M'} ${x} ${z}`).join(' ') + ' Z'
export function buildPondFloorplan(node: PondNode, ctx: GeometryContext): FloorplanGeometry {
  const outline = pondOutline(node)
  const bank = pavingPolygons.inset([[outline]], -node.bankWidth)
  const children: FloorplanGeometry[] = []
  children.push(...bank.map<FloorplanGeometry>(polygon => ({ kind: 'path', d: polygon.map(path).join(' '),
    fill: '#a69c86', fillRule: 'evenodd', stroke: ctx.viewState?.selected ? landscapeToolColors.selected : '#716c5b', strokeWidth: 0.025 })))
  children.push({ kind: 'path', d: path(outline), fill: node.waterColor, stroke: '#27696e', strokeWidth: 0.025 })
  children.push(...pondRockBorder(node).map<FloorplanGeometry>(rock => rock.stoneFootprint ? ({kind: 'path', d: path(rock.stoneFootprint),fill:'#a8a294',stroke:'#706b61',strokeWidth:.01}) : ({ kind: 'circle',
    cx: rock.x, cy: rock.z, r: rock.size * Math.max(rock.aspect, 1 / rock.aspect) / 2, fill: '#817a6d', stroke: '#5e594f', strokeWidth: .015 })))
  if (ctx.viewState?.selected && node.shape === 'freehand') children.push(...freehandFloorplanHandles(node))
  else if (ctx.viewState?.selected && !['circle', 'oval'].includes(node.shape)) {
    outline.forEach((a, index) => {
      const b = outline[(index + 1) % outline.length]!
      children.push({ kind: 'edge-handle', x1: a[0], y1: a[1], x2: b[0], y2: b[1], affordance: 'move-edge', payload: { edgeIndex: index } },
        { kind: 'midpoint-handle', point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], affordance: 'add-vertex', payload: { edgeIndex: index } },
        { kind: 'endpoint-handle', point: a, state: 'idle', affordance: 'move-vertex', payload: { vertexIndex: index } })
    })
  }
  return { kind: 'group', children, transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation[1] } }
}

export function disposePondGeometry(group: Group) {
  const materials = new Set<Material>(), geometries = new Set<import('three').BufferGeometry>()
  group.traverse(object => {
    if (object instanceof Group) for (const material of disposePondFish(object)) materials.add(material)
    if (!(object instanceof Mesh)) return
    const originalRockMaterial = originalPondRockMaterial(object)
    if (originalRockMaterial) materials.add(originalRockMaterial)
    const originalWaterMaterial = disposePondWater(object)
    if (originalWaterMaterial) materials.add(originalWaterMaterial)
    if (object instanceof InstancedMesh) object.dispose()
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => {
    material.dispose()
  })
}
