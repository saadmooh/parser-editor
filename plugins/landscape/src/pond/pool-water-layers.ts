import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, TextureLoader, type Texture } from 'three'

// Crystal clear texture set used by the copied Pool surface shader.
const assets = {
  shoreline: new URL('./assets/water/shoreline.webp', import.meta.url).href,
  normal: new URL('./assets/water/normal.webp', import.meta.url).href,
  noise: new URL('./assets/water/noise.webp', import.meta.url).href,
}

function loadLayer(kind: keyof typeof assets): Texture {
  const fallback = kind === 'normal' ? [128,128,255,255] : [128,128,128,255]
  const result = typeof document === 'undefined'
    ? new DataTexture(new Uint8Array(fallback),1,1,RGBAFormat)
    : new TextureLoader().load(assets[kind])
  result.name = `pond-pool-${kind}`
  result.wrapS = result.wrapT = RepeatWrapping
  result.colorSpace = NoColorSpace
  result.minFilter = typeof document === 'undefined' ? LinearFilter : LinearMipmapLinearFilter
  result.magFilter = LinearFilter; result.anisotropy = 4
  // TextureLoader marks its image ready on load; uploading a null image early
  // breaks the external Chrome WebGL fallback renderer.
  if (result instanceof DataTexture) result.needsUpdate = true
  return result
}

let shared: { normal: Texture; noise: Texture; shoreline: Texture; owners: number } | null = null
export function retainPondWaterLayers() {
  const entry = shared ??= { normal: loadLayer('normal'),noise: loadLayer('noise'),shoreline: loadLayer('shoreline'),owners: 0 }
  entry.owners++
  let released = false
  return { normal: entry.normal,noise: entry.noise,shoreline: entry.shoreline,release() {
    if (released) return
    released = true
    if (--entry.owners === 0) {
      entry.normal.dispose(); entry.noise.dispose(); entry.shoreline.dispose()
      if (shared === entry) shared = null
    }
  } }
}

