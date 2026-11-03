import { Color, DataTexture, type Texture, type Mesh, type Material, type Group, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { MeshStandardNodeMaterial, type Node } from 'three/webgpu'
import { attribute, color, dot, float, mix, normalMap, normalLocal, positionLocal, positionWorld, smoothstep, texture, uniform, vec2, vec3 } from 'three/tsl'
import mineralImage from './assets/river_small_rocks_diffuse_1k.webp'
import mineralNormalImage from './assets/river_small_rocks_nor_gl_1k.webp'
import grassImage from './assets/leafy_grass_diffuse_1k.webp'
import grassNormalImage from './assets/leafy_grass_nor_gl_1k.webp'
import rockImage from './assets/dark_rock_02_diffuse_1k.webp'
import rockNormalImage from './assets/dark_rock_02_nor_gl_1k.webp'
import mossImage from './assets/mossy_rock_diffuse_1k.webp'
import armImage from './assets/dark_rock_02_arm_1k.webp'
import { pondBedSurfaceIndex } from './bed-surfaces'
import { sandTexture } from '../ground-areas/rendering/sand'
import { gravelTexture } from '../ground-areas/rendering/gravel'
import { grassTexture } from '../ground-areas/rendering/grass'
import type { PondNode } from './schema'
import type { GroundAreaNode } from '../ground-areas/domain/schema'
import { groundSurfaceTexture } from '../ground-areas/rendering/geometry'

const images = new Map<string, Texture>()
function scan(asset: { src: string } | string, normal = false) {
  const url = typeof asset === 'string' ? asset : asset.src
  const key = `${url}:${normal}`
  let image = images.get(key)
  if (!image) {
    image = typeof document === 'undefined'
      ? new DataTexture(new Uint8Array(normal ? [128, 128, 255, 255] : [180, 180, 180, 255]), 1, 1)
      : new TextureLoader().load(url)
    image.wrapS = image.wrapT = RepeatWrapping; image.anisotropy = 8
    if (!normal) image.colorSpace = SRGBColorSpace
    if (image instanceof DataTexture) image.needsUpdate = true
    images.set(key, image)
  }
  return image
}

/** Native TSL translation of Ox()'s mineral, wet shore and meadow blending. */
export function pondTerrainMaterial(node: PondNode, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, ground?: GroundAreaNode,
  site?: { position: Node<'vec3'>; datum: Node<'float'>; outside: Node<'vec3'>; bedIndex?: Node<'float'>; bedSurfaces?: PondNode['bedSurface'][] }) {
  const p = site?.position ?? positionLocal
  const y = p.y.sub(site?.datum ?? node.elevation), xz = p.xz
  const mineral = texture(scan(mineralImage), xz.mul(.34)).rgb
  const luminance = vec3(.2126, .7152, .0722)
  const light = dot(mineral, luminance)
  const sand = vec3(.64, .48, .24)
  const shelfMix = smoothstep(-1.18 / 1.5 * node.basinDepth, -.25 / 1.5 * node.basinDepth, y)
  const fineSand = sand.mul(mix(.48, 1.16, smoothstep(.06, .32, light)))
  const shelf = sand.mul(mix(.4, 1.18, smoothstep(.06, .28, light)))
  const bed = mix(mix(fineSand, shelf, shelfMix), sand.mul(mix(.82, .79, shelfMix)), smoothstep(.015, .2, y.negate()).mul(.5))
  const meadowScan = texture(scan(grassImage), xz.mul(.48)).rgb
  const meadow = mix(meadowScan.mul(vec3(.44, 1, .28)), dot(meadowScan, luminance).mul(vec3(.49, 1.1, .27)), .55).mul(.86).add(vec3(.014, .024, .005))
  const patch = positionLocal.x.mul(.24).add(positionLocal.z.mul(.19).sin()).sin().mul(positionLocal.z.mul(.27).cos()).mul(.5).add(.5)
  const wet = y.add(.015).div(.12).pow(2).negate().exp().mul(.1).oneMinus()
  const grassBlend = smoothstep(.005, .06, y)
  const bedIndex = site?.bedIndex ?? float(pondBedSurfaceIndex(node.bedSurface))
  let bedFinish = bed
  // Compile only finishes used on this terrain mesh. No additional meshes or
  // polygon detail; metres-based sampling stays consistent across pond sizes.
  for (const surface of new Set(site?.bedSurfaces ?? [node.bedSurface])) {
    if (surface === 'silt') continue
    const finish = surface === 'sand'
      ? texture(sandTexture, xz.mul(.5)).rgb.mul(vec3(.88, .86, .78))
      : surface === 'gravel'
        ? texture(gravelTexture, xz.mul(.8)).rgb.mul(vec3(.85, .9, .92))
        : surface === 'river-stone'
          ? mineral.mul(vec3(.78, .85, .88))
          : mix(mineral.mul(vec3(.66, .72, .64)), meadowScan.mul(vec3(.35, .6, .27)),
            smoothstep(.3, .7, xz.x.mul(1.7).sin().mul(xz.y.mul(1.3).cos()).mul(.5).add(.5))).mul(.85)
    const selected = bedIndex.sub(pondBedSurfaceIndex(surface)).abs().lessThan(.5)
    bedFinish = mix(bedFinish, finish, float(selected))
  }
  // Preserve the exposed bank; apply the chosen substrate below the waterline.
  const submergedBed = mix(bed, bedFinish, smoothstep(node.waterDrop, node.waterDrop + .06, y.negate()))
  const bank = mix(submergedBed, meadow.mul(mix(.86, 1.07, patch)), grassBlend).mul(wet)
  // Blend the shaped bank into the existing terrain's material.
  const angle = node.rotation[1], c = Math.cos(angle), s = Math.sin(angle)
  const outerUV = vec2(positionLocal.x.mul(c).add(positionLocal.z.mul(s)).add(node.position[0]),
    positionLocal.z.mul(c).sub(positionLocal.x.mul(s)).add(node.position[2]).negate())
  const outer = texture(ground ? groundSurfaceTexture(ground.surface) : grassTexture, outerUV)
  outer.updateMatrix = true
  const blend = attribute<'float'>('pondBlend', 'float')
  const material = new MeshStandardNodeMaterial({ roughness: .9 })
  material.name = 'pond-mineral-and-meadow'
  material.colorNode = mix(site?.outside ?? outer.rgb, bank, blend)
  const mineralNormal = texture(scan(mineralNormalImage, true), xz.mul(.34)).xyz
  const grassNormal = texture(scan(grassNormalImage, true), xz.mul(.48)).xyz
  const sandyBed = bedIndex.sub(pondBedSurfaceIndex('sand')).abs().lessThan(.5)
  const relief = mix(.25, .04, float(sandyBed)).mul(grassBlend.oneMinus()).add(grassBlend.mul(.25))
  material.normalNode = normalMap(mix(mineralNormal, grassNormal, grassBlend), vec2(relief).mul(blend))
  material.roughnessNode = mix(.76, .97, grassBlend)
  return material
}

type RockStyle = { material: Material; tint: ReturnType<typeof rockTint>; moss: ReturnType<typeof rockMoss>; index: number }
const rockStyles = new WeakMap<Material, Omit<RockStyle, 'index'>>()
const rockMeshes = new WeakMap<Mesh, RockStyle>()
const rockTint = (value: string) => uniform(new Color(value))
const rockMoss = (value: number) => uniform(value)
export function bindPondRockMaterial(mesh: Mesh, material: Material, index: number) {
  const style = rockStyles.get(material)
  if (style) rockMeshes.set(mesh, { ...style, index })
}
export function originalPondRockMaterial(mesh: Mesh) { return rockMeshes.get(mesh)?.material }
export function updatePondRockAppearance(group: Group, node: PondNode) {
  group.traverse(object => {
    const style = rockMeshes.get(object as Mesh)
    if (!style || style.index < 0) return
    const tone = (style.index / 7 - .5) * node.rockBorderColorVariation
    style.tint.value.set(node.rockBorder === 'stone' ? '#b6ac99' : '#f4eee2').offsetHSL(tone * .05, tone * .12, tone * .25)
    style.moss.value = node.rockBorderMoss * (node.rockBorder === 'stone' ? .25 : 1)
  })
}

/** Scanned rock textures projected in three directions, with damp stone and moss. */
export function pondRockMaterial(node: PondNode, withMoss = true, tint = '#f4eee2', mossAmount = 1, batched = false) {
  const tintUniform = rockTint(tint), mossUniform = rockMoss(mossAmount)
  if (batched && node.rockBorder === 'stone') {
    // Pool coping uses mineral-scale detail and a single pigment, rather than
    // multiplying a dark boulder scan by another dark stone colour.
    const p = positionWorld
    const mineral = p.x.mul(4.1).add(p.z.mul(3.8)).sin()
      .mul(p.x.mul(12.4).sub(p.z.mul(8.3)).sin())
    const grain = p.x.mul(32).add(p.z.mul(18)).sin().mul(p.y.mul(27).sub(p.z.mul(31)).sin())
    const fracture = smoothstep(.005,.06,p.x.mul(2.7).add(p.z.mul(1.9)).add(p.y.mul(.8)).sin().abs()).oneMinus()
    const shade = mineral.mul(.08).add(grain.mul(.025)).sub(fracture.mul(.055)).add(.96)
    const baseElevation = uniform(node.position[1] + node.elevation - node.waterDrop)
    const wet = smoothstep(-.03,.055,positionWorld.y.sub(baseElevation)).oneMinus()
    const moss = smoothstep(.4,.85,mineral).mul(mossUniform)
    const material = new MeshStandardNodeMaterial({ roughness: .82 })
    material.name = 'pond-mineral-stone-coping'
    material.userData.pondBaseElevation = baseElevation
    material.colorNode = mix(tintUniform.mul(shade),vec3(tintUniform.r.mul(.65),tintUniform.g.mul(.72),tintUniform.b.mul(.48)),moss)
      .mul(mix(1,.72,wet))
    material.roughnessNode = mix(.82,.38,wet)
    rockStyles.set(material,{ material,tint:tintUniform,moss:mossUniform })
    return material
  }
  const p = batched ? attribute<'vec3'>('rockLocalPosition', 'vec3') : positionLocal
  const localNormal = batched ? attribute<'vec3'>('rockLocalNormal', 'vec3') : normalLocal
  const weights = localNormal.normalize().abs().pow(vec3(5))
  const w = weights.div(weights.x.add(weights.y).add(weights.z))
  const diffuse = scan(rockImage), moss = scan(mossImage), arm = scan(armImage, true)
  const tri = texture(diffuse, p.yz.mul(2.1)).rgb.mul(w.x).add(texture(diffuse, p.xz.mul(2.1)).rgb.mul(w.y)).add(texture(diffuse, p.xy.mul(2.1)).rgb.mul(w.z))
  const luminance = vec3(.2126, .7152, .0722), stoneLight = dot(tri, luminance)
  const stone = batched && node.rockBorder === 'stone'
    ? mix(vec3(.44,.43,.40),vec3(.65,.63,.58),smoothstep(.05,.65,stoneLight))
    : vec3(.65, .48, .28).add(vec3(.39, .31, .22).mul(stoneLight.sub(.15)))
  const mossUv = p.xz.add(vec2(.37, -.23).mul(p.y)).add(positionWorld.xz.floor().mul(.173))
  const warp = texture(moss, mossUv.mul(.73)).rg.sub(.23)
  const coarse = dot(texture(moss, mossUv.mul(.89).add(warp.mul(.48))).rgb, luminance)
  const rotated = vec2(mossUv.x.mul(.8).add(mossUv.y.mul(.6)), mossUv.y.mul(.8).sub(mossUv.x.mul(.6)))
  const medium = dot(texture(moss, rotated.mul(3.13).add(warp.mul(.17))).rgb, luminance)
  const fine = dot(texture(moss, mossUv.mul(11.7)).rgb, luminance)
  const growth = coarse.mul(.64).add(medium.mul(.26)).add(fine.mul(.1))
  const cover = withMoss ? smoothstep(.18, .33, growth.add(localNormal.y.max(0).mul(.12))).mul(mossUniform.mul(.96)) : float(0)
  const mossLight = dot(texture(moss, p.xz.mul(2)).rgb, luminance)
  const colonies = vec3(.14, .27, .009).add(vec3(.66, .85, .1).mul(mossLight.sub(.16)))
    .mul(fine.sub(.14).mul(5).clamp(-1, 1).mul(.12).add(.94))
  const baseElevation = uniform(node.position[1] + node.elevation)
  const relativeY = positionWorld.y.sub(baseElevation)
  const wet = smoothstep(-.09, .15, relativeY).oneMinus()
  const waterline = relativeY.sub(.015).div(.085).pow(2).negate().exp()
  const dryStone = withMoss ? stone : mix(dot(stone, vec3(.299, .587, .114)).mul(vec3(1.12, 1.08, .98)), stone, .35).mul(1.16).add(vec3(.024, .022, .017))
  const rockSurface = texture(arm, p.yz.mul(2.1)).rgb.mul(w.x).add(texture(arm, p.xz.mul(2.1)).rgb.mul(w.y)).add(texture(arm, p.xy.mul(2.1)).rgb.mul(w.z))
  const material = new MeshStandardNodeMaterial({ roughness: .84 })
  material.name = 'pond-scanned-moss-rock'
  material.userData.pondBaseElevation = baseElevation
  rockStyles.set(material, { material, tint: tintUniform, moss: mossUniform })
  material.colorNode = mix(dryStone, colonies, cover).mul(tintUniform)
    .mul(mix(1, withMoss ? .86 : .92, wet)).mul(mix(1, .86, waterline))
  material.normalNode = normalMap(texture(scan(rockNormalImage, true)), vec2(.32, .32))
  material.roughnessNode = mix(mix(rockSurface.g.mul(.8).add(.2).clamp(.6, .95), rockSurface.g.mul(.12).add(.32), wet), .94, cover.mul(.7))
  return material
}
