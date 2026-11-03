import { Color, Vector3, type DirectionalLight, type Scene } from 'three'
import { cameraPosition, normalWorldGeometry, positionWorld, smoothstep, uniform } from 'three/tsl'
import type { Node } from 'three/webgpu'

type Sun = { frame: number; direction: Vector3; color: Color }
const sunlight = new WeakMap<Scene, Sun>()
const dark: Sun = { frame: -1, direction: new Vector3(0, 1, 0), color: new Color(0, 0, 0) }
const target = new Vector3()

function sampleSun(scene: Scene | null, frame: number): Sun {
  if (!scene) return dark
  let sample = sunlight.get(scene)
  if (!sample) {
    sample = { frame: -1, direction: new Vector3(0, 1, 0), color: new Color() }
    sunlight.set(scene, sample)
  }
  if (sample.frame === frame) return sample
  sample.frame = frame
  sample.color.setRGB(0, 0, 0)
  let intensity = 0
  // Shared across all patches, so light discovery runs once per scene frame.
  scene.traverseVisible((object) => {
    const light = object as DirectionalLight
    if (!light.isDirectionalLight || light.intensity <= intensity) return
    intensity = light.intensity
    light.getWorldPosition(sample!.direction)
    light.target.getWorldPosition(target)
    sample!.direction.sub(target).normalize()
    sample!.color.copy(light.color).multiplyScalar(Math.min(1, intensity * 0.25))
  })
  return sample
}

/** Restrained transmission at blade tips when looking towards the scene's sun. */
export function grassTipTransmission(progress: Node<'float'>) {
  const direction = uniform(new Vector3(0, 1, 0)).onRenderUpdate(({ scene, frameId }) => sampleSun(scene, frameId).direction)
  const lightColor = uniform(new Color(0, 0, 0)).onRenderUpdate(({ scene, frameId }) => sampleSun(scene, frameId).color)
  const view = cameraPosition.sub(positionWorld).normalize()
  const backlight = view.negate().dot(direction).max(0).pow(4)
  const edge = normalWorldGeometry.dot(direction).abs().oneMinus()
  return lightColor.mul(backlight).mul(edge).mul(smoothstep(0.15, 1, progress)).mul(0.15)
}
