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
const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

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

function makeSandTexture() {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let z = 0; z < TEXTURE_SIZE; z++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const u = x / TEXTURE_SIZE, v = z / TEXTURE_SIZE
    const broad = noise(u * 4, v * 4, 4) - 0.5
    const patches = noise(u * 24, v * 24, 24) - 0.5
    const fine = noise(u * 128, v * 128, 128) - 0.5
    const grain = hash(x, z) - 0.5
    const ripplePhase = Math.PI * 2 * (v * 16 + Math.sin(u * Math.PI * 4) * 0.13 + Math.sin(u * Math.PI * 10) * 0.025)
    const ripple = Math.sin(ripplePhase) * 0.025
    const shade = 1 + broad * 0.15 + patches * 0.09 + fine * 0.06 + grain * 0.08 + ripple
    const warmth = noise(u * 8 + 17, v * 8 + 11, 8) - 0.5
    const fleck = hash(x + 47, z - 83)
    const mineral = fleck > 0.997 ? 13 : fleck < 0.004 ? -13 : 0
    const offset = (z * TEXTURE_SIZE + x) * 4
    pixels[offset] = byte(203 * shade + warmth * 5 + mineral)
    pixels[offset + 1] = byte(183 * shade + warmth * 3 + mineral)
    pixels[offset + 2] = byte(141 * shade - warmth * 3 + mineral)
    pixels[offset + 3] = 255
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

export const sandTexture = makeSandTexture()
