import {
  BoxGeometry,
  DataTexture,
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
const CHIP_SPACING = 0.27
const MAX_CHIPS = 5_000
const CHIP_COLORS = ['#765139', '#896143', '#654a36', '#9b7550', '#735a41']

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

function makeMulchTexture() {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let z = 0; z < TEXTURE_SIZE; z++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const u = x / TEXTURE_SIZE, v = z / TEXTURE_SIZE
    const broad = noise(u * 8, v * 8, 8) - 0.5
    const small = noise(u * 64, v * 64, 64) - 0.5
    const grain = hash(x, z) - 0.5
    const shade = 0.9 + broad * 0.28 + small * 0.2 + grain * 0.12
    const offset = (z * TEXTURE_SIZE + x) * 4
    pixels[offset] = Math.round(112 * shade)
    pixels[offset + 1] = Math.round(77 * shade)
    pixels[offset + 2] = Math.round(52 * shade)
    pixels[offset + 3] = 255
  }

  // Short chips in several directions make the texture read as bark, while the
  // darker edge gives each piece some depth without adding dense geometry.
  for (let mark = 0; mark < 850; mark++) {
    const centerX = hash(mark, 17) * TEXTURE_SIZE
    const centerZ = hash(mark, 43) * TEXTURE_SIZE
    const angle = hash(mark, 71) * Math.PI * 2
    const longRadius = 3 + hash(mark, 97) * 7
    const shortRadius = 1 + hash(mark, 131) * 1.7
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const tone = hash(mark, 163)
    const color = tone < 0.2 ? [83, 57, 40] : tone < 0.48 ? [135, 94, 61] : tone < 0.76 ? [153, 111, 73] : [110, 80, 56]
    const reach = Math.ceil(longRadius + shortRadius + 2)
    for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
      const along = dx * cos + dz * sin
      const across = -dx * sin + dz * cos
      const shape = (along / longRadius) ** 4 + (across / shortRadius) ** 2
      if (shape > 1.6) continue
      const px = (Math.floor(centerX + dx) + TEXTURE_SIZE) % TEXTURE_SIZE
      const pz = (Math.floor(centerZ + dz) + TEXTURE_SIZE) % TEXTURE_SIZE
      const offset = (pz * TEXTURE_SIZE + px) * 4
      const shadow = shape > 1 || across > shortRadius * 0.55
      for (let channel = 0; channel < 3; channel++) {
        const target = shadow ? color[channel]! * 0.64 : color[channel]! * (1 + (0.5 - across / shortRadius) * 0.1)
        pixels[offset + channel] = Math.round(pixels[offset + channel]! * 0.18 + target * 0.82)
      }
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

export const mulchTexture = makeMulchTexture()

function containsPoint(outline: readonly Point[], x: number, z: number) {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function makeMulchChips(outline: readonly Point[], elevation: number): InstancedMesh | null {
  if (outline.length < 3) return null
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of outline) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  const width = maxX - minX, depth = maxZ - minZ
  if (width <= 0 || depth <= 0) return null
  const spacing = Math.max(CHIP_SPACING, Math.sqrt(width * depth / MAX_CHIPS), width / MAX_CHIPS, depth / MAX_CHIPS)
  const placements: { x: number; z: number; seedX: number; seedZ: number }[] = []
  for (let row = 0; row < Math.ceil(depth / spacing); row++) for (let column = 0; column < Math.ceil(width / spacing); column++) {
    const seedX = Math.floor(minX / spacing) + column, seedZ = Math.floor(minZ / spacing) + row
    if (hash(seedX + 11, seedZ - 23) > 0.8) continue
    const x = minX + (column + 0.15 + hash(seedX, seedZ) * 0.7) * spacing
    const z = minZ + (row + 0.15 + hash(seedZ, seedX + 7) * 0.7) * spacing
    if (containsPoint(outline, x, z)) placements.push({ x, z, seedX, seedZ })
  }
  if (!placements.length) return null
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true })
  const chips = new InstancedMesh(new BoxGeometry(1, 1, 1), material, placements.length)
  const dummy = new Object3D()
  const color = material.color.clone()
  placements.forEach(({ x, z, seedX, seedZ }, index) => {
    const thickness = 0.003 + hash(seedX + 37, seedZ) * 0.004
    dummy.position.set(x, elevation + 0.018 + thickness * 0.52, z)
    dummy.rotation.set(hash(seedX, seedZ + 17) * 0.12, hash(seedX + 29, seedZ) * Math.PI * 2, hash(seedX - 7, seedZ) * 0.12)
    dummy.scale.set(0.035 + hash(seedX + 41, seedZ) * 0.045, thickness, 0.01 + hash(seedX, seedZ - 31) * 0.013)
    dummy.updateMatrix()
    chips.setMatrixAt(index, dummy.matrix)
    color.set(CHIP_COLORS[Math.floor(hash(seedX + 53, seedZ - 11) * CHIP_COLORS.length)]!)
    chips.setColorAt(index, color)
  })
  chips.instanceMatrix.needsUpdate = true
  if (chips.instanceColor) chips.instanceColor.needsUpdate = true
  chips.name = 'ground-area-mulch-chips'
  chips.castShadow = false
  chips.receiveShadow = true
  chips.raycast = () => {}
  return chips
}
