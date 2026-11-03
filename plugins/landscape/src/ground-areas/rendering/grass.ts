import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  FrontSide,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Object3D,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { attribute, positionLocal, time, vec3 } from 'three/tsl'
import type { Point } from '../domain/schema'

const TEXTURE_SIZE = 512
const MAX_BLADES = 12_000
const BLADE_SPACING = 0.17
const GRASS_COLORS = ['#748050', '#6c7d4d', '#89915b', '#5c7349']

function hash(x: number, z: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function noise(x: number, z: number, period: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const sx = fx * fx * (3 - 2 * fx)
  const sz = fz * fz * (3 - 2 * fz)
  const wrap = (value: number) => ((value % period) + period) % period
  const sample = (dx: number, dz: number) =>
    hash(wrap(ix + dx), wrap(iz + dz))
  const a = sample(0, 0) * (1 - sx) + sample(1, 0) * sx
  const b = sample(0, 1) * (1 - sx) + sample(1, 1) * sx
  return a * (1 - sz) + b * sz
}

// The texture covers sixteen world metres per repeat. Use the same broad
// noise when placing blades so pale and dark tufts follow the ground beneath.
function grassPatchAt(x: number, z: number) {
  return noise(x / 4, -z / 4, 4)
}

export function makeGrassTexture(base: readonly [number, number, number] = [109, 130, 79], metresPerRepeat = 16) {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let z = 0; z < TEXTURE_SIZE; z++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const u = x / TEXTURE_SIZE
      const v = z / TEXTURE_SIZE
      const broad = noise(u * 4, v * 4, 4)
      const fine = noise(u * 32, v * 32, 32)
      const grain = hash(x, z)
      const stripe = Math.sin(u * Math.PI * 4) * 0.018
      const shade = 0.82 + broad * 0.22 + fine * 0.07 + (grain - 0.5) * 0.035 + stripe
      const fleck = grain > 0.99 ? 0.06 : 0
      const offset = (z * TEXTURE_SIZE + x) * 4
      pixels[offset] = Math.min(255, Math.round(base[0] * (shade + fleck)))
      pixels[offset + 1] = Math.min(255, Math.round(base[1] * (shade + fleck)))
      pixels[offset + 2] = Math.min(255, Math.round(base[2] * (shade + fleck * 0.6)))
      pixels[offset + 3] = 255
    }
  }
  // Small, directional marks add close-up turf detail without extra meshes.
  // Their positions and tones are deterministic across reloads.
  for (let mark = 0; mark < 6500; mark++) {
    const x = Math.floor(hash(mark, 17) * TEXTURE_SIZE)
    const z = Math.floor(hash(mark, 43) * TEXTURE_SIZE)
    const length = 1 + Math.floor(hash(mark, 71) * 4)
    const lean = hash(mark, 97) < 0.5 ? -1 : 1
    const light = hash(mark, 131) < 0.48
    for (let step = 0; step < length; step++) {
      const px = (x + lean * Math.floor(step / 2) + TEXTURE_SIZE) % TEXTURE_SIZE
      const pz = (z + step) % TEXTURE_SIZE
      const offset = (pz * TEXTURE_SIZE + px) * 4
      const delta = light ? 10 : -9
      pixels[offset] = Math.max(0, Math.min(255, pixels[offset]! + delta))
      pixels[offset + 1] = Math.max(0, Math.min(255, pixels[offset + 1]! + delta))
      pixels[offset + 2] = Math.max(0, Math.min(255, pixels[offset + 2]! + delta * 0.7))
    }
  }
  const texture = new DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1 / metresPerRepeat, 1 / metresPerRepeat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export const grassTexture = makeGrassTexture()

function containsPoint(outline: readonly Point[], x: number, z: number) {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!
    const b = outline[j]!
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside
  }
  return inside
}

function makeBladeGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -0.5, 0, 0,
    0.5, 0, 0,
    -0.3, 0.46, 0.035,
    0.3, 0.46, 0.035,
    0.12, 1, 0.14,
  ], 3))
  // The reference lawn lights each tiny blade as upward-facing turf. Explicit
  // upward normals keep the varied rotations from reading as black dashes.
  geometry.setAttribute('normal', new Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3))
  geometry.setAttribute('windWeight', new Float32BufferAttribute([0, 0, 0.2, 0.2, 1], 1))
  // Draw both faces with front-facing triangles so the renderer does not flip
  // those normals when a blade is seen from behind.
  geometry.setIndex(new Uint16BufferAttribute([
    0, 1, 2, 1, 3, 2, 2, 3, 4,
    2, 1, 0, 2, 3, 1, 4, 3, 2,
  ], 1))
  return geometry
}

