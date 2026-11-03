import {
  DataTexture,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  Object3D,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import type { Point } from '../domain/schema'

const TEXTURE_SIZE = 512
const TEXTURE_REPEAT_METRES = 4
const MAX_CLODS = 4_000
const CLOD_SPACING = 0.28
const CLOD_COLORS = ['#55523d', '#676148', '#4b4b38', '#73694c']

function hash(x: number, z: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function noise(x: number, z: number, period: number) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = x - ix, fz = z - iz
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
  const wrap = (value: number) => ((value % period) + period) % period
  const a = hash(wrap(ix), wrap(iz)) * (1 - sx) + hash(wrap(ix + 1), wrap(iz)) * sx
  const b = hash(wrap(ix), wrap(iz + 1)) * (1 - sx) + hash(wrap(ix + 1), wrap(iz + 1)) * sx
  return a * (1 - sz) + b * sz
}

function makeSoilTexture() {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let z = 0; z < TEXTURE_SIZE; z++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const u = x / TEXTURE_SIZE, v = z / TEXTURE_SIZE
    const broad = noise(u * 4, v * 4, 4) - 0.5
    const clumps = noise(u * 32, v * 32, 32) - 0.5
    const fine = noise(u * 128, v * 128, 128) - 0.5
    const grain = hash(x, z) - 0.5
    const shade = 0.96 + broad * 0.22 + clumps * 0.21 + fine * 0.11 + grain * 0.13
    const warm = noise(u * 8 + 19, v * 8 + 7, 8) - 0.5
    const fleck = hash(x + 73, z - 41)
    const mineral = fleck > 0.996 ? 19 : fleck < 0.006 ? -14 : 0
    const offset = (z * TEXTURE_SIZE + x) * 4
    pixels[offset] = Math.max(0, Math.min(255, Math.round(91 * shade + warm * 9 + mineral)))
    pixels[offset + 1] = Math.max(0, Math.min(255, Math.round(88 * shade + mineral * 0.88)))
    pixels[offset + 2] = Math.max(0, Math.min(255, Math.round(65 * shade - warm * 4 + mineral * 0.68)))
    pixels[offset + 3] = 255
  }
  // A few irregular dark crumbs add close-up detail without tiling a decal.
  for (let mark = 0; mark < 1_800; mark++) {
    const x = Math.floor(hash(mark, 17) * TEXTURE_SIZE)
    const z = Math.floor(hash(mark, 43) * TEXTURE_SIZE)
    const radiusX = 1 + Math.floor(hash(mark, 71) * 3)
    const radiusZ = 1 + Math.floor(hash(mark, 97) * 2)
    const delta = hash(mark, 131) < 0.7 ? -10 : 8
    for (let dz = -radiusZ; dz <= radiusZ; dz++) for (let dx = -radiusX; dx <= radiusX; dx++) {
      if ((dx / radiusX) ** 2 + (dz / radiusZ) ** 2 > 1) continue
      const px = (x + dx + TEXTURE_SIZE) % TEXTURE_SIZE
      const pz = (z + dz + TEXTURE_SIZE) % TEXTURE_SIZE
      const offset = (pz * TEXTURE_SIZE + px) * 4
      for (let channel = 0; channel < 3; channel++)
        pixels[offset + channel] = Math.max(0, Math.min(255, pixels[offset + channel]! + delta))
    }
  }
  const texture = new DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1 / TEXTURE_REPEAT_METRES, 1 / TEXTURE_REPEAT_METRES)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export const soilTexture = makeSoilTexture()

function containsPoint(outline: readonly Point[], x: number, z: number) {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function makeSoilClods(outline: readonly Point[], elevation: number): InstancedMesh | null {
  if (outline.length < 3) return null
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of outline) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  const width = maxX - minX, depth = maxZ - minZ
  if (width <= 0 || depth <= 0) return null
  const spacing = Math.max(CLOD_SPACING, Math.sqrt(width * depth / MAX_CLODS), width / MAX_CLODS, depth / MAX_CLODS)
  const placements: { x: number; z: number; size: number; seedX: number; seedZ: number }[] = []
  for (let row = 0; row < Math.ceil(depth / spacing); row++) for (let column = 0; column < Math.ceil(width / spacing); column++) {
    const seedX = Math.floor(minX / spacing) + column, seedZ = Math.floor(minZ / spacing) + row
    if (hash(seedX + 11, seedZ - 23) > 0.55) continue
    const x = minX + (column + 0.2 + hash(seedX, seedZ) * 0.6) * spacing
    const z = minZ + (row + 0.2 + hash(seedZ, seedX + 7) * 0.6) * spacing
    if (containsPoint(outline, x, z)) placements.push({ x, z, size: hash(seedX + 41, seedZ + 3), seedX, seedZ })
  }
  if (!placements.length) return null
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true })
  const clods = new InstancedMesh(new IcosahedronGeometry(1, 0), material, placements.length)
  const dummy = new Object3D()
  const color = material.color.clone()
  placements.forEach(({ x, z, size, seedX, seedZ }, index) => {
    const height = 0.006 + size * 0.009
    dummy.position.set(x, elevation + 0.018 + height * 0.45, z)
    dummy.rotation.set(hash(seedX, seedZ + 17) * 0.25, hash(seedX + 29, seedZ) * Math.PI * 2, hash(seedX - 7, seedZ) * 0.2)
    dummy.scale.set(0.016 + size * 0.021, height, 0.013 + hash(seedX, seedZ - 31) * 0.023)
    dummy.updateMatrix()
    clods.setMatrixAt(index, dummy.matrix)
    color.set(CLOD_COLORS[Math.floor(hash(seedX + 53, seedZ - 11) * CLOD_COLORS.length)]!)
    clods.setColorAt(index, color)
  })
  clods.instanceMatrix.needsUpdate = true
  if (clods.instanceColor) clods.instanceColor.needsUpdate = true
  clods.name = 'ground-area-soil-clods'
  clods.castShadow = false
  clods.receiveShadow = true
  clods.raycast = () => {}
  return clods
}
