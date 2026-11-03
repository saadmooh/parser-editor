// PoolWaterEffect surface shader, adapted for a terrain-backed natural pond.
// The adapter supplies pond colours, restrained surface detail and its CPU wave
// field. Pool reflection/refraction equations remain the foundation.
import { Color, Vector2, Vector3, FrontSide, MeshBasicNodeMaterial } from 'three/webgpu'
import type { TextureNode } from 'three/webgpu'
import {
  cameraFar,
  cameraNear,
  cameraPosition,
  color,
  dot,
  exp,
  float,
  max,
  mix,
  normalize,
  perspectiveDepthToViewZ,
  positionView,
  positionWorld,
  pow,
  reference,
  reflect,
  screenUV,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import type { SceneAtmosphereSource } from '@pascal-app/viewer'
import type { PondNode } from './schema'
import { WATER_PRESET_SETTINGS } from './pool-surface-presets'
import type { retainPondWaterLayers } from './pool-water-layers'
const WATER_MOTION_RATES = { normalPrimary:-.05,normalSecondary:.1 }

export class PondPoolSurface {
  [key:string]: any
  readonly variants = new Map<'high' | 'medium', MeshBasicNodeMaterial>()
  quality: 'high' | 'medium' = 'high'
  absorption: any
  atmosphere: SceneAtmosphereSource | null
  deepColor: any
  distortionTextureNode: TextureNode<'vec4'>
  intersectionColor: any
  intersectionStrength: any
  intersectionWidth: any
  material: any
  motionIntensity: any
  motionTime: any
  normalScale: any
  normalSpeed: any
  normalStrength: any
  normalTextureNode: TextureNode<'vec4'>
  poolSize: any
  reflectionDistortion: any
  reflectionFresnel: any
  reflectionStrength: any
  refractionStrength: any
  settings: any
  shallowColor: any
  shorelineSpeed: any
  shorelineStrength: any
  shorelineTextureNode: TextureNode<'vec4'>
  shorelineWidth: any
  simulationDetail: any
  specularHardness: any
  specularSize: any
  specularStrength: any
  stateNode: any
  stormIntensity: any
  sunDirection: any
  time: any
  viewportColor: any
  viewportDepth: any
  basinDepth: any

  constructor(node:PondNode, wave:any, time:any, layers:ReturnType<typeof retainPondWaterLayers>, depth:any, colour:any, width:number, length:number, atmosphere?:SceneAtmosphereSource|null, basinDepth?:any) {
    this.basinDepth=basinDepth??float(4)
    this.atmosphere=atmosphere??null
    this.time=time;this.motionTime=time
    this.poolSize=uniform(new Vector2(width,length))
    this.stateNode={ sample:()=>vec4(wave.r,float(0),wave.g,wave.b) }
    this.normalTextureNode=texture(layers.normal)
    this.distortionTextureNode=texture(layers.noise)
    this.shorelineTextureNode=texture(layers.shoreline)
    this.stormIntensity=uniform(0);this.motionIntensity=uniform(1)
    this.sunDirection=uniform(new Vector3(-.35,.86,.36).normalize())
    this.viewportDepth=depth;this.viewportColor=colour
    this.update(node)
    this.motionTime=time.mul(this.normalSpeed)
    this.material=this.createWaterMaterial()
    this.material.name='pond-pool-water-surface'
    this.variants.set('high',this.material)
  }
  update(node:PondNode) {
    const preset=WATER_PRESET_SETTINGS['crystal-clear']
    this.settings={...preset,waterQuality:this.quality,waterColor:node.waterColor}
    // All styles and custom edits use the same colour path. A clarity or
    // reflection edit must never silently replace the selected palette.
    const shallow = new Color(node.waterColor).lerp(new Color('#b5c9b0'), .28)
    const deep = new Color(node.waterColor).multiplyScalar(.38)
    const settings={...preset,
      shallowWaterColor: `#${shallow.getHexString()}`,
      deepWaterColor: `#${deep.getHexString()}`,
      normalStrength: .28*node.rippleStrength/.35,
      normalScale: 3,
      normalSpeed: .65*node.waveSpeed,
      reflectionStrength: node.reflectionStrength,
      reflectionDistortion: .65,
      refractionStrength: .42*node.refractionStrength,
      specularStrength: .65*node.sunGlints,
      specularHardness: .25,
      specularSize: .32,
      intersectionStrength: .06,
      intersectionColor: '#87aaa1',
      shorelineStrength: .035,
      shorelineWidth: .18,
      surfaceDetail: preset.surfaceDetail*node.rippleStrength/.35,
    }
    const colours=['shallowWaterColor','deepWaterColor','intersectionColor']
    const names:Record<string,string>={shallowWaterColor:'shallowColor',deepWaterColor:'deepColor',surfaceDetail:'simulationDetail'}
    for(const [key,value] of Object.entries(settings)) {
      if(typeof value!=='number'&&!colours.includes(key))continue
      const name=names[key]??key
      const next=typeof value==='string'?new Color(value):value
      if(this[name]) {if(next instanceof Color)this[name].value.copy(next);else this[name].value=next}
      else this[name]=uniform(next as any)
    }
    if(this.absorption)this.absorption.value=-.62/node.waterClarity
    else this.absorption=uniform(-.62/node.waterClarity)
    for(const material of this.variants.values())material.color.set(node.waterColor)
  }
  selectQuality(quality:'high'|'medium'):MeshBasicNodeMaterial {
    this.quality=quality
    this.settings.waterQuality=quality
    let material=this.variants.get(quality)
    if(!material) {
      material=this.createWaterMaterial()
      material.name=`pond-pool-water-${quality}`
      this.variants.set(quality,material)
    }
    this.material=material
    return material
  }
  disposeVariantsExcept(current:MeshBasicNodeMaterial) {
    for(const material of this.variants.values())if(material!==current)material.dispose()
    this.variants.clear()
  }
  worldWaterUv() {
    return positionWorld.xz.mul(vec2(0.1, -0.1))
  }

  normalSample() {
    const base = this.worldWaterUv()
    const panA = this.motionTime.mul(WATER_MOTION_RATES.normalPrimary)
    const panB = this.motionTime.mul(WATER_MOTION_RATES.normalSecondary)
    const uvA = base.mul(this.normalScale.mul(0.5)).add(vec2(panA))
    if (this.settings.waterQuality === 'low' || this.settings.waterQuality === 'medium') {
      return this.normalTextureNode.sample(uvA).rgb.mul(2).sub(1)
    }
    const uvB = base.mul(this.normalScale).add(vec2(panB))
    return mix(
      this.normalTextureNode.sample(uvA).rgb,
      this.normalTextureNode.sample(uvB).rgb,
      0.5,
    ).mul(2).sub(1)
  }

  environmentIllumination(): any {
    if (!this.atmosphere) return float(1)
    return (reference('ambientIntensity', 'float', this.atmosphere) as any)
      .add(reference('hemisphereIntensity', 'float', this.atmosphere) as any)
      .add(0.25)
      .clamp(0.25, 1.2)
  }

  createWaterMaterial() {
    const material = new MeshBasicNodeMaterial({
      // Keep a real water colour as the base material fallback. Pascal's
      // WebGPU node pipeline can reject an advanced viewport/depth node on
      // some render paths; the previous implicit white default then made the
      // excavated opening look as if the ground plane still covered it.
      color: this.settings.waterColor,
      opacity: 0.82,
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    })
    const state = this.stateNode.sample(uv())
    const local = uv().mul(this.poolSize)
    const phase = local.x.mul(2.1).add(local.y.mul(1.3)).sub(this.time.mul(3.4))
    const phase2 = local.x.mul(-1.2).add(local.y.mul(2.8)).sub(this.time.mul(4.1))
    // Storm droplets are smaller than the water mesh triangles. Sampling the
    // height field at vertices aliases them into long straight facets. Keep
    // the surface planar and animate the normal, reflection and foam per pixel.

    const mapped = this.normalSample()
    const surfaceNormal = normalize(vec3(
      mapped.x.mul(this.normalStrength).mul(this.motionIntensity).sub(state.b.mul(this.simulationDetail)).add(phase.cos().mul(this.stormIntensity).mul(0.18)) as any,
      1,
      mapped.y.mul(this.normalStrength).mul(this.motionIntensity).sub(state.a.mul(this.simulationDetail)).add(phase2.cos().mul(this.stormIntensity).mul(0.15)) as any,
    ))
    const eye = normalize(cameraPosition.sub(positionWorld))
    const facing = max(dot(surfaceNormal, eye), 0)

    const sceneEye = perspectiveDepthToViewZ(
      this.viewportDepth.sample(screenUV),
      cameraNear,
      cameraFar,
    ).negate()
    const fragmentEye = positionView.z.negate()
    // Bound optical thickness by the authored basin: the scene copy can
    // contain distant ground or another floor, never an infinitely deep pond.
    const basinEyeDepth = this.basinDepth.div(eye.y.abs().max(0.15))
    const depthDelta = sceneEye.sub(fragmentEye).max(0).min(basinEyeDepth)
    const shallowMask = exp(depthDelta.negate().div(0.3)).clamp(0, 1)
    // `shallowMask` is high when the floor is close to the surface. The old
    // expression faded alpha in exactly that case, so tanning shelves and
    // pool edges appeared to have no water. Fade only the zero-thickness
    // pixels at the silhouette and keep a small floor-independent baseline
    // for renderers whose depth copy is unavailable.
    const shoreFade = smoothstep(0.005, 0.18, depthDelta).mul(0.78).add(0.22)

    const refractionOffset = surfaceNormal.xz
      .mul(this.refractionStrength)
      .mul(this.reflectionDistortion.mul(0.025))
    const offsetUv = screenUV.add(refractionOffset).clamp(0, 1)
    const offsetDepth = perspectiveDepthToViewZ(
      this.viewportDepth.sample(offsetUv),
      cameraNear,
      cameraFar,
    ).negate()
    const keepOffset = step(fragmentEye.sub(offsetDepth), float(0))
    const refractedUv = screenUV.add(refractionOffset.mul(keepOffset)).clamp(0, 1)
    const usesSceneRefraction = this.settings.waterQuality !== 'low'
    const sceneColor = usesSceneRefraction
      ? this.viewportColor.sample(refractedUv).rgb
      : vec3(0)

    const baseColor = mix(this.deepColor, this.shallowColor, shallowMask)
    const attenuation = exp(this.absorption.mul(depthDelta.min(4)))
    const absorbedBase = mix(color('#064a61'), baseColor, attenuation)
    const environmentIllumination = this.environmentIllumination()
    const underwaterBounce: any = this.atmosphere
      ? mix(uniform(this.atmosphere.groundColor), uniform(this.atmosphere.skyColor), 0.35)
      : color('#000000')
    const absorbed = absorbedBase
      .mul(environmentIllumination)
      .add(underwaterBounce.mul(this.atmosphere ? 0.08 : 0))
    // Caustics belong on the submerged liner (see buildLinerMaterial), where
    // refraction naturally reveals them through the water. Adding the same
    // animated ridges here projected them onto the top plane as bright moving
    // streaks that read as rain.
    const refracted = usesSceneRefraction
      ? mix(absorbed, sceneColor, this.refractionStrength.mul(attenuation))
      : absorbed

    const shorelinePhase = shallowMask.oneMinus().mul(8)
      .sub(this.time.mul(this.shorelineSpeed).mul(0.35))
    const shorelineTexture = this.shorelineTextureNode
      .sample(this.worldWaterUv().mul(4).add(vec2(this.time.mul(0.01))))
      .r
    const shorelineBand = smoothstep(
      float(1).sub(this.shorelineWidth),
      float(1),
      shorelinePhase.sin().mul(0.5).add(0.5).mul(shorelineTexture),
    ).mul(shallowMask).mul(this.shorelineStrength)
    const intersectionBand = smoothstep(
      float(0.15),
      this.intersectionWidth.min(1.95).mul(0.45).add(0.15),
      shallowMask,
    ).mul(smoothstep(0.82, 1, shallowMask).oneMinus())
      .mul(this.intersectionStrength)

    // A narrow depth-derived occlusion band anchors the transparent plane to
    // walls, steps and shelves. It is deliberately separate from bright foam:
    // contact should remain readable in calm water and dark environments.
    const contactWidth = this.intersectionWidth.mul(0.16).add(0.025)
    const contactOcclusion = smoothstep(0.008, contactWidth, depthDelta).oneMinus()
      .mul(this.intersectionStrength.mul(0.42))

    const reflectedDirection = reflect(eye.negate(), surfaceNormal)
    const sky = this.atmosphere
      ? this.atmosphere.reflectionRadiance(reflectedDirection)
      : mix(color('#d8eef9'), color('#1260a6'), smoothstep(-0.1, 0.8, reflectedDirection.y))
    // Distort Pascal's opaque scene copy with the animated normal field. This
    // gives the water a moving screen-space reflection without a nested
    // reflector render, which is incompatible with the host's multisampled
    // WebGPU depth target.
    const reflectionOffset = surfaceNormal.xz
      .mul(this.reflectionDistortion.mul(0.035))
    const reflectedUv = screenUV.add(vec2(
      reflectionOffset.x.negate(),
      reflectionOffset.y,
    )).clamp(0, 1)
    const usesLocalReflections = this.settings.waterQuality === 'high'
      || this.settings.waterQuality === 'ultra'
    const screenEdge = screenUV.x.min(screenUV.y)
      .min(screenUV.x.oneMinus()).min(screenUV.y.oneMinus())
    const reflectionConfidence = smoothstep(0.015, 0.12, screenEdge)
      .mul(smoothstep(0.02, 0.3, facing.oneMinus()))
    const nearbyScene = usesLocalReflections
      ? this.viewportColor.sample(reflectedUv).rgb
      : sky
    const localReflectionWeight = this.settings.waterQuality === 'ultra' ? 0.52 : 0.38
    const reflectedScene = mix(sky, nearbyScene, reflectionConfidence.mul(localReflectionWeight))

    const fresnel = pow(float(1).sub(facing).max(1e-5), this.reflectionFresnel)
      .mul(0.96).add(0.04)
      .mul(this.reflectionStrength)

    const activeSunDirection = this.atmosphere
      ? uniform(this.atmosphere.sunDirection)
      : this.sunDirection
    const phong = pow(max(dot(reflectedDirection, activeSunDirection), 0), 96)
    const hardSpecular = smoothstep(
      float(1).sub(this.specularSize),
      float(1.15).sub(this.specularSize),
      phong,
    )
    const directLightColor: any = this.atmosphere
      ? uniform(this.atmosphere.sunColor)
        .mul(reference('sunIntensity', 'float', this.atmosphere).mul(0.4).clamp(0, 2))
      : color('#fff8e7')
    let specular: any = mix(phong, hardSpecular, this.specularHardness)
      .mul(this.specularStrength)
      .mul(directLightColor)
    if (this.atmosphere) {
      const moonPhong = pow(max(dot(reflectedDirection, uniform(this.atmosphere.moonDirection)), 0), 128)
      specular = specular.add(
        moonPhong
          .mul(this.specularStrength)
          .mul(uniform(this.atmosphere.moonColor))
          .mul(reference('moonIntensity', 'float', this.atmosphere).mul(4).clamp(0, 1)),
      )
    }

    const secondaryLight = environmentIllumination.clamp(0.3, 1.1)
    const contactTint: any = this.atmosphere
      ? uniform(this.atmosphere.groundColor).mul(0.22)
      : color('#073b4c')
    const layered: any = mix(refracted as any, contactTint as any, contactOcclusion as any)
    const litLayered = layered
      .add(intersectionBand.mul(this.intersectionColor).mul(secondaryLight))
      .add(shorelineBand.mul(color('#f2ffff')).mul(secondaryLight))
    const foamNoise = this.distortionTextureNode.sample(this.worldWaterUv().mul(18).add(vec2(this.time.mul(0.03)))).r
    const foam = smoothstep(0.85, 1, phase.sin()).mul(this.stormIntensity).mul(0.22)
      .mul(smoothstep(0.25, 0.7, foamNoise)).clamp(0, 0.8)
    const foamColor: any = this.atmosphere
      ? mix(color('#e9ffff'), uniform(this.atmosphere.skyColor), 0.18).mul(secondaryLight)
      : color('#e9ffff')
    material.colorNode = mix(
      mix(litLayered as any, reflectedScene as any, fresnel as any).add(specular as any),
      foamColor,
      foam as any,
    ) as any
    material.opacityNode = shoreFade
    return material
  }
}
