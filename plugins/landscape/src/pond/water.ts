import { Color, DataTexture, FloatType, MathUtils, LinearFilter, RGBAFormat, Vector3, type Group, type Mesh, type Material } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { positionLocal, texture, uniform, vec2 } from 'three/tsl'
import type { SceneAtmosphereSource } from '@pascal-app/viewer'
import type { PondNode } from './schema'
import type { createPondTerrainField } from './terrain'
import { createWaveField, type WaveField } from './wave-field.js'
import { retainPondSceneCaptures } from './scene-capture'
import { getPondFishState, spookPondFish, updatePondFish } from './fish'
import { retainPondWaterLayers } from './pool-water-layers'
import { PondPoolSurface } from './pool-surface'

interface PondWaterState {
  material: MeshBasicNodeMaterial
  surface: PondPoolSurface
  settings: ReturnType<typeof waterSettings>
  time: { value: number }
  waves: WaveField
  waveTexture: DataTexture
  terrainTexture: DataTexture
  sceneCaptures: { dispose(): void }[]
  layers: ReturnType<typeof retainPondWaterLayers>
  pending: number
  previous: number
  cx: number
  cz: number
  rain: number
  rainRemainder: number
  rainSeed: number
  width: number
  depth: number
  impactPoint: Vector3
}

// Material.userData is JSON-cloned by Three.js. Runtime resources must stay
// with the water mesh even when the editor swaps in a cloned material.
const materialStates = new WeakMap<Material, PondWaterState>()
const waterStates = new WeakMap<Mesh, PondWaterState>()

export function bindPondWater(water: Mesh, material: MeshBasicNodeMaterial) {
  const state = materialStates.get(material)
  if (!state) throw new Error('Pond water material has no simulation')
  waterStates.set(water, state)
  return state
}

export function getPondWaterState(water: Mesh) {
  return waterStates.get(water)
}

/** Release the original resources even if a temporary material is now on the mesh. */
export function disposePondWater(water: Mesh) {
  const state = waterStates.get(water)
  if (!state) return
  waterStates.delete(water)
  materialStates.delete(state.material)
  state.waveTexture.dispose()
  state.terrainTexture.dispose()
  state.surface.disposeVariantsExcept(state.material)
  state.layers.release()
  state.sceneCaptures.forEach(capture => capture.dispose())
  return state.material
}

export const pondWaterHeight = (node: PondNode) => node.elevation - node.waterDrop

function waterSettings(node: PondNode) {
  return { rippleStrength: uniform(node.rippleStrength), waterClarity: uniform(node.waterClarity),
    reflectionStrength: uniform(node.reflectionStrength), refractionStrength: uniform(node.refractionStrength),
    sunGlints: uniform(node.sunGlints), underwaterLight: uniform(node.underwaterLight), tint: uniform(new Color(node.waterColor)) }
}

/** Uniform edits preserve the simulation, captures and material shader program. */
export function updatePondWaterSettings(group: Group, node: PondNode) {
  const water = group.getObjectByName('pond-water') as Mesh | undefined
  const state = water && waterStates.get(water)
  if (!state) return
  for (const key of ['rippleStrength', 'waterClarity', 'reflectionStrength', 'refractionStrength', 'sunGlints', 'underwaterLight'] as const)
    state.settings[key].value = node[key]
  state.settings.tint.value.set(node.waterColor)
  state.surface.update(node)
  const current = state.waves.getSettings()
  if (current.waveSpeed !== node.waveSpeed || current.waveDamping !== node.waveSettling)
    state.waves.setSettings({ waveSpeed: node.waveSpeed, waveDamping: node.waveSettling })
  state.rain = node.rain
  const fish = getPondFishState(group)
  if (fish) fish.node = { ...fish.node, fishResponse: node.fishResponse }
}

