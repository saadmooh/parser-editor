import {
  LinearFilter,
  LinearMipmapLinearFilter,
  MirroredRepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three'
import mudAlbedo from '../assets/mud-albedo.webp'

let sharedTexture: Texture | undefined

export function getMudTexture(): Texture {
  if (sharedTexture) return sharedTexture
  const texture = new TextureLoader().load(mudAlbedo.src)
  texture.colorSpace = SRGBColorSpace
  // Mirrored tiles meet at the same image edge, avoiding a visible seam.
  texture.wrapS = MirroredRepeatWrapping
  texture.wrapT = MirroredRepeatWrapping
  texture.repeat.set(1 / 4, 1 / 4)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  sharedTexture = texture
  return texture
}
