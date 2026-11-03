import { BufferGeometry, CatmullRomCurve3, DataTexture, DoubleSide, Float32BufferAttribute, Group, MathUtils, Mesh, SphereGeometry, Vector3 } from 'three'
import { MeshStandardNodeMaterial, type Node } from 'three/webgpu'
import type { Material } from 'three'
import { normalLocal, positionLocal, smoothstep, transformNormalToView, uniform, vec3 } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { retainFishAtlas, fishAppearance } from './fish-appearance'
import type { PondNode } from './schema'
import type { createPondTerrainField } from './terrain'
import type { WaveField } from './wave-field.js'

type Field = ReturnType<typeof createPondTerrainField>
type Obstacle = { x: number; z: number; radius: number }
type Point = { x: number; z: number }
type Fish = { mesh: Group; home: Point; angle: number; phase: number; speed: number; velocity: number; rhythm: number; activity: number; social: number; destination: Point; destinationUntil: number; decision: number; turnRate: number; maxTurn: number; depthRatio: number; depthFrequency: number; swim: ReturnType<typeof swimUniforms>; startledUntil: number; wakeCooldown: number; escape: Point }
type FishState = { fish: Fish[]; field: Field; node: PondNode; waterY: number; safe: (x: number, z: number) => boolean; sites: Point[]; previous: number; time: number; textures: DataTexture[]; releaseAtlas: () => void; materials: Material[] }
// Deterministic individuality; no random sampling or new destinations every frame.
const individual = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}
const states = new WeakMap<Group, FishState>()
const swimUniforms = () => ({ phase: uniform(0), amplitude: uniform(.035), turn: uniform(0) })

