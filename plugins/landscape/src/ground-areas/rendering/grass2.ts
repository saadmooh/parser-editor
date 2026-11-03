/** Experimental flowering grass, separate from the existing lawn renderer. */
import type { Grass2Settings, Point } from '../domain/schema'
import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  FrontSide,
  Group,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Object3D,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Uint16BufferAttribute,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { grass2GroundTexture } from './grass2-ground'
import { grassTipTransmission } from './grass2-lighting'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import {
  attribute,
  cameraWorldMatrix,
  color,
  mix,
  smoothstep,
  uniform,
  varying,
  vec2,
  normalWorldGeometry,
  cameraViewMatrix,
  transformDirection,
  modelWorldMatrix,
  modelWorldMatrixInverse,
  positionLocal,
  texture,
  time,
  uv,
  vec3,
  vec4,
} from 'three/tsl'
import grassAtlas from '../assets/grass2-meadow-clumps.webp'
import { densityCounts, Grass2Patch } from './grass2-lod'
import { Grass2Stream } from './grass2-stream'
import type { GrassEdgeSampler } from './grass2-edge'

type Grass2FlowerMix = Grass2Settings['flowerMix']
export const DEFAULT_GRASS2_SETTINGS: Grass2Settings = {
  mode: 'blades',
  lighting: true,
  density: 1,
  height: 1,
  flowers: true,
  flowerDensity: 0.6,
  flowerMix: 'mixed',
  wind: 0.55,
  seed: 1,
}
const makeWindUniform = (strength: number) => uniform(strength)
type WindUniform = ReturnType<typeof makeWindUniform>
const PATCH_SIZE = 15
let sharedAtlas: Texture | undefined

function getGrassAtlas() {
  if (sharedAtlas) return sharedAtlas
  // TextureLoader needs a DOM image. Keep geometry construction available in tests and SSR.
  const atlas = typeof document === 'undefined'
    ? new Texture()
    : new TextureLoader().load(grassAtlas.src)
  atlas.colorSpace = SRGBColorSpace
  atlas.magFilter = LinearFilter
  atlas.minFilter = LinearMipmapLinearFilter
  sharedAtlas = atlas
  return atlas
}
const FLOWER_COLORS = {
  dandelion: '#efc844',
  clover: '#e9e4d6',
  violet: '#8c74bd',
  blue: '#8ca8dc',
} as const
type Flower = keyof typeof FLOWER_COLORS
const FLOWERS = Object.keys(FLOWER_COLORS) as Flower[]

type Plant = {
  edgeX: number
  edgeZ: number
  x: number
  z: number
  groundY: number
  height: number
  angle: number
  phase: number
  shade: number
  lod: number
}
type Bloom = Plant & { kind: Flower; size: number }