export function makeGrassBlades(outline: readonly Point[], elevation: number, contains: (x: number, z: number) => boolean): InstancedMesh | null {
  if (outline.length < 3) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of outline) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const width = maxX - minX
  const depth = maxZ - minZ
  if (width <= 0 || depth <= 0) return null

  const spacing = Math.max(
    BLADE_SPACING,
    Math.sqrt(width * depth / MAX_BLADES),
    width / MAX_BLADES,
    depth / MAX_BLADES,
  )
  const columns = Math.ceil(width / spacing)
  const rows = Math.ceil(depth / spacing)
  const placements: [number, number, number, number, number, number, number][] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const seedX = Math.floor(minX / spacing) + column
      const seedZ = Math.floor(minZ / spacing) + row
      const x = minX + (column + 0.15 + hash(seedX, seedZ) * 0.7) * spacing
      const z = minZ + (row + 0.15 + hash(seedZ, seedX + 7) * 0.7) * spacing
      if (!containsPoint(outline, x, z) || !contains(x, z)) continue
      const patch = grassPatchAt(x, z)
      // Let blade coverage ebb with the broad lawn color variation.
      if (hash(seedX + 13, seedZ - 47) > 0.64 + patch * 0.28) continue
      const variety = hash(seedX + 41, seedZ - 19)
      placements.push([x, z, variety, hash(seedX - 17, seedZ + 31), seedX, seedZ, patch])
    }
  }
  if (!placements.length) return null

  // Shuffle once so reducing InstancedMesh.count at a distance keeps an even
  // spread across the whole lawn rather than revealing only the first rows.
  for (let index = placements.length - 1; index > 0; index--) {
    const swap = Math.floor(hash(index, placements.length) * (index + 1))
    ;[placements[index], placements[swap]] = [placements[swap]!, placements[index]!]
  }
  const material = new MeshStandardNodeMaterial({
    color: '#ffffff',
    emissive: '#617744',
    emissiveIntensity: 0.25,
    roughness: 0.98,
    side: FrontSide,
  })
  const geometry = makeBladeGeometry()
  const phases = new Float32Array(placements.length)
  geometry.setAttribute('windPhase', new InstancedBufferAttribute(phases, 1))
  const phase = attribute<'float'>('windPhase', 'float')
  const weight = attribute<'float'>('windWeight', 'float')
  const wave = time.mul(0.83).add(phase).sin()
    .add(time.mul(1.31).add(phase.mul(1.31)).sin().mul(0.35))
  material.positionNode = positionLocal.add(vec3(
    wave.mul(weight).mul(0.3),
    0,
    wave.mul(weight).mul(0.015),
  ))
  const blades = new InstancedMesh(geometry, material, placements.length)
  const dummy = new Object3D()
  const color = material.color.clone()
  placements.forEach(([x, z, variety, lean, seedX, seedZ, patch], index) => {
    const height = 0.055 + variety * 0.065
    const width = 0.012 + lean * 0.011
    const depth = 0.4 + variety * 0.5
    const tiltX = (lean - 0.5) * 0.16
    const tiltZ = (variety - 0.5) * 0.16
    const angle = hash(seedX + 91, seedZ) * Math.PI * 2
    phases[index] = x * 0.64 + z * 0.54 + hash(seedX - 11, seedZ + 29) * 0.65
    dummy.position.set(x, elevation + 0.025, z)
    dummy.rotation.set(tiltX, angle, tiltZ)
    dummy.scale.set(width, height, depth)
    dummy.updateMatrix()
    blades.setMatrixAt(index, dummy.matrix)
    color.set(GRASS_COLORS[Math.min(GRASS_COLORS.length - 1, Math.floor(hash(seedX, seedZ + 53) * GRASS_COLORS.length))]!)
    color.multiplyScalar(0.86 + patch * 0.2 + hash(seedX - 29, seedZ + 61) * 0.12)
    blades.setColorAt(index, color)
  })
  blades.instanceMatrix.needsUpdate = true
  if (blades.instanceColor) blades.instanceColor.needsUpdate = true
  blades.computeBoundingSphere()
  if (blades.boundingSphere) blades.boundingSphere.radius += 0.02
  const fullCount = placements.length
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const radius = Math.hypot(width, depth) / 2
  const cameraPosition = new Vector3()
  blades.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(cameraPosition)
    blades.worldToLocal(cameraPosition)
    const nearest = Math.max(0, Math.hypot(cameraPosition.x - centerX, cameraPosition.z - centerZ,
      cameraPosition.y - elevation) - radius)
    blades.count = nearest > 40 ? Math.max(1, Math.ceil(fullCount * 0.25))
      : nearest > 15 ? Math.max(1, Math.ceil(fullCount * 0.5)) : fullCount
  }
  blades.name = 'ground-area-grass-blades'
  blades.castShadow = false
  blades.receiveShadow = true
  blades.raycast = () => {}
  return blades
}