/** Reference shallow-water solver plus depth-dependent transmission and reflection. */
export function pondWaterMaterial(node: PondNode, field: ReturnType<typeof createPondTerrainField>, atmosphere?:SceneAtmosphereSource|null) {
  const b = field.bounds, width = b.maxX - b.minX, depth = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, nx = 128, nz = Math.max(32, Math.min(160, Math.round(128 * depth / width)))
  const waves = createWaveField({ width, depth, nx, nz, terrain: (x, z) => field.height(x + cx, z + cz) - pondWaterHeight(node) })
  waves.setSettings({ waveSpeed: node.waveSpeed, waveDamping: node.waveSettling })
  const waveTexture = new DataTexture(waves.texturePixelsRGBA, nx, nz, RGBAFormat, FloatType)
  waveTexture.minFilter = waveTexture.magFilter = LinearFilter; waveTexture.needsUpdate = true
  const waveUv = positionLocal.xz.sub(vec2(b.minX, b.minZ)).div(vec2(width, depth))
  const terrainData = new Float32Array(nx * nz * 4)
  let deepest = Infinity
  const impactPoint = new Vector3(cx,pondWaterHeight(node),cz)
  const maskAt = (x: number, z: number) => MathUtils.smoothstep(pondWaterHeight(node) - field.height(x, z), .015, .18)
  for (let row = 0; row < nz; row++) for (let col = 0; col < nx; col++) {
    const x = b.minX + (col + .5) / nx * width, z = b.minZ + (row + .5) / nz * depth, index = (row * nx + col) * 4
    terrainData[index] = field.height(x, z) - pondWaterHeight(node)
    if (terrainData[index]! < deepest) { deepest = terrainData[index]!; impactPoint.set(x,pondWaterHeight(node),z) }
    terrainData[index + 1] = maskAt(x, z)
    terrainData[index + 2] = (maskAt(x + .035, z) - maskAt(x - .035, z)) / .07
    terrainData[index + 3] = (maskAt(x, z + .035) - maskAt(x, z - .035)) / .07
  }
  const terrainTexture = new DataTexture(terrainData, nx, nz, RGBAFormat, FloatType)
  terrainTexture.minFilter = terrainTexture.magFilter = LinearFilter; terrainTexture.needsUpdate = true
  const wave = texture(waveTexture, waveUv)
  const settings = waterSettings(node)
  const time = uniform(0), strength = settings.rippleStrength
  const layers = retainPondWaterLayers()
  const captures = retainPondSceneCaptures()
  const depthTexture = captures.depth, transmissionTexture = captures.color
  const surface = new PondPoolSurface(node,wave,time,layers,depthTexture,transmissionTexture,width,depth,atmosphere,texture(terrainTexture,waveUv).r.negate().max(0))
  const material = surface.material as MeshBasicNodeMaterial
  materialStates.set(material, { material, settings, time, waves, waveTexture, terrainTexture,
    sceneCaptures: [captures], surface, layers, pending: 0, previous: 0, cx, cz,
    rain: node.rain, rainRemainder: 0, rainSeed: 71024, width, depth, impactPoint })
  return material
}

/** Cached Pool quality variants preserve shared uniforms and wave state. */
export function setPondWaterQuality(group:Group, quality:'high'|'medium') {
  const water=group.getObjectByName('pond-water') as Mesh|undefined
  const state=water&&waterStates.get(water)
  if(!state||state.surface.quality===quality||water!.material!==state.material)return
  const material=state.surface.selectQuality(quality)
  materialStates.set(material,state)
  state.material=material
  water!.material=material
}

export function updatePondWater(group: Group, seconds: number) {
  const water = group.getObjectByName('pond-water') as Mesh | undefined
  const state = water && waterStates.get(water)
  if (!state) return
  const dt = Math.min(.05, Math.max(0, seconds - state.previous))
  state.time.value += dt
  state.rainRemainder += dt * state.rain * 35
  while (state.rainRemainder >= 1) {
    const random = () => { state.rainSeed = (Math.imul(state.rainSeed,1664525) + 1013904223) >>> 0; return state.rainSeed / 4294967296 }
    state.waves.disturb((random() - .5) * state.width,(random() - .5) * state.depth,.04)
    state.rainRemainder--
  }
  state.pending += dt
  // The solver still takes fixed 1/120 s steps; publish its texture at 30 Hz.
  if (state.pending >= 1 / 30 - 1e-9 || state.previous === 0) {
    state.waves.update(state.pending); state.pending = 0
    state.waveTexture.needsUpdate = true
  }
  updatePondFish(group,seconds,state.waves,state.cx,state.cz)
  state.previous = seconds
}

export function pausePondWater(group: Group, seconds: number) {
  const water = group.getObjectByName('pond-water') as Mesh | undefined
  const state = water && waterStates.get(water)
  if (state) { state.previous = seconds; state.pending = 0 }
  const fish = getPondFishState(group)
  if (fish) fish.previous = seconds
}

/** World-space interaction can be called by a pond tool without moving the object. */
export function disturbPondWater(group: Group, point: Vector3, power = .5) {
  const water = group.getObjectByName('pond-water') as Mesh | undefined
  const state = water && waterStates.get(water)
  if (!water || !state) return
  const local = water.worldToLocal(point.clone())
  state.waves.disturb(local.x - state.cx, local.z - state.cz, power)
  spookPondFish(group,point,power)
}

export function makePondWaves(group: Group) {
  const water = group.getObjectByName('pond-water') as Mesh | undefined
  const state = water && waterStates.get(water)
  if (!state) return false
  disturbPondWater(group,group.localToWorld(state.impactPoint.clone()),.65)
  return true
}


export function stirPondWater(group: Group, from: Vector3, to: Vector3, seconds: number, power = .5) {
  const water = group.getObjectByName('pond-water') as Mesh | undefined
  const state = water && waterStates.get(water)
  if (!water || !state) return
  const a = water.worldToLocal(from.clone()), b = water.worldToLocal(to.clone())
  state.waves.stirSegment(a.x - state.cx, a.z - state.cz, b.x - state.cx, b.z - state.cz, power, seconds)
}
