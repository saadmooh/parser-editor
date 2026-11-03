import { Color, InstancedMesh, LOD, Mesh, SRGBColorSpace, TextureLoader, type Object3D, type Texture } from 'three'
import { DEFAULT_TREE_LOD, resolveTreeLod, type TreeNode } from '../domain/schema'
import { treeControls } from '../domain/species'
import { TREE_TEXTURES } from './asset-manifest'
import { composeMaterials, generate, speciesOrThrow } from '../vendor/api/seedthree.js'
import { buildFruits, makeFruitMaterial, prepareFruitGeometry } from '../vendor/core/fruit.js'
import { Rng } from '../vendor/core/rng.js'
import { bakeBranchCards, bakeRosetteCards, disposeBranchCards } from '../vendor/core/branch-cards.js'
import { bakeImpostor, disposeBillboard } from '../vendor/core/impostor.js'

const textures = new Map<string, Texture>()
const textureLoads = new Map<string, Promise<void>>()
const loader = new TextureLoader()
type CardEntry = { cards: any; users: number }
export type TreeGeometryUpdate = 'fruit' | 'cards' | 'billboard'
const cardCache = new Map<string, CardEntry>()
const treeCards = new WeakMap<LOD, CardEntry>()
let bakeQueue: Promise<void> = Promise.resolve()
let bakeRenderer: Promise<import('three/webgpu').WebGPURenderer> | undefined
type FruitAsset = { geometry: import('three').BufferGeometry; material: import('three').Material }
const fruitAssets = new Map<string, FruitAsset>()
const fruitLoads = new Map<string, Promise<FruitAsset | null>>()

function texture(folder: 'bark' | 'leaves', file: string, srgb = false): Texture | null {
  const asset = TREE_TEXTURES[`${folder}/${file}`]
  if (!asset) return null
  let result = textures.get(asset.src)
  if (!result) {
    let resolveLoad: (() => void) | undefined
    const loaded = new Promise<void>((resolve) => { resolveLoad = resolve })
    result = loader.load(asset.src, () => resolveLoad?.(), undefined, () => resolveLoad?.())
    if (srgb) result.colorSpace = SRGBColorSpace
    textures.set(asset.src, result)
    textureLoads.set(asset.src, loaded)
  }
  return result
}

function maps(folder: 'bark' | 'leaves', albedo: string) {
  const base = albedo.replace(/_albedo\.webp$/, '')
  return {
    albedo: texture(folder, albedo, true),
    normal: texture(folder, `${base}_normal.webp`),
    roughness: texture(folder, `${base}_roughness.webp`),
    translucency: folder === 'leaves' ? texture(folder, `${base}_translucency.webp`) : null,
    dry: folder === 'leaves' ? texture(folder, `${base}_dry_albedo.webp`, true) : null,
    dryest: folder === 'leaves' ? texture(folder, `${base}_dryest_albedo.webp`, true) : null,
  }
}

function makeAssets(species: string) {
  const preset = speciesOrThrow(species)
  const bark = maps('bark', preset.bark)
  const leaf = maps('leaves', preset.leaf)
  const assets: Record<string, unknown> = {
    barkTexture: bark.albedo, barkNormal: bark.normal, barkRoughness: bark.roughness,
    leafTexture: leaf.albedo, leafNormal: leaf.normal, leafRoughness: leaf.roughness,
    leafTranslucency: leaf.translucency, leafDryTexture: leaf.dry, leafDryestTexture: leaf.dryest,
    ribsPerTile: preset.params?.ribsPerTile,
  }
  if (preset.cactus) {
    const clean = maps('bark', preset.bark.replace(/_skin_albedo\.webp$/, '_skin_clean_albedo.webp'))
    assets.barkCleanAlbedo = clean.albedo
    assets.barkCleanNormal = clean.normal
    assets.barkCleanRoughness = clean.roughness
  }
  if (preset.thatchBark) {
    const thatch = maps('bark', preset.thatchBark)
    assets.thatchTexture = thatch.albedo
    assets.thatchNormal = thatch.normal
    assets.thatchRoughness = thatch.roughness
  }
  const fruit = fruitAssets.get(preset.fruit?.mesh)
  if (fruit) { assets.fruitGeo = fruit.geometry; assets.fruitMat = fruit.material }
  return composeMaterials(preset, assets)
}

