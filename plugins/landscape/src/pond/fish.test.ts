import { expect, spyOn, test } from 'bun:test'
import { Group, Mesh } from 'three'
import { PondNode } from './schema'
import { createPondTerrainField } from './terrain'
import { addPondFish, getPondFishState, koiHabitat, spookPondFish, updatePondFish } from './fish'
import { buildPondGeometry, disposePondGeometry, updatePondWater } from './geometry'
import { getPondWaterState, makePondWaves } from './water'
import { pondWaterPresets } from './presets'
import { pondDefinition } from './definition'

test('old saved ponds have no fish; new controls are bounded and presets validate', () => {
  expect(pondDefinition.renderer).toBeDefined()
  expect('geometry' in pondDefinition).toBe(false)
  expect(PondNode.parse({}).fishCount).toBe(0)
  for (const [waterPreset,settings] of Object.entries(pondWaterPresets))
    expect(PondNode.safeParse({ ...settings,waterPreset }).success).toBe(true)
  for (const invalid of [{ fishCount: 25 },{ fishCount: 1.2 },{ fishSize: -1 },{ waterClarity: NaN },{ reflectionStrength: 2 },{ rain: Infinity }])
    expect(PondNode.safeParse(invalid).success).toBe(false)
})

test('koi have finite geometry and stay in navigable, submerged habitat during swimming', () => {
  const node = PondNode.parse({ fishCount: 6 }), field = createPondTerrainField(node), group = new Group()
  addPondFish(group,node,field,[{ x: .5,z: .5,radius: .3 }])
  const state = getPondFishState(group)!
  expect(state.fish).toHaveLength(6)
  group.traverse(object => {
    if (object instanceof Mesh) expect(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
  })
  const before = state.fish.map(fish => fish.mesh.position.clone())
  for (let frame = 1; frame <= 1200; frame++) {
    updatePondFish(group,frame / 60)
    if (frame % 60) continue
    for (const fish of state.fish) {
      const p = fish.mesh.position
      expect(state.safe(p.x,p.z)).toBe(true)
      expect(p.y).toBeGreaterThan(field.height(p.x,p.z))
      expect(p.y + node.fishSize * .13).toBeLessThan(state.waterY)
      // Captures can read matrices without a scene traversal in the editor.
      expect(fish.mesh.matrixWorld.elements[12]).toBeCloseTo(p.x)
      expect(fish.mesh.matrixWorld.elements[14]).toBeCloseTo(p.z)
    }
  }
  expect(state.fish.some((fish,index) => fish.mesh.position.distanceTo(before[index]!) > .1)).toBe(true)
  const textures = state.textures.map(texture => spyOn(texture,'dispose'))
  disposePondGeometry(group)
  textures.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1))
  expect(getPondFishState(group)).toBeUndefined()
})

test('concave ponds and small shallow ponds do not spawn fish on dry land', () => {
  const concave = PondNode.parse({ shape: 'custom',width: 5,depth: 4,fishCount: 12,fishSize: .2,
    outline: [[-.5,-.5],[.5,-.5],[.5,.5],[.15,.5],[.15,-.1],[-.15,-.1],[-.15,.5],[-.5,.5]] })
  const field = createPondTerrainField(concave), group = new Group()
  addPondFish(group,concave,field)
  const state = getPondFishState(group)!
  expect(state.fish).toHaveLength(12)
  for (let i = 1; i <= 300; i++) updatePondFish(group,i / 60)
  state.fish.forEach(fish => expect(state.safe(fish.mesh.position.x,fish.mesh.position.z)).toBe(true))
  disposePondGeometry(group)
  const tiny = PondNode.parse({ fishCount: 24,width: .2,depth: .2,basinDepth: .15,fishSize: .8 }), small = new Group()
  expect(koiHabitat(tiny,createPondTerrainField(tiny)).sites).toHaveLength(0)
  addPondFish(small,tiny,createPondTerrainField(tiny))
  expect(small.children).toHaveLength(0)
})

test('impacts use world coordinates and fish response can be disabled', () => {
  const node = PondNode.parse({ fishCount: 2 }), field = createPondTerrainField(node), group = new Group()
  group.position.set(4,2,-3); group.rotation.y = .7; group.updateMatrixWorld(true)
  addPondFish(group,node,field)
  const state = getPondFishState(group)!
  const fishPoint = group.localToWorld(state.fish[0]!.mesh.position.clone())
  spookPondFish(group,fishPoint)
  expect(state.fish[0]!.startledUntil).toBeGreaterThan(0)
  state.node.fishResponse = 0; state.fish[0]!.startledUntil = 0
  spookPondFish(group,fishPoint)
  expect(state.fish[0]!.startledUntil).toBe(0)
  disposePondGeometry(group)
})