/** Shared low-poly body template; species profiles adjust its proportions and atlas UVs. */
export function koiBodyGeometry() {
  const rings = [[-.45,.013,.021],[-.36,.02,.032],[-.24,.052,.07],[-.08,.091,.117],
    [.075,.107,.127],[.215,.09,.108],[.29,.075,.092],[.365,.05,.06],[.42,.027,.034],[.45,.017,.022]]
  const lengthSegments = 24, radialSegments = 16
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  for (let row = 0; row <= lengthSegments; row++) {
    const u = row / lengthSegments, x = -.45 + u * .9
    let segment = 0
    while (segment < rings.length - 2 && x > rings[segment + 1]![0]!) segment++
    const a = rings[segment]!, b = rings[segment + 1]!, t = MathUtils.smoothstep(x, a[0]!, b[0]!)
    const width = MathUtils.lerp(a[1]!, b[1]!, t), height = MathUtils.lerp(a[2]!, b[2]!, t)
    for (let col = 0; col <= radialSegments; col++) {
      const angle = col / radialSegments * Math.PI * 2, vertical = Math.sin(angle)
      positions.push(x, vertical * height * (vertical < 0 ? .81 : 1) - .006, Math.cos(angle) * width)
      uvs.push(u, col / radialSegments)
      if (row < lengthSegments && col < radialSegments) { const i = row * (radialSegments + 1) + col; indices.push(i,i+radialSegments+1,i+1,i+1,i+radialSegments+1,i+radialSegments+2) }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

function fin(root: number[], edge: number[][], curve: number) {
  const outline = new CatmullRomCurve3(edge.map(p => new Vector3(...p as [number, number, number])))
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [], anchor = new Vector3(...root as [number, number, number])
  for (let row = 0; row <= 12; row++) {
    const tip = outline.getPoint(row / 12)
    for (let col = 0; col <= 3; col++) {
      const t = col / 3, p = anchor.clone().lerp(tip, t); p.z += Math.sin(t * Math.PI) * curve
      positions.push(p.x,p.y,p.z); uvs.push(row / 12,t)
      const ray = 1 - (row % 2 ? .23 : 0) * t
      colors.push(ray,ray,ray)
      if (row < 12 && col < 3) { const i = row * 4 + col; indices.push(i,i+1,i+4,i+1,i+5,i+4) }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry
}

function finsGeometry() {
  const parts = [fin([-.445,0,0],[[-.6,.125,0],[-.69,.17,0],[-.65,.06,0],[-.594,0,0],[-.65,-.06,0],[-.69,-.17,0],[-.6,-.125,0]],.012),
    fin([-.075,.09,0],[[.095,.123,0],[.016,.186,0],[-.07,.169,0],[-.2,.109,0],[-.25,.067,0]],.009)]
  for (const side of [-1,1]) {
    parts.push(fin([.1,-.035,.064 * side],[[.015,-.035,.09],[-.015,-.061,.21],[-.11,-.085,.245],[-.17,-.081,.177],[-.13,-.06,.08]].map(([x,y,z]) => [x!,y!,z! * side]),.008 * side))
    parts.push(fin([-.22,-.055,.035 * side],[[-.2,-.077,.05],[-.31,-.109,.11],[-.34,-.101,.075]].map(([x,y,z]) => [x!,y!,z! * side]),.005 * side))
  }
  const merged = mergeGeometries(parts)!
  parts.forEach(part => part.dispose()); return merged
}

function bendMaterial(material: MeshStandardNodeMaterial, swim: ReturnType<typeof swimUniforms>, membrane = false) {
  const bend = (x: Node<'float'>) => {
    const tail = smoothstep(-.67,.3,x).oneMinus().pow(2)
    return swim.phase.add(x.mul(6.8)).sin().mul(tail).mul(swim.amplitude).add(swim.turn.mul(tail).mul(.029))
  }
  const slope = bend(positionLocal.x.add(.004)).sub(bend(positionLocal.x.sub(.004))).div(.008)
  material.positionNode = positionLocal.add(vec3(0,membrane ? swim.phase.mul(.56).add(positionLocal.z.abs().mul(9)).sin().mul(smoothstep(.075,.25,positionLocal.z.abs())).mul(.023) : 0,bend(positionLocal.x)))
  material.normalNode = transformNormalToView(vec3(normalLocal.x.sub(slope.mul(normalLocal.z)),normalLocal.y,normalLocal.z).normalize())
}

/** Safe habitat is sampled instead of assuming a circular pond or a wet centre. */
export function koiHabitat(node: PondNode, field: Field, obstacles: Obstacle[] = []) {
  const waterY = node.elevation - node.waterDrop, clearance = node.fishSize * .6, requiredDepth = Math.max(.12,node.fishSize * .8 + .06)
  const bounds = field.bounds, cell = Math.max(.25, node.fishSize), buckets = new Map<string, Obstacle[]>()
  // Insert each clearance-expanded rock into every cell it intersects. The final
  // distance test is exact, so the index changes cost without changing habitat.
  for (const obstacle of obstacles) {
    const radius = obstacle.radius + clearance
    const minX = Math.floor(Math.max(bounds.minX, obstacle.x - radius) / cell)
    const maxX = Math.floor(Math.min(bounds.maxX, obstacle.x + radius) / cell)
    const minZ = Math.floor(Math.max(bounds.minZ, obstacle.z - radius) / cell)
    const maxZ = Math.floor(Math.min(bounds.maxZ, obstacle.z + radius) / cell)
    for (let row = minZ; row <= maxZ; row++) for (let col = minX; col <= maxX; col++) {
      const key = `${col}:${row}`, bucket = buckets.get(key)
      if (bucket) bucket.push(obstacle)
      else buckets.set(key, [obstacle])
    }
  }
  const offsets = [[0, 0], [clearance, 0], [-clearance, 0], [0, clearance], [0, -clearance]] as const
  const safe = (x: number, z: number) => {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false
    const nearby = buckets.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`)
    if (nearby) for (const obstacle of nearby) {
      const dx = x - obstacle.x, dz = z - obstacle.z, radius = obstacle.radius + clearance
      if (dx * dx + dz * dz < radius * radius) return false
    }
    for (const [dx, dz] of offsets)
      if (waterY - field.height(x + dx, z + dz) < requiredDepth) return false
    return true
  }
  const sites: Point[] = [], b = field.bounds
  for (let row = 0; row < 40; row++) for (let col = 0; col < 40; col++) {
    const x = b.minX + (col + .5) / 40 * (b.maxX - b.minX), z = b.minZ + (row + .5) / 40 * (b.maxZ - b.minZ)
    if (safe(x,z)) sites.push({ x,z })
  }
  return { safe, sites, waterY }
}

export function addPondFish(group: Group, node: PondNode, field: Field, obstacles: Obstacle[] = []) {
  if (!node.fishCount) return
  const { safe, sites, waterY } = koiHabitat(node,field,obstacles)
  if (!sites.length) return
  const body = koiBodyGeometry(), fins = finsGeometry()
  // Iris, pupil, glint and mouth share one small detail mesh and material.
  const detailParts: BufferGeometry[] = []
  const detail = (radius: number, width: number, height: number, position: [number,number,number], shade: [number,number,number]) => {
    const part = new SphereGeometry(radius,width,height).translate(...position)
    const colors = new Float32Array(part.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) colors.set(shade,i)
    part.setAttribute('color',new Float32BufferAttribute(colors,3)); detailParts.push(part)
    return part
  }
  for (const side of [-1,1]) {
    detail(.017,6,4,[.337,.035,.062 * side],[.34,.24,.08])
    detail(.011,6,4,[.339,.035,.074 * side],[.012,.018,.015])
    detail(.0035,4,2,[.343,.042,.083 * side],[.9,.94,.87])
  }
  detail(.012,6,4,[0,0,0],[.045,.026,.02]).scale(.45,.65,1).translate(.453,-.006,0)
  const eyes = mergeGeometries(detailParts)!
  detailParts.forEach(part => part.dispose())
  const eyeMaterial = new MeshStandardNodeMaterial({ color: '#ffffff',vertexColors: true,roughness: .3 })
  const atlasOwner = retainFishAtlas(), atlas = atlasOwner.texture, bodies = new Map<string, BufferGeometry>()
  const appendages = new Map<string, { fins: BufferGeometry; eyes: BufferGeometry }>()
  const textures: DataTexture[] = [atlas], fish: Fish[] = [], materials: Material[] = [eyeMaterial]
  for (let index = 0; index < node.fishCount; index++) {
    const swim = swimUniforms(), home = sites[(index * 137 + 29) % sites.length]!, mesh = new Group()
    swim.phase.value = index * 2.39996
    const appearance = fishAppearance(node.fishType, index), key = `${appearance.species}:${appearance.variant}`
    let bodyGeometry = bodies.get(key)
    if (!bodyGeometry) {
      bodyGeometry = body.clone()
      const p = bodyGeometry.getAttribute('position'), uv = bodyGeometry.getAttribute('uv')
      for (let vertex = 0; vertex < p.count; vertex++) {
        p.setXYZ(vertex, p.getX(vertex), p.getY(vertex) * appearance.profile.height, p.getZ(vertex) * appearance.profile.width)
        uv.setXY(vertex, appearance.uv.x + uv.getX(vertex) * appearance.uv.width,
          appearance.uv.y + uv.getY(vertex) * appearance.uv.height)
      }
      bodyGeometry.computeVertexNormals(); bodies.set(key, bodyGeometry)
    }
    let family = appendages.get(appearance.species)
    if (!family) {
      family = { fins: fins.clone(), eyes: eyes.clone() }
      for (const geometry of [family.fins, family.eyes]) {
        const positions = geometry.getAttribute('position')
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const x = positions.getX(vertex), y = positions.getY(vertex), z = positions.getZ(vertex)
          let height = appearance.profile.height, width = appearance.profile.width
          if (geometry === family.fins) {
            if (x < -.445) height *= appearance.profile.tail
            else if (y > .09 && Math.abs(z) < .03) height *= appearance.profile.dorsal
            if (Math.abs(z) > .09) width *= appearance.profile.finSpan
          }
          positions.setXYZ(vertex,x,y * height,z * width)
        }
        geometry.computeVertexNormals()
      }
      appendages.set(appearance.species, family)
    }
    const bodyMaterial = new MeshStandardNodeMaterial({ map: atlas, roughness: .4 }); bendMaterial(bodyMaterial,swim)
    const finMaterial = new MeshStandardNodeMaterial({ color: appearance.profile.fin, roughness: .49, vertexColors: true, transparent: true, opacity: .78, side: DoubleSide, depthWrite: false })
    bendMaterial(finMaterial,swim,true)
    materials.push(bodyMaterial,finMaterial)
    const bodyMesh = new Mesh(bodyGeometry,bodyMaterial); bodyMesh.name = 'pond-koi-body'; bodyMesh.castShadow = false; bodyMesh.receiveShadow = true
    const finMesh = new Mesh(family.fins,finMaterial); finMesh.renderOrder = 1
    mesh.add(bodyMesh,finMesh)
    const eyeMesh = new Mesh(family.eyes,eyeMaterial); eyeMesh.name = 'pond-koi-eyes'; mesh.add(eyeMesh)
    mesh.name = 'pond-koi'; mesh.userData.fishSpecies = appearance.species; mesh.scale.setScalar(node.fishSize / 1.14)
    const margin = node.fishSize * .4 + .02
    mesh.position.set(home.x,MathUtils.clamp(waterY - Math.max(.065,node.fishSize * .24),field.height(home.x,home.z) + margin,waterY - margin),home.z)
    mesh.rotation.y = index * 2.39996; group.add(mesh)
    fish.push({ mesh,home,angle: index * 2.39996,phase: index * 2.39996,speed: node.fishSize * (.6 + individual(index,1) * .6) * appearance.profile.pace,velocity: 0,
      rhythm: 1.8 + individual(index,2) * 3.2,activity: .25 + individual(index,3) * .3,
      social: .08 + individual(index,4) * .25,destination: home,destinationUntil: 0,decision: 0,turnRate: 0,maxTurn: 1 + individual(index,5) * .7,
      depthRatio: .3 + individual(index,6) * .45,depthFrequency: .17 + individual(index,7) * .2,swim,startledUntil: 0,wakeCooldown: 0,escape: home })
  }
  body.dispose(); fins.dispose(); eyes.dispose()
  states.set(group,{ fish,node,field,waterY,safe,sites,previous: 0,time: 0,textures,releaseAtlas: atlasOwner.release,materials })
}

export function getPondFishState(group: Group) {
  return states.get(group) ?? states.get(group.getObjectByName('pond-fish') as Group)
}
export function disposePondFish(group: Group) {
  const state = states.get(group)
  state?.releaseAtlas(); states.delete(group)
  return state?.materials ?? []
}

export function spookPondFish(group: Group, point: Vector3, power = .5) {
  const state = getPondFishState(group)
  if (!state || !state.node.fishResponse) return
  const local = group.worldToLocal(point.clone())
  for (const fish of state.fish) {
    if (Math.hypot(fish.mesh.position.x - local.x,fish.mesh.position.z - local.z) > 1.5 + power) continue
    fish.startledUntil = state.time + 1.7
    const dx = fish.mesh.position.x - local.x, dz = fish.mesh.position.z - local.z
    fish.escape = state.sites.reduce((best,p) => (p.x - local.x) * dx + (p.z - local.z) * dz > (best.x - local.x) * dx + (best.z - local.z) * dz ? p : best,state.sites[0]!)
  }
}

export function updatePondFish(group: Group, seconds: number, waves?: WaveField, cx = 0, cz = 0) {
  const state = getPondFishState(group)
  if (!state) return
  // Pause/resume never teleports the school to a new position.
  const dt = Math.min(.05,Math.max(0,seconds - state.previous)); state.previous = seconds; state.time += dt
  for (const [index,fish] of state.fish.entries()) {
    const p = fish.mesh.position, motion = waves?.motionAt(p.x - cx,p.z - cz)
    if (motion && Math.hypot(motion.vx,motion.vz) * state.node.fishResponse > .075 && state.time > fish.wakeCooldown) {
      fish.startledUntil = state.time + 1.1; fish.wakeCooldown = state.time + 2.7
      fish.escape = state.sites[(index * 173 + Math.floor(state.time * 20)) % state.sites.length]!
    }
    const startled = state.time < fish.startledUntil
    if (state.time >= fish.destinationUntil || !state.safe(fish.destination.x,fish.destination.z) ||
      Math.hypot(p.x - fish.destination.x,p.z - fish.destination.z) < state.node.fishSize * .8) {
      fish.decision++
      fish.destination = state.sites[Math.floor(individual(index,fish.decision + 10) * state.sites.length)]!
      fish.destinationUntil = state.time + 5 + individual(index,fish.decision + 100) * 8
    }
    const target = startled ? fish.escape : fish.destination
    let dx = target.x - p.x, dz = target.z - p.z
    const distance = Math.hypot(dx,dz)
    dx /= Math.max(.001,distance); dz /= Math.max(.001,distance)
    // A nearest visible neighbour gives a gentle social cue, not a rigid flock.
    let nearest = Infinity, neighbour: Fish | undefined
    for (const other of state.fish) {
      if (other === fish) continue
      const ox = other.mesh.position.x - p.x, oz = other.mesh.position.z - p.z, d2 = ox * ox + oz * oz
      if (d2 > .000001 && d2 < state.node.fishSize ** 2) {
        const d = Math.sqrt(d2), weight = (1 - d / state.node.fishSize) * 1.8
        dx -= ox / d * weight; dz -= oz / d * weight
      } else if (d2 < nearest && d2 < (state.node.fishSize * 6) ** 2 &&
        ox * Math.cos(fish.angle) - oz * Math.sin(fish.angle) > 0) {
        nearest = d2; neighbour = other
      }
    }
    if (neighbour && !startled) {
      dx += (neighbour.mesh.position.x - p.x) / Math.sqrt(nearest) * fish.social
      dz += (neighbour.mesh.position.z - p.z) / Math.sqrt(nearest) * fish.social
    }
    let angle = Math.atan2(-dz,dx) + (startled ? 0 :
      Math.sin(state.time * .63 + fish.phase) * .28 + Math.sin(state.time * .21 + fish.phase * 1.7) * .18)
    // Look ahead before the body reaches the bank. Choose a safe side consistently.
    const lookAhead = Math.max(state.node.fishSize * .8,fish.velocity * .9)
    if (!state.safe(p.x + Math.cos(fish.angle) * lookAhead,p.z - Math.sin(fish.angle) * lookAhead)) {
      const left = fish.angle + 1.2, right = fish.angle - 1.2
      const leftSafe = state.safe(p.x + Math.cos(left) * lookAhead,p.z - Math.sin(left) * lookAhead)
      const rightSafe = state.safe(p.x + Math.cos(right) * lookAhead,p.z - Math.sin(right) * lookAhead)
      angle = leftSafe ? left : rightSafe ? right : fish.angle + Math.PI
    }
    const turn = Math.atan2(Math.sin(angle - fish.angle),Math.cos(angle - fish.angle))
    const maxTurn = startled ? 4.2 : fish.maxTurn
    fish.turnRate = MathUtils.damp(fish.turnRate,MathUtils.clamp(turn * 2,-maxTurn,maxTurn),startled ? 12 : 4,dt)
    fish.angle += fish.turnRate * dt
    // Asynchronous burst/coast cycles, with smooth acceleration rather than jitter.
    const cycle = ((state.time + fish.phase) / fish.rhythm) % 1
    const effort = cycle < fish.activity ? Math.sin(cycle / fish.activity * Math.PI) : 0
    const desiredSpeed = fish.speed * (.6 + effort * 1.4) +
      (startled ? .5 * state.node.fishResponse : 0)
    fish.velocity = MathUtils.damp(fish.velocity,desiredSpeed,startled ? 8 : effort > 0 ? 3 : .8,dt)
    const speed = fish.velocity
    const x = p.x + (Math.cos(fish.angle) * speed + (motion?.vx ?? 0) * .12 * state.node.fishResponse) * dt
    const z = p.z + (-Math.sin(fish.angle) * speed + (motion?.vz ?? 0) * .12 * state.node.fishResponse) * dt
    if (state.safe(x,z)) { p.x = x; p.z = z }
    else { fish.velocity *= Math.exp(-dt * 8); fish.destinationUntil = 0 }
    const bottom = state.field.height(p.x,p.z), margin = state.node.fishSize * .4 + .02
    const depth = Math.max(.065,state.node.fishSize * fish.depthRatio)
    const desired = state.waterY - depth +
      Math.sin(state.time * fish.depthFrequency + fish.phase) * state.node.fishSize * .1 + (motion?.height ?? 0) * .15
    const oldY = p.y
    p.y = MathUtils.clamp(MathUtils.damp(p.y,desired,1.5,dt),bottom + margin,state.waterY - margin)
    fish.mesh.rotation.y = fish.angle
    fish.mesh.rotation.x = MathUtils.damp(fish.mesh.rotation.x,-fish.turnRate * .055,3,dt)
    fish.mesh.rotation.z = MathUtils.damp(fish.mesh.rotation.z,
      MathUtils.clamp(Math.atan2(p.y - oldY,Math.max(.001,speed * dt)),-.18,.18),3,dt)
    fish.swim.phase.value += dt * (1.2 + effort * 4 + speed * 7.8 + (startled ? 4 : 0))
    fish.swim.amplitude.value = MathUtils.damp(fish.swim.amplitude.value,.012 + effort * .025 + speed * .04,7,dt)
    fish.swim.turn.value = MathUtils.damp(fish.swim.turn.value,MathUtils.clamp(fish.turnRate,-1,1),4,dt)

  }
  // Update the school's hierarchy once before layered capture passes instead
  // of recalculating all ancestor matrices separately for every koi.
  state.fish[0]?.mesh.parent?.updateWorldMatrix(true, true)
}
