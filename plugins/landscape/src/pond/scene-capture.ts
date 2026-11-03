import { DepthTexture, FramebufferTexture, type RenderTarget, type Texture } from 'three'
import { ViewportTextureNode, type CanvasTarget, type Node } from 'three/webgpu'
import { nodeObject, screenUV } from 'three/tsl'

class PondViewportTextureNode extends ViewportTextureNode {
  private readonly captures = new Set<Texture>([this.value])


  override getTextureForReference(reference: RenderTarget | CanvasTarget | null = null) {
    const capture = super.getTextureForReference(reference)
    const owner = this.getBase() as PondViewportTextureNode
    if (!owner.captures.has(capture)) {
      // Texture.clone shares Source/image. Capture dimensions must also belong
      // to the individual target, otherwise nested passes keep resizing them.
      const image = capture.image as { width: number; height: number }
      capture.source = new FramebufferTexture(image.width, image.height).source
      owner.captures.add(capture)
    }
    return capture
  }

  override dispose() {
    super.dispose()
    this.captures.forEach(capture => capture.dispose())
    this.captures.clear()
  }
}

/** Each editor/reflection render target needs its own refraction capture. */
export function pondRefractionTexture(uv: Node): ViewportTextureNode {
  // viewportSharedTexture uses one global GPU texture. Different-sized passes
  // resize it mid-frame, destroying textures still bound by preceding passes.
  const capture = nodeObject(new PondViewportTextureNode(uv) as ViewportTextureNode)
  capture.value.name = 'pond-transmission-color'
  return capture
}

export function pondDepthTexture(): ViewportTextureNode {
  const capture = nodeObject(new PondViewportTextureNode(screenUV, null, new DepthTexture(1, 1)) as ViewportTextureNode)
  capture.value.name = 'pond-transmission-depth'
  return capture
}

let sharedCaptures: { color:ViewportTextureNode; depth:ViewportTextureNode; owners:number } | null = null

/** One immutable scene copy per render target, retained by all live ponds. */
export function retainPondSceneCaptures() {
  const entry = sharedCaptures ??= { color:pondRefractionTexture(screenUV),depth:pondDepthTexture(),owners:0 }
  entry.owners++
  let released=false
  return { color:entry.color,depth:entry.depth,dispose() {
    if(released)return
    released=true
    if(--entry.owners===0) {
      entry.color.dispose();entry.depth.dispose()
      if(sharedCaptures===entry)sharedCaptures=null
    }
  } }
}
