import { expect, test } from 'bun:test'
import { RenderTarget } from 'three'
import type { NodeFrame } from 'three/webgpu'
import { screenUV } from 'three/tsl'
import { pondDepthTexture, pondRefractionTexture } from './scene-capture'

for (const channel of ['color', 'depth'] as const) test(`${channel}: nested editor passes retain capture textures at their own resolutions`, () => {
  const capture = channel === 'color' ? pondRefractionTexture(screenUV) : pondDepthTexture()
  const main = new RenderTarget(1504, 964)
  const reflection = new RenderTarget(752, 482)
  let current = main
  const copied: import('three').Texture[] = []
  const frame = { renderer: {
    getRenderTarget: () => current,
    getCanvasTarget: () => null,
    copyFramebufferToTexture: (texture: import('three').Texture) => copied.push(texture),
  } } as unknown as NodeFrame
  try {
    capture.updateBefore(frame)
    const mainTexture = copied.at(-1)!
    const mainVersion = mainTexture.version
    current = reflection
    capture.updateBefore(frame)
    const reflectionTexture = copied.at(-1)!
    expect(reflectionTexture).not.toBe(mainTexture)
    expect(reflectionTexture.source).not.toBe(mainTexture.source)
    expect(mainTexture.image).toMatchObject({ width: 1504, height: 964 })
    expect(reflectionTexture.image).toMatchObject({ width: 752, height: 482 })
    current = main
    capture.updateBefore(frame)
    expect(copied.at(-1)).toBe(mainTexture)
    expect(mainTexture.version).toBe(mainVersion)
    expect(reflectionTexture.image).toMatchObject({ width: 752, height: 482 })
  } finally {
    capture.dispose()
    main.dispose()
    reflection.dispose()
  }
})

test('ponds share capture nodes and release GPU textures only after the last owner',async()=>{
  const { retainPondSceneCaptures }=await import('./scene-capture')
  const { spyOn }=await import('bun:test')
  const first=retainPondSceneCaptures(),second=retainPondSceneCaptures()
  expect(first.color).toBe(second.color);expect(first.depth).toBe(second.depth)
  const colorDispose=spyOn(first.color,'dispose'),depthDispose=spyOn(first.depth,'dispose')
  first.dispose();first.dispose()
  expect(colorDispose).not.toHaveBeenCalled();expect(depthDispose).not.toHaveBeenCalled()
  second.dispose();second.dispose()
  expect(colorDispose).toHaveBeenCalledTimes(1);expect(depthDispose).toHaveBeenCalledTimes(1)
  colorDispose.mockRestore();depthDispose.mockRestore()
  const fresh=retainPondSceneCaptures()
  expect(fresh.color).not.toBe(first.color)
  fresh.dispose()
})
