import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'

const TEXTURE_SIZE = 512
const TEXTURE_REPEAT_METRES = 4
const TEXTURE_STONES = [
  [159, 155, 143],
  [181, 175, 160],
  [137, 140, 136],
  [107, 112, 110],
  [194, 186, 168],
] as const

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

function makeGravelTexture() {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let z = 0; z < TEXTURE_SIZE; z++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const u = x / TEXTURE_SIZE, v = z / TEXTURE_SIZE
    const broad = noise(u * 8, v * 8, 8) - 0.5
    const fine = noise(u * 96, v * 96, 96) - 0.5
    const grain = hash(x, z) - 0.5
    const shade = 1 + broad * 0.12 + fine * 0.17 + grain * 0.12
    const offset = (z * TEXTURE_SIZE + x) * 4
    pixels[offset] = Math.round(125 * shade)
    pixels[offset + 1] = Math.round(122 * shade)
    pixels[offset + 2] = Math.round(111 * shade)
    pixels[offset + 3] = 255
  }

  // Paint small, irregular stones into the shared repeating texture.
  for (let mark = 0; mark < 3_200; mark++) {
    const centerX = hash(mark, 17) * TEXTURE_SIZE
    const centerZ = hash(mark, 43) * TEXTURE_SIZE
    const radiusX = 1.8 + hash(mark, 71) * 3.3
    const radiusZ = 1.8 + hash(mark, 97) * 3.3
    const angle = hash(mark, 131) * Math.PI * 2
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const color = TEXTURE_STONES[Math.floor(hash(mark, 163) * TEXTURE_STONES.length)]!
    const reach = Math.ceil(Math.max(radiusX, radiusZ) + 2)
    for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
      const along = dx * cos + dz * sin
      const across = -dx * sin + dz * cos
      const shape = (along / radiusX) ** 2 + (across / radiusZ) ** 2
      if (shape > 1.25) continue
      const px = (Math.floor(centerX + dx) + TEXTURE_SIZE) % TEXTURE_SIZE
      const pz = (Math.floor(centerZ + dz) + TEXTURE_SIZE) % TEXTURE_SIZE
      const offset = (pz * TEXTURE_SIZE + px) * 4
      const light = shape > 1 ? 0.66 : 0.93 + (dx - dz) * 0.018
      for (let channel = 0; channel < 3; channel++)
        pixels[offset + channel] = Math.round(pixels[offset + channel]! * 0.12 + color[channel]! * light * 0.88)
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

export const gravelTexture = makeGravelTexture()