test('rain drives the solver, koi animate with still water, and material clones retain animation', () => {
  const group = buildPondGeometry(PondNode.parse({ fishCount: 6,rain: 1,rippleStrength: 0,waveSpeed: 1.4,waveSettling: 1.5 }))
  const state = getPondFishState(group)!, initial = state.fish[0]!.mesh.position.clone()
  const body = group.getObjectByName('pond-koi-body') as Mesh, original = body.material as import('three/webgpu').MeshStandardNodeMaterial
  body.material = original.clone()
  const originalDispose = spyOn(original,'dispose')
  expect((body.material as typeof original).positionNode).toBe(original.positionNode)
  for (let frame = 1; frame <= 120; frame++) updatePondWater(group,frame / 60)
  expect(state.fish[0]!.mesh.position.distanceTo(initial)).toBeGreaterThan(.01)
  const water = group.getObjectByName('pond-water') as Mesh
  expect(getPondWaterState(water)!.waves.stats().energy).toBeGreaterThan(0)
  expect(makePondWaves(group)).toBe(true)
  updatePondWater(group,120)
  expect(state.fish[0]!.mesh.position.distanceTo(initial)).toBeLessThan(3)
  disposePondGeometry(group)
  expect(originalDispose).toHaveBeenCalledTimes(1)
})

test('indexed habitat matches exact clearance checks across dense borders and concave banks', () => {
  const node = PondNode.parse({ shape: 'custom', width: 6, depth: 4, fishSize: .45,
    outline: [[-.5,-.5],[.5,-.5],[.5,.5],[0,0],[-.5,.5]] })
  const field = createPondTerrainField(node), clearance = node.fishSize * .6
  const obstacles = Array.from({ length: 384 }, (_, i) => ({ x: Math.sin(i * 2.399) * 3, z: Math.cos(i * 2.399) * 2, radius: .08 + i % 5 * .025 }))
  const { safe } = koiHabitat(node, field, obstacles), b = field.bounds
  for (let row = 0; row <= 60; row++) for (let col = 0; col <= 60; col++) {
    const x = b.minX - .1 + col / 60 * (b.maxX - b.minX + .2)
    const z = b.minZ - .1 + row / 60 * (b.maxZ - b.minZ + .2)
    const expected = x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ
      && !obstacles.some(o => Math.hypot(x - o.x,z - o.z) < o.radius + clearance)
      && [[0,0],[clearance,0],[-clearance,0],[0,clearance],[0,-clearance]]
        .every(([dx,dz]) => node.elevation - node.waterDrop - field.height(x + dx!,z + dz!) >= Math.max(.12,node.fishSize * .8 + .06))
    expect(safe(x,z)).toBe(expected)
  }
})

test('large koi schools share one species atlas and use one eye mesh per fish', () => {
  const group = buildPondGeometry(PondNode.parse({ width: 8, depth: 6, fishCount: 24 }))
  const state = getPondFishState(group)!
  expect(state.fish).toHaveLength(24)
  expect(state.textures).toHaveLength(1)
  expect(state.fish.every(fish => fish.mesh.children.length === 3)).toBe(true)
  expect(state.fish.every(fish => fish.mesh.getObjectByName('pond-koi-eyes'))).toBe(true)
  const disposals = state.textures.map(texture => spyOn(texture, 'dispose'))
  disposePondGeometry(group)
  for (const dispose of disposals) { expect(dispose).toHaveBeenCalledTimes(1); dispose.mockRestore() }
})

test('individual burst/coast rhythms are reproducible, varied and stay safe over extended roaming', () => {
  const node = PondNode.parse({ fishCount: 24, fishType: 'mixed' }), field = createPondTerrainField(node)
  const a = new Group(), b = new Group()
  addPondFish(a,node,field); addPondFish(b,node,field)
  const first = getPondFishState(a)!, second = getPondFishState(b)!
  expect(new Set(first.fish.map(fish => fish.rhythm)).size).toBe(24)
  const min = Array(24).fill(Infinity), max = Array(24).fill(0)
  for (let frame = 1; frame <= 3600; frame++) {
    updatePondFish(a,frame / 60); updatePondFish(b,frame / 60)
    if (frame < 300 || frame % 60) continue
    for (let i = 0; i < 24; i++) {
      const fish = first.fish[i]!, p = fish.mesh.position
      min[i] = Math.min(min[i],fish.velocity); max[i] = Math.max(max[i],fish.velocity)
      expect(first.safe(p.x,p.z)).toBe(true)
      expect(p.y).toBeGreaterThan(field.height(p.x,p.z))
      expect(p.y).toBeLessThan(first.waterY)
      expect(p.distanceTo(second.fish[i]!.mesh.position)).toBe(0)
      expect(Number.isFinite(fish.turnRate)).toBe(true)
    }
  }
  expect(first.fish.every((_,i) => max[i] - min[i] > .02)).toBe(true)
  const before = first.fish.map(fish => fish.mesh.position.clone())
  updatePondFish(a,60)
  expect(first.fish.every((fish,i) => fish.mesh.position.equals(before[i]!))).toBe(true)
  disposePondGeometry(a); disposePondGeometry(b)
})