function loadFruit(mesh: string): Promise<FruitAsset | null> {
  const existing = fruitLoads.get(mesh)
  if (existing) return existing
  if (mesh !== 'apple.glb' && mesh !== 'cherry_pair.glb') return Promise.resolve(null)
  const pending = import('three/addons/loaders/GLTFLoader.js').then(async ({ GLTFLoader }) => {
    const encoded = mesh === 'apple.glb'
      ? (await import('./fruit-apple-data')).default
      : (await import('./fruit-cherry_pair-data')).default
    const binary = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    const gltf = await new Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>((resolve, reject) =>
      new GLTFLoader().parse(binary.buffer, '', resolve, reject))
    gltf.scene.updateMatrixWorld(true)
    let source: Mesh | null = null
    gltf.scene.traverse((object) => { if (!source && object instanceof Mesh) source = object })
    if (!source) return null
    const fruitMesh = source as Mesh
    const geometry = prepareFruitGeometry(fruitMesh.geometry.clone().applyMatrix4(fruitMesh.matrixWorld))
    const material = makeFruitMaterial(Array.isArray(fruitMesh.material) ? fruitMesh.material[0] : fruitMesh.material)
    geometry.userData.shared = true
    material.userData.seedThreeSharedFruit = true
    const result = { geometry, material }
    fruitAssets.set(mesh, result)
    return result
  }).catch((error) => { console.warn(`[SeedThree] Fruit asset ${mesh} could not load`, error); return null })
  fruitLoads.set(mesh, pending)
  return pending
}

function addFruitWhenReady(node: TreeNode, group: import('three').LOD, stems: any[], tips: any[],
  onUpdate?: (kind: TreeGeometryUpdate) => void) {
  const preset = speciesOrThrow(node.species)
  if (!preset.fruit?.mesh || node.controls.showLeaves === false || node.lod.mobileTarget || fruitAssets.has(preset.fruit.mesh)) return
  const seed = Number(node.controls.seed ?? 1)
  void loadFruit(preset.fruit.mesh).then((fruitAsset) => {
    if (!fruitAsset || group.userData.seedThreeDisposed) return
    const guideLevel = preset.guideLevel ?? (preset.terminalStemsAreGuides ? Math.max(...stems.map((stem) => stem.level)) : null)
    const deepestWood = Math.max(...stems.map((stem) => stem.level)) - (guideLevel == null ? 0 : 1)
    const fruitStems = guideLevel == null ? tips : stems.filter((stem) => stem.level === deepestWood)
    for (let i = 0; i < Math.min(2, group.levels.length); i++) {
      const config = i === 0 ? preset.fruit : { ...preset.fruit, maxCount: Math.round((preset.fruit.maxCount ?? 120) * 0.25) }
      const planted = buildFruits(fruitStems, config, new Rng(`${preset.name}:${seed}:fruit${i}`),
        fruitAsset.geometry, fruitAsset.material, stems)
      if (planted) group.levels[i]?.object.add(planted)
    }
    onUpdate?.('fruit')
  })
}

function applyMobileLod(group: LOD, lod: TreeNode['lod']) {
  if (!group.levels.some((level) => level.object.userData.hiddenInApp)) return
  for (const level of group.levels) {
    const name = level.object.userData.lodName
    if (level.object.userData.hiddenInApp) level.distance = 1e7
    else if (name === 'LOD2') level.distance = 0
    else if (name === 'LOD3') level.distance = Number(lod.lod1Dist ?? 35)
    else if (name === 'LOD4') level.distance = Number(lod.lod2Dist ?? 70)
    else if (name === 'BB') level.distance = Number(lod.billboardDist ?? 120)
  }
  group.levels.sort((a, b) => a.distance - b.distance)
}

function markCardMaterials(cards: any) {
  for (const set of cards?.byLevel?.values?.() ?? [cards]) {
    for (const variant of set?.variants ?? []) {
      variant.material.userData.seedThreeSharedCard = true
      if (variant.side) variant.side.material.userData.seedThreeSharedCard = true
    }
  }
}

function trimCardCache() {
  for (const [key, entry] of cardCache) {
    if (cardCache.size <= 6) break
    if (entry.users) continue
    cardCache.delete(key)
    disposeBranchCards(entry.cards)
  }
}

