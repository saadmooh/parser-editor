import { DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace } from 'three'

export const fishSpecies = ['koi', 'goldfish', 'carp', 'perch', 'trout'] as const
export type FishSpecies = typeof fishSpecies[number]
export const fishProfiles = {
  koi: { width: 1, height: 1, tail: 1, dorsal: 1, finSpan: 1, pace: .9, fin: '#efdfc9' },
  goldfish: { width: 1.22, height: 1.35, tail: 1.55, dorsal: 1.2, finSpan: 1.3, pace: .8, fin: '#f4a32d' },
  carp: { width: 1.25, height: 1.08, tail: .85, dorsal: .8, finSpan: .85, pace: .75, fin: '#827856' },
  perch: { width: .85, height: 1.4, tail: .95, dorsal: 1.65, finSpan: .9, pace: 1.05, fin: '#d58b37' },
  trout: { width: .68, height: .78, tail: .8, dorsal: .8, finSpan: .8, pace: 1.25, fin: '#aaa898' },
} as const
const tile = 128, columns = fishSpecies.length, rows = 2, padding = 3

/** One deterministic, padded atlas per school; no per-fish texture allocations. */
export function createFishAtlas() {
  const width = tile * columns, height = tile * rows, pixels = new Uint8Array(width * height * 4)
  for (let variant = 0; variant < rows; variant++) for (let species = 0; species < columns; species++) {
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
      const u = Math.max(0, Math.min(1, (x - padding) / (tile - padding * 2 - 1)))
      const v = Math.max(0, Math.min(1, (y - padding) / (tile - padding * 2 - 1)))
      // Cylindrical UV: v=.25 is the back and v=.75 the belly.
      const back = (Math.sin(v * Math.PI * 2) + 1) / 2
      const scale = .92 + .08 * Math.cos(u * Math.PI * 52 + Math.floor(v * 28) % 2 * Math.PI) * Math.cos(v * Math.PI * 56)
      let rgb: number[]
      switch (fishSpecies[species]) {
        case 'koi': {
          const patch = Math.sin(u * 18 + variant * 3 + Math.sin(v * 13) * 1.5) + Math.cos(v * 17 - u * 7)
          rgb = patch > .55 ? [222, 67, 27] : patch < -1.1 && variant ? [34, 39, 40] : [238, 228, 207]
          break
        }
        case 'goldfish': rgb = [244 - back * 34, 155 - back * 67 + variant * 16, 38 + (1 - back) * 38]; break
        case 'carp': rgb = [183 - back * 100, 164 - back * 82, 111 - back * 61]; break
        case 'perch': {
          const stripe = Math.pow(Math.max(0, Math.cos(u * Math.PI * 14 + variant)), 7) * back
          rgb = [177 - back * 66 - stripe * 62, 178 - back * 40 - stripe * 70, 96 - back * 26 - stripe * 39]; break
        }
        default: {
          const band = Math.exp(-Math.pow((back - .5) * 8, 2))
          const spot = Math.sin(u * 127 + Math.sin(v * 59) * 4 + variant) * Math.cos(v * 107 + u * 29) > .82 && back > .4
          rgb = spot ? [38, 42, 37] : [191 - back * 88 + band * 33, 193 - back * 68 - band * 20, 170 - back * 73 - band * 15]
        }
      }
      const index = (((variant * tile + y) * width) + species * tile + x) * 4
      // A narrow curved gill cover near the head, strongest on the flanks.
      const gill = Math.abs(u - (.79 + .025 * Math.sin(v * Math.PI * 2))) < .009 && Math.abs(Math.cos(v * Math.PI * 2)) > .35
      const shading = scale * (gill ? .62 : 1)
      pixels.set([rgb[0]! * shading, rgb[1]! * shading, rgb[2]! * shading, 255], index)
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat)
  texture.name = 'pond-fish-species-atlas'
  texture.colorSpace = SRGBColorSpace; texture.minFilter = texture.magFilter = LinearFilter
  texture.generateMipmaps = false; texture.needsUpdate = true
  return texture
}

export function fishAppearance(selection: FishSpecies | 'mixed', index: number) {
  const species = selection === 'mixed' ? fishSpecies[index % fishSpecies.length]! : selection
  const variant = Math.floor(index / fishSpecies.length) % rows
  const column = fishSpecies.indexOf(species)
  return { species, variant, profile: fishProfiles[species],
    uv: { x: (column * tile + padding + .5) / (columns * tile), y: (variant * tile + padding + .5) / (rows * tile),
      width: (tile - padding * 2 - 1) / (columns * tile), height: (tile - padding * 2 - 1) / (rows * tile) } }
}

let sharedAtlas: { texture: DataTexture; owners: number } | null = null
/** Keep one immutable atlas across schools and overlapping React replacement commits. */
export function retainFishAtlas() {
  const entry = sharedAtlas ??= { texture: createFishAtlas(), owners: 0 }
  entry.owners++
  let released = false
  return { texture: entry.texture, release() {
    if (released) return
    released = true
    if (--entry.owners === 0) {
      entry.texture.dispose()
      if (sharedAtlas === entry) sharedAtlas = null
    }
  } }
}