function hash(x: number, z: number, seed: number) {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(z, 668265263) ^
    Math.imul(seed, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function patch(x: number, z: number, seed: number, scale: number) {
  const px = x / scale,
    pz = z / scale
  const ix = Math.floor(px),
    iz = Math.floor(pz)
  const tx = px - ix,
    tz = pz - iz
  const sx = tx * tx * (3 - 2 * tx),
    sz = tz * tz * (3 - 2 * tz)
  const a = hash(ix, iz, seed) * (1 - sx) + hash(ix + 1, iz, seed) * sx
  const b = hash(ix, iz + 1, seed) * (1 - sx) + hash(ix + 1, iz + 1, seed) * sx
  return a * (1 - sz) + b * sz
}
function inside(outline: readonly Point[], x: number, z: number) {
  let hit = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!,
      b = outline[j]!
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit
  }
  return hit
}
function billboardGeometry() {
  const positions: number[] = []
  const uvs: number[] = []
  const weights: number[] = []
  const indices: number[] = []
  const segments = 1
  for (let row = 0; row <= segments; row++) {
    const t = row / segments
    for (const side of [-1, 1]) {
      positions.push(side * 0.55, t, 0)
      uvs.push(side < 0 ? 0.01 : 0.99, 0.01 + t * 0.98)
      weights.push(t * t)
    }
    if (row < segments) {
      const vertex = row * 2
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('windWeight', new Float32BufferAttribute(weights, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function bladeGeometry() {
  const positions: number[] = [], colors: number[] = [], weights: number[] = [], indices: number[] = []
  const ranges: { start: number; count: number }[] = []
  const base = new Color('#47652d'), tip = new Color('#9db45e')
  // Near: seven curved ribbons. Distant: four/two crossed triangles.
  for (const [blades, curved] of [[7, true], [4, false], [2, false]] as const) {
    const first = indices.length
    for (let blade = 0; blade < blades; blade++) {
      const angle = blade * Math.PI * 2 / (blades === 2 ? 4 : blades) + 0.2
      const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz, sz = dx
      const length = 0.7 + hash(blade, 11, 9) * 0.3
      const lean = 0.24 + hash(blade, 13, 7) * 0.25
      const width = 0.055 + hash(blade, 17, 4) * 0.035
      const start = positions.length / 3
      const vertices = curved ? [[0,-1], [0,1], [0.55,-0.52], [0.55,0.52], [1,0]]
        : [[0,-1], [0,1], [1,0]]
      for (const [t, side] of vertices) {
        positions.push(dx * (0.035 + lean * t! * t!) + sx * width * side!,
          length * t!, dz * (0.035 + lean * t! * t!) + sz * width * side!)
        const color = base.clone().lerp(tip, t!)
        colors.push(color.r, color.g, color.b)
        weights.push(t! * t!)
      }
      if (curved) indices.push(start,start+1,start+2,start+1,start+3,start+2,start+2,start+3,start+4)
      else indices.push(start,start+1,start+2)
    }
    ranges.push({ start: first, count: indices.length - first })
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('windWeight', new Float32BufferAttribute(weights, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.userData.grass2Ranges = ranges
  geometry.setDrawRange(ranges[0]!.start, ranges[0]!.count)
  return geometry
}

function flowerGeometry(kind: Flower) {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = []
  const petalCount =
    kind === 'clover' ? 10 : kind === 'violet' ? 5 : kind === 'blue' ? 4 : 12
  const radius = kind === 'clover' ? 0.72 : 0.94
  const base = new Color(FLOWER_COLORS[kind])
  const center = kind === 'clover' ? new Color('#b3a993') : new Color('#c9a947')
  for (let petal = 0; petal < petalCount; petal++) {
    const angle = (petal * Math.PI * 2) / petalCount
    const width = kind === 'dandelion' ? 0.19 : kind === 'clover' ? 0.27 : 0.38
    const start = positions.length / 3
    const color = base.clone().multiplyScalar(0.88 + hash(petal, 31, 4) * 0.22)
    const petalRadius = radius * (0.88 + hash(petal, 47, 5) * 0.18)
    const coords: [number, number, number][] = [
      [0.1, 0, 0],
      [0.5, -width, 0.16],
      [petalRadius, -width * 0.58, 0.21],
      [petalRadius * 1.1, 0, 0.24],
      [petalRadius, width * 0.58, 0.21],
      [0.5, width, 0.16],
    ]
    for (const [r, sideways, y] of coords) {
      positions.push(
        Math.cos(angle) * r - Math.sin(angle) * sideways,
        y,
        Math.sin(angle) * r + Math.cos(angle) * sideways,
      )
      colors.push(color.r, color.g, color.b)
    }
    indices.push(
      start,
      start + 1,
      start + 2,
      start,
      start + 2,
      start + 3,
      start,
      start + 3,
      start + 4,
      start,
      start + 4,
      start + 5,
    )
  }
  const centerStart = positions.length / 3
  positions.push(0, 0.23, 0)
  colors.push(center.r, center.g, center.b)
  for (let i = 0; i <= 12; i++) {
    const angle = (i * Math.PI * 2) / 12
    positions.push(Math.cos(angle) * 0.18, 0.2, Math.sin(angle) * 0.18)
    colors.push(center.r, center.g, center.b)
    if (i > 0) indices.push(centerStart, centerStart + i, centerStart + i + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(new Uint16BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return geometry
}
function stemGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -0.008, 0, 0, 0.008, 0, 0, -0.005, 1, 0, 0.005, 1, 0, 0, 0, -0.008,
        0, 0, 0.008, 0, 1, -0.005, 0, 1, 0.005,
      ],
      3,
    ),
  )
  geometry.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6])
  geometry.setAttribute('windWeight', new Float32BufferAttribute([0, 0, 1, 1, 0, 0, 1, 1], 1))
  geometry.computeVertexNormals()
  return geometry
}

function completeFlowerGeometry(kind: Flower) {
  const stem = stemGeometry()
  const stemColors = new Float32Array(stem.getAttribute('position').count * 3)
  const green = new Color('#658340')
  for (let i = 0; i < stemColors.length; i += 3) stemColors.set([green.r, green.g, green.b], i)
  stem.setAttribute('color', new Float32BufferAttribute(stemColors, 3))
  const head = flowerGeometry(kind)
  head.scale(0.03, 0.03, 0.03)
  head.translate(0, 1, 0)
  head.setAttribute('windWeight', new Float32BufferAttribute(new Float32Array(head.getAttribute('position').count).fill(1), 1))
  const complete = mergeGeometries([stem, head])!
  const index = complete.getIndex()!
  const near = Array.from({ length: index.count }, (_, i) => index.getX(i))
  const petalCount = (head.getAttribute('position').count - 14) / 6
  const center = stem.getAttribute('position').count + petalCount * 6
  const reduced = (far: boolean) => {
    const result = near.slice(0, 12) // Both crossed stem faces stay in every LOD.
    for (let petal = 0; petal < petalCount; petal++) {
      const start = 8 + petal * 6
      if (far) result.push(start + 1, start + 3, start + 5)
      else result.push(start, start + 1, start + 3, start, start + 3, start + 5)
    }
    const step = far ? 3 : 2
    for (let rim = 1; rim <= 12; rim += step)
      result.push(center, center + rim, center + rim + step)
    return result
  }
  const middle = reduced(false), far = reduced(true)
  complete.setIndex([...near, ...middle, ...far])
  complete.userData.grass2Ranges = [
    { start: 0, count: near.length },
    { start: near.length, count: middle.length },
    { start: near.length + middle.length, count: far.length },
  ]
  complete.setDrawRange(0, near.length)
  stem.dispose()
  head.dispose()
  return complete
}

/** One instance buffer keeps every render pass below WebGPU's eight-buffer limit. */
function setPlantAttributes(geometry: BufferGeometry, plants: readonly Plant[], atlas?: 'grass' | 'flower') {
  const stride = atlas ? 8 : 6
  const data = new Float32Array(plants.length * stride)
  const grassCells = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  plants.forEach((plant, index) => {
    const offset = index * stride
    data[offset] = plant.x
    data[offset + 1] = plant.z
    data[offset + 2] = plant.phase
    data[offset + 3] = plant.height
    data[offset + 4] = plant.edgeX
    data[offset + 5] = plant.edgeZ
    if (atlas) {
      const cell = atlas === 'grass'
        ? grassCells[Math.floor(plant.lod * grassCells.length)]!
        : FLOWERS.indexOf((plant as Bloom).kind)
      const columns = atlas === 'grass' ? 3 : 2
      data[offset + 6] = (cell % columns) / columns
      data[offset + 7] = Math.floor(cell / columns) / columns
    }
  })
  const buffer = new InstancedInterleavedBuffer(data, stride)
  geometry.setAttribute('windData', new InterleavedBufferAttribute(buffer, 4, 0))
  geometry.setAttribute('edgeBend', new InterleavedBufferAttribute(buffer, 2, 4))
  if (atlas) geometry.setAttribute('atlasCell', new InterleavedBufferAttribute(buffer, 2, 6))
}

function addWind(
  geometry: BufferGeometry,
  material: MeshBasicNodeMaterial | MeshStandardNodeMaterial,
  plants: readonly Plant[],
  strength: WindUniform,
  atlas?: 'grass' | 'flower',
) {
  setPlantAttributes(geometry, plants, atlas)

  const instance = attribute<'vec4'>('windData', 'vec4')
  const bend = attribute<'float'>('windWeight', 'float')
  const displacement = grassWindWave().mul(strength).mul(0.08).mul(instance.w).mul(bend)
  const direction = modelWorldMatrixInverse.mul(vec4(0.8, 0, 0.6, 0)).xyz.normalize()
  // A flower head and its stem tip use the same root, height, wave and offset.
  material.positionNode = positionLocal.add(direction.mul(displacement)).add(
    vec3(attribute<'vec2'>('edgeBend', 'vec2').x, 0, attribute<'vec2'>('edgeBend', 'vec2').y).mul(instance.w).mul(bend))
}

function grassWindWave() {
  const instance = attribute<'vec4'>('windData', 'vec4')
  // Sample a common breeze in world space, including across area/patch boundaries.
  // Local-space roots are valid here because the patch/content translations cancel.
  const rootWorld = modelWorldMatrix.mul(vec4(instance.x, 0, instance.y, 1)).xyz
  const alongWind = rootWorld.x.mul(0.8).add(rootWorld.z.mul(0.6))
  const broad = alongWind.mul(0.55).add(time.mul(1.35)).sin()
  const ripple = alongWind.mul(1.45).add(time.mul(2.1)).add(instance.z.mul(0.15)).sin()
  return broad.mul(0.8).add(ripple.mul(0.2))
}
function addBillboardMotion(
  geometry: BufferGeometry,
  material: MeshBasicNodeMaterial | MeshStandardNodeMaterial,
  plants: readonly Plant[],
  strength: WindUniform,
) {
  setPlantAttributes(geometry, plants, 'grass')

  const instance = attribute<'vec4'>('windData', 'vec4')
  // Use the camera basis for every card. Per-plant look-at vectors form a
  // radial fan under an overhead camera, especially with orthographic views.
  const cameraToLocal = modelWorldMatrixInverse.mul(cameraWorldMatrix)
  const right = cameraToLocal.mul(vec4(1, 0, 0, 0)).xyz.normalize()
  const up = cameraToLocal.mul(vec4(0, 1, 0, 0)).xyz.normalize()
  const weight = attribute<'float'>('windWeight', 'float')
  const wave = grassWindWave()
  const sideways = positionLocal.x.sub(instance.x)
    .add(wave.mul(strength).mul(0.12).mul(instance.w).mul(weight))
  const height = instance.w.mul(weight)
  const root = vec3(instance.x, positionLocal.y.sub(height), instance.y)
  material.positionNode = root.add(right.mul(sideways)).add(up.mul(height)).add(
    vec3(attribute<'vec2'>('edgeBend', 'vec2').x, 0, attribute<'vec2'>('edgeBend', 'vec2').y).mul(instance.w).mul(weight))
}
function flowerKind(
  x: number,
  z: number,
  seed: number,
  mix: Grass2FlowerMix,
): Flower {
  if (mix === 'clover') return 'clover'
  if (mix === 'dandelion') return 'dandelion'
  const clustered = patch(x, z, seed + 67, 1.8)
  if (mix === 'wildflowers') return clustered < 0.5 ? 'violet' : 'blue'
  if (clustered < 0.38) return 'clover'
  if (clustered < 0.7) return 'dandelion'
  return hash(Math.floor(x * 10), Math.floor(z * 10), seed) < 0.5
    ? 'violet'
    : 'blue'
}
function* placementBatches(
  outline: readonly Point[],
  contains: (x: number, z: number) => boolean,
  settings: Grass2Settings,
  heightAt: (x: number, z: number) => number,
  tile?: Box3,
  edgeAt?: GrassEdgeSampler,
): Generator<void, { plants: Plant[]; blooms: Bloom[] }> {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity
  for (const [x, z] of outline) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  if (tile) {
    minX = Math.max(minX, tile.min.x)
    maxX = Math.min(maxX, tile.max.x)
    minZ = Math.max(minZ, tile.min.z)
    maxZ = Math.min(maxZ, tile.max.z)
  }
  if (maxX <= minX || maxZ <= minZ) return { plants: [], blooms: [] }
  const area = (maxX - minX) * (maxZ - minZ)
  if (!Number.isFinite(area) || area <= 0) return { plants: [], blooms: [] }
  const density = Math.max(0.15, Math.min(2, settings.density))
  // Keep spacing in world units so resizing adds plants without thinning existing ground.
  const spacing = 0.15 / Math.sqrt(density)
  const x0 = Math.floor(minX / spacing),
    x1 = Math.ceil(maxX / spacing)
  const z0 = Math.floor(minZ / spacing),
    z1 = Math.ceil(maxZ / spacing)
  const plants: Plant[] = [],
    blooms: Bloom[] = []
  const seed = Math.round(settings.seed)
  for (let iz = z0; iz < z1; iz++) {
    for (let ix = x0; ix < x1; ix++) {
      const x = (ix + 0.5 + (hash(ix, iz, seed + 1) - 0.5) * 0.85) * spacing
      const z = (iz + 0.5 + (hash(ix, iz, seed + 2) - 0.5) * 0.85) * spacing
      if (tile && (x < tile.min.x || x >= tile.max.x || z < tile.min.z || z >= tile.max.z)) continue
      if (!inside(outline, x, z) || !contains(x, z)) continue
      const broad = patch(x, z, seed + 11, 3.8)
      const fine = patch(x, z, seed + 17, 1.1)
      const coverage = Math.min(0.94, 0.46 + broad * 0.34 + fine * 0.16)
      if (hash(ix, iz, seed + 3) > coverage) continue
      const edge = edgeAt?.(x, z)
      const height =
        (0.3 + 0.25 * hash(ix, iz, seed + 4)) *
        Math.max(0.35, Math.min(2, settings.height)) *
        (0.75 + broad * 0.4) * (1 - (edge?.amount ?? 0) * 0.2)
      const plant = {
        edgeX: (edge?.x ?? 0) * (edge?.amount ?? 0) * 0.12,
        edgeZ: (edge?.z ?? 0) * (edge?.amount ?? 0) * 0.12,
        x,
        z,
        groundY: heightAt(x, z),
        height,
        angle: hash(ix, iz, seed + 5) * Math.PI * 2,
        phase: hash(ix, iz, seed + 6) * Math.PI * 2,
        shade: broad,
        lod: hash(ix, iz, seed + 10),
      }
      plants.push(plant)
      const flowerChance =
        Math.max(0, Math.min(1, settings.flowerDensity)) *
        (0.045 + 0.19 * Math.pow(patch(x, z, seed + 37, 2.2), 2))
      if (settings.flowers && hash(ix, iz, seed + 7) < flowerChance) {
        blooms.push({
          ...plant,
          kind: flowerKind(x, z, seed, settings.flowerMix),
          height: height * (0.75 + hash(ix, iz, seed + 8) * 0.45),
          size: 0.023 + hash(ix, iz, seed + 9) * 0.012,
        })
      }
    }
    yield
  }
  return { plants, blooms }
}
function makePatchLevel(
  plants: readonly Plant[],
  blooms: readonly Bloom[],
  wind: WindUniform,
  lighting: boolean,
  detail: 'blades' | 'billboards',
): Group {
  const group = new Group()
  const dummy = new Object3D()
  const grassGeometry = detail === 'blades' ? bladeGeometry() : billboardGeometry()
  const Material = detail === 'blades' && lighting ? MeshStandardNodeMaterial : MeshBasicNodeMaterial
  const grassMaterial = new Material({
    color: '#ffffff',
    vertexColors: false,
    side: detail === 'blades' ? DoubleSide : FrontSide,
    depthWrite: true,
  })
  const instance = attribute<'vec4'>('windData', 'vec4')
  // The root sample is constant across a tuft; avoid another texture read per pixel.
  const groundColor = varying(texture(grass2GroundTexture(detail),
    vec2(instance.x, instance.y.negate()).mul(0.25), 0).rgb, 'grass2RootColor')
  const progress = attribute<'float'>('windWeight', 'float').sqrt()
  grassMaterial.userData.grass2Wind = wind
  if (detail === 'blades') {
    grassMaterial.colorNode = mix(groundColor, color('#9db45e'), smoothstep(0, 1, progress))
    if (grassMaterial instanceof MeshStandardNodeMaterial) {
      grassMaterial.roughness = 0.95
      const softNormal = vec3(normalWorldGeometry.x.mul(0.3), normalWorldGeometry.y.abs().mul(0.2).add(0.85), normalWorldGeometry.z.mul(0.3)).normalize()
      grassMaterial.normalNode = transformDirection(softNormal, cameraViewMatrix)
      grassMaterial.emissiveNode = grassTipTransmission(progress)
    }
    addWind(grassGeometry, grassMaterial, plants, wind, 'grass')
  } else {
    const atlasUv = uv().mul(0.32).add(0.0067).add(attribute<'vec2'>('atlasCell', 'vec2'))
    const atlasSample = texture(getGrassAtlas(), atlasUv)
    grassMaterial.colorNode = mix(groundColor, atlasSample.rgb, smoothstep(0, 0.35, progress))
    grassMaterial.maskNode = atlasSample.a.greaterThan(0.2)
    addBillboardMotion(grassGeometry, grassMaterial, plants, wind)
  }
  const grass = new InstancedMesh(
    grassGeometry,
    grassMaterial,
    plants.length,
  )
  grass.name = detail === 'blades' ? 'grass2-blades' : 'grass2-billboards'
  grass.userData.grass2Counts = densityCounts(plants.map((plant) => plant.lod))
  grass.castShadow = false
  grass.receiveShadow = false
  grass.raycast = () => {}
  const tint = new Color()
  plants.forEach((p, i) => {
    dummy.position.set(p.x, p.groundY + 0.024, p.z)
    dummy.rotation.set(0, detail === 'blades' ? p.angle : 0, 0)
    dummy.scale.set(p.height, p.height, p.height)
    dummy.updateMatrix()
    grass.setMatrixAt(i, dummy.matrix)
    const lightness = 0.87 + p.shade * 0.22
    grass.setColorAt(i, tint.setRGB(lightness, lightness, lightness))
  })
  grass.instanceMatrix.setUsage(DynamicDrawUsage)
  grass.instanceMatrix.needsUpdate = true
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true
  grass.computeBoundingSphere()
  if (grass.boundingSphere) {
    const cameraFacingMargin = detail === 'billboards'
      ? plants.reduce((height, plant) => Math.max(height, plant.height), 0)
      : 0
    grass.boundingSphere.radius += cameraFacingMargin + 0.35
  }
  group.add(grass)
  for (const kind of FLOWERS) {
    const flowers = blooms.filter((b) => b.kind === kind)
    if (!flowers.length) continue
    const flowerShape = completeFlowerGeometry(kind)
    const flowerMaterial = new MeshStandardNodeMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.85,
      side: DoubleSide,
    })
    addWind(flowerShape, flowerMaterial, flowers, wind)
    flowerMaterial.userData.grass2Wind = wind
    const mesh = new InstancedMesh(flowerShape, flowerMaterial, flowers.length)
    mesh.name = `grass2-${kind}`
    mesh.userData.grass2Counts = densityCounts(flowers.map((flower) => flower.lod))
    mesh.castShadow = false
    mesh.raycast = () => {}
    flowers.forEach((b, i) => {
      dummy.position.set(b.x, b.groundY + 0.025, b.z)
      dummy.rotation.set(0, b.angle, 0)
      dummy.scale.set(b.size / 0.03, b.height, b.size / 0.03)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    if (mesh.boundingSphere)
      mesh.boundingSphere.radius += flowers.reduce((padding, flower) =>
        Math.max(padding, flower.height * 0.2 + 0.01), 0.2)
    group.add(mesh)
  }
  return group
}

export function makeGrass2(
  outline: readonly Point[],
  elevation: number,
  contains: (x: number, z: number) => boolean,
  overrides: Partial<Grass2Settings> = {},
  heightAt: (x: number, z: number) => number = () => elevation,
  edgeAt?: GrassEdgeSampler,
): Group {
  const group = new Group()
  group.name = 'ground-area-grass2'
  if (outline.length < 3) return group
  const settings = { ...DEFAULT_GRASS2_SETTINGS, ...overrides }
  const work = placementBatches(outline, contains, settings, heightAt, undefined, edgeAt)
  let result = work.next()
  while (!result.done) result = work.next()
  const { plants, blooms } = result.value
  if (!plants.length) return group
  const wind = makeWindUniform(Math.max(0, Math.min(1, settings.wind)))
  const patches = new Map<string, { x: number; z: number; plants: Plant[]; blooms: Bloom[] }>()
  const patchFor = (x: number, z: number) => {
    const ix = Math.floor(x / PATCH_SIZE), iz = Math.floor(z / PATCH_SIZE)
    const key = `${ix},${iz}`
    let patch = patches.get(key)
    if (!patch) {
      patch = { x: ix, z: iz, plants: [], blooms: [] }
      patches.set(key, patch)
    }
    return patch
  }
  for (const plant of plants) patchFor(plant.x, plant.z).plants.push(plant)
  for (const bloom of blooms) patchFor(bloom.x, bloom.z).blooms.push(bloom)

  for (const patch of patches.values()) {
    const lod = makePlacedPatch(patch.plants, patch.blooms, wind, settings.mode ?? 'blades', heightAt, settings.lighting)
    lod.name = `grass2-patch-${patch.x}-${patch.z}`
    group.add(lod)
  }
  return group
}

function makePlacedPatch(
  plants: Plant[], blooms: Bloom[], wind: WindUniform, mode: Grass2Settings['mode'],
  heightAt: (x: number, z: number) => number, lighting: boolean,
) {
  const centerX = plants.reduce((sum, plant) => sum + plant.x, 0) / plants.length
  const centerZ = plants.reduce((sum, plant) => sum + plant.z, 0) / plants.length
  plants.sort((a, b) => a.lod - b.lod)
  blooms.sort((a, b) => a.lod - b.lod)
  const content = makePatchLevel(plants, blooms, wind, lighting, mode)
  const lod = new Grass2Patch(content)
  lod.maxBladeHeight = plants.reduce((height, plant) => Math.max(height, plant.height), 0)
  const centerY = heightAt(centerX, centerZ)
  lod.position.set(centerX, centerY, centerZ)
  content.position.set(-centerX, -centerY, -centerZ)
  return lod
}

/** Live viewer path. The eager builder remains available for full geometry/export. */
export function makeStreamedGrass2(
  outline: readonly Point[],
  contains: (x: number, z: number) => boolean,
  overrides: Partial<Grass2Settings>,
  heightAt: (x: number, z: number) => number,
  bounds: Box3,
  options: { previous?: Grass2Stream; tileSignature?: (x: number, z: number) => string; edgeAt?: GrassEdgeSampler } = {},
) {
  const settings = { ...DEFAULT_GRASS2_SETTINGS, ...overrides }
  const wind = makeWindUniform(Math.max(0, Math.min(1, settings.wind)))
  // Smaller batches bound the non-preemptible mesh construction work.
  const size = 8
  const build = function* (x: number, z: number): Generator<void, Grass2Patch | null> {
    const tile = new Box3()
    tile.min.set(x * size, -Infinity, z * size)
    tile.max.set((x + 1) * size, Infinity, (z + 1) * size)
    const { plants, blooms } = yield* placementBatches(outline, contains, settings, heightAt, tile, options.edgeAt)
    if (!plants.length) return null
    const patch = makePlacedPatch(plants, blooms, wind, settings.mode ?? 'blades', heightAt, settings.lighting)
    patch.name = `grass2-patch-${x}-${z}`
    return patch
  }
  const stream = options.previous ?? new Grass2Stream(bounds.clone(), size, build)
  stream.userData.grass2Wind = wind
  const { wind: _wind, ...structure } = settings
  const settingsKey = JSON.stringify(structure)
  stream.maxBladeHeight = 0.65 * settings.height
  stream.reconfigure(bounds, build, (x, z) => settingsKey + '|' +
    (options.tileSignature?.(x, z) ?? JSON.stringify(outline)),
    (patch) => updateGrass2Patch(patch, settings.wind, heightAt))
  return stream
}

export function updateGrass2Wind(root: Object3D, strength: number) {
  root.traverse((object) => {
    const fieldWind = object.userData.grass2Wind as WindUniform | undefined
    if (fieldWind) fieldWind.value = Math.max(0, Math.min(1, strength))
    if (!(object instanceof InstancedMesh)) return
    const material = object.material as MeshBasicNodeMaterial | MeshStandardNodeMaterial
    const wind = material.userData.grass2Wind as WindUniform | undefined
    if (wind) wind.value = Math.max(0, Math.min(1, strength))
  })
}

function updateGrass2Patch(patch: Grass2Patch, strength: number, heightAt: (x: number, z: number) => number) {
  updateGrass2Wind(patch, strength)
  patch.traverse((object) => {
    if (!(object instanceof InstancedMesh)) return
    const matrices = object.instanceMatrix
    let first = Infinity, last = -1
    for (let i = 0; i < matrices.count; i++) {
      const offset = i * 16
      const y = Math.fround(heightAt(matrices.array[offset + 12]!, matrices.array[offset + 14]!) +
        (object.name === 'grass2-blades' || object.name === 'grass2-billboards' ? 0.024 : 0.025))
      if (matrices.array[offset + 13] === y) continue
      matrices.array[offset + 13] = y
      first = Math.min(first, offset + 13)
      last = offset + 13
    }
    if (last < first) return
    matrices.addUpdateRange(first, last - first + 1)
    matrices.needsUpdate = true
    // Bounds must cover the full capacity, even while a reduced LOD is active.
    const visibleCount = object.count
    object.count = matrices.count
    object.computeBoundingSphere()
    object.count = visibleCount
    if (object.boundingSphere) object.boundingSphere.radius += 1.8
  })
  const centerY = heightAt(patch.position.x, patch.position.z)
  patch.position.y = centerY
  patch.content.position.y = -centerY
}