async function getBakeRenderer() {
  if (!bakeRenderer) bakeRenderer = (async () => {
    const { WebGPURenderer } = await import('three/webgpu')
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(64, 64) : document.createElement('canvas')
    const renderer = new WebGPURenderer({ canvas, antialias: false })
    await renderer.init()
    return renderer
  })()
  return bakeRenderer
}

async function getCards(node: TreeNode, shaped: any, assets: any, renderer: import('three/webgpu').WebGPURenderer) {
  const species = speciesOrThrow(node.species)
  if (node.controls.showLeaves === false || species.foliage === false || species.cactus) return null
  const rosette = species.foliageType === 'rosette'
  if (rosette && !node.lod.mobileTarget) return null
  if (!rosette && (!shaped.foliage || (shaped.foliage.leavesPerBranch ?? 1) <= 0)) return null
  const size = DEFAULT_TREE_LOD.cardRes
  const variants = DEFAULT_TREE_LOD.cardVariants
  const { seed: _seed, ...bakeControls } = node.controls
  const key = JSON.stringify([node.species, shaped.params, shaped.foliage, shaped.guideLevel,
    shaped.terminalStemsAreGuides, bakeControls, size, variants, Boolean(node.lod.mobileTarget)])
  const cached = cardCache.get(key)
  if (cached) {
    cardCache.delete(key)
    cardCache.set(key, cached)
    return cached
  }
  let cards: any = null
  if (rosette) {
    cards = await bakeRosetteCards(renderer, shaped, assets, { size, variants })
  } else {
    const maxLevel = (shaped.params.levels ?? 3) - 1
    const willow = shaped.foliage?.mode === 'willowCurtains'
    const set = await bakeBranchCards(renderer, shaped, assets, {
      size, variants, cardLevel: maxLevel, foliageOnly: true,
      gravityAligned: willow, crossViews: willow || Boolean(shaped.crossedLod2Cards),
      noFlutter: willow || Boolean(shaped.crossedLod2Cards),
    })
    if (set) cards = { byLevel: new Map([[`${maxLevel}:fol`, set]]),
      variants: set.variants, centerUniform: set.centerUniform }
  }
  if (!cards) return null
  markCardMaterials(cards)
  const entry = { cards, users: 0 }
  cardCache.set(key, entry)
  return entry
}

function disposeMeshes(group: Object3D, disposeMaterials: boolean) {
  const geometries = new Set<import('three').BufferGeometry>()
  const materials = new Set<import('three').Material>()
  group.traverse((object) => {
    if (!(object instanceof Mesh) || object.userData.isBillboardCard) return
    if (object instanceof InstancedMesh) object.dispose()
    if (!object.geometry.userData.shared) geometries.add(object.geometry)
    if (disposeMaterials) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material.userData.seedThreeSharedFruit && !material.userData.seedThreeSharedCard) materials.add(material)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}

async function bakeLods(node: TreeNode, group: LOD, controls: Record<string, unknown>, assets: any, shaped: any,
  onUpdate?: (kind: TreeGeometryUpdate) => void) {
  if (group.userData.seedThreeDisposed) return
  const renderer = await getBakeRenderer()
  await Promise.all(textureLoads.values())
  if (group.userData.seedThreeDisposed) return
  const cardEntry = await getCards(node, shaped, assets, renderer)
  if (group.userData.seedThreeDisposed) return
  let rebuiltCards = false
  if (cardEntry) {
    const fruit = fruitAssets.get(speciesOrThrow(node.species).fruit?.mesh)
    if (fruit) { assets.fruitGeo = fruit.geometry; assets.fruitMat = fruit.material }
    const rebuilt = generate({ species: node.species, seed: Number(controls.seed ?? 1), controls,
      lod: { ...node.lod, branchCards: cardEntry.cards, cloneCardGeometry: true }, assets })
    // Preserve the mounted LOD identity so the viewer sees the newly baked levels.
    disposeMeshes(group, false)
    group.clear()
    group.levels.length = 0
    for (const level of rebuilt.group.levels) group.addLevel(level.object, level.distance, level.hysteresis)
    group.name = rebuilt.group.name
    cardEntry.users++
    treeCards.set(group, cardEntry)
    trimCardCache()
    rebuiltCards = true
  }
  applyMobileLod(group, node.lod)
  if (rebuiltCards) onUpdate?.('cards')
  const source = group.levels.find((level) => level.object.userData.lodName === 'LOD0')?.object
  if (!source || group.userData.seedThreeDisposed) return
  const billboard = await bakeImpostor(renderer, source, { name: speciesOrThrow(node.species).name,
    lodName: `LOD${group.levels.length}`, size: DEFAULT_TREE_LOD.billboardRes })
  if (group.userData.seedThreeDisposed) { disposeBillboard(billboard); return }
  group.addLevel(billboard, Number(node.lod.billboardDist ?? 120), 0.05)
  applyMobileLod(group, node.lod)
  onUpdate?.('billboard')
}

export function buildTreeGeometry(node: TreeNode, onUpdate?: (kind: TreeGeometryUpdate) => void) {
  node = { ...node, lod: resolveTreeLod(node.lod) }
  const controls = { ...treeControls(node.species), ...node.controls }
  if (typeof document === 'undefined') {
    return generate({ species: node.species, seed: Number(controls.seed ?? 1),
      controls, lod: node.lod }).group
  }
  const assets = makeAssets(node.species)
  const tint = Number(controls.leafColorize ?? 0xffffff)
  assets.leafTintNode?.value.set(tint)
  assets.clusterTintNode?.value.set(tint)
  if (assets.leafTintAmount) assets.leafTintAmount.value = Number(controls.leafTintAmount ?? 0)
  if (assets.clusterTintAmount) assets.clusterTintAmount.value = Number(controls.leafTintAmount ?? 0)
  for (const material of [assets.leafMat, assets.clusterMat]) {
    if (material) material.alphaTest = Number(controls.leafAlpha ?? 0.4)
  }
  const barkTint = Number(controls.barkTint ?? 0xffffff)
  if (assets.barkMat?.userData?.barkTint) {
    const color = new Color(barkTint).convertSRGBToLinear()
    assets.barkMat.userData.barkTint.value.set(color.r, color.g, color.b)
  } else assets.barkMat?.color.set(barkTint)
  if (assets.barkMat) assets.barkMat.flatShading = Boolean(controls.barkFlat)
  if (assets.barkMat?.userData?.barkDamage) assets.barkMat.userData.barkDamage.value = Number(controls.barkDamage ?? 0.35)
  if (assets.barkMat?.userData?.barkSeed) {
    const h = Math.abs(Math.sin(Number(controls.seed ?? 1) * 12.9898) * 43758.5453)
    assets.barkMat.userData.barkSeed.value.set(h % 10, h * 1.37 % 10, h * 2.71 % 10)
  }
  for (const key of ['frondGreenTint', 'frondDryTint', 'frondDryestTint'] as const) {
    if (assets[key] && controls[key] !== undefined) assets[key].value.set(Number(controls[key])).convertSRGBToLinear()
  }
  if (assets.frondDryness) assets.frondDryness.value = Number(controls.frondDryness ?? 0)
  if (assets.spineMat) assets.spineMat.color.set(Number(controls.spineTint ?? 0xffffff))
  const { group, stems, tips, shaped } = generate({ species: node.species, seed: Number(controls.seed ?? 1), controls,
    lod: node.lod, assets })
  addFruitWhenReady(node, group, stems, tips, onUpdate)
  applyMobileLod(group, node.lod)
  group.traverse((object: Object3D) => {
    if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true }
  })
  bakeQueue = bakeQueue.then(() => bakeLods(node, group, controls, assets, shaped, onUpdate))
    .catch((error) => { console.warn('[SeedThree] LOD bake failed; using generated mesh levels', error) })
  return group
}

export function disposeTreeGeometry(group: Object3D) {
  group.userData.seedThreeDisposed = true
  const cardEntry = group instanceof LOD ? treeCards.get(group) : undefined
  if (cardEntry) {
    cardEntry.users--
    treeCards.delete(group as LOD)
  }
  if (group instanceof LOD) for (const level of group.levels) {
    if (level.object.userData.isBillboard) disposeBillboard(level.object)
  }
  disposeMeshes(group, true)
  trimCardCache()
}
