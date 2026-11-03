import { BufferGeometry, Color, Euler, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, Quaternion, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import rocks from './assets/rocks.json'
import { bindPondRockMaterial, pondRockMaterial } from './materials'
import type { PondNode } from './schema'
import { createPondTerrainField } from './terrain'
import { pondRockBorder } from './rock-border'
import { borderRockGeometry } from './border-rock-geometry'
import { flatStoneGeometry } from './stone-border'

function scannedRock(index: number) {
  const data = rocks[index]!, geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3))
  geometry.setIndex(data.indices)
  const uv: number[] = []
  for (let i = 0; i < data.positions.length; i += 3) uv.push(Math.atan2(data.positions[i + 2]!, data.positions[i]!) / (2 * Math.PI) + .5, data.positions[i + 1]! * 2)
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

function smoothBoulder(variant: number) {
  const geometry = new SphereGeometry(.5, 12, 8), p = geometry.attributes.position!
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), seed = variant * 1.71
    const d = 1 + .105 * Math.sin(x * 7 + seed) * Math.cos(z * 6 - seed) + .055 * Math.sin(y * 11 + z * 8 + seed)
    p.setXYZ(i, x * d * (1 + variant * .025), y * d * .85, z * d * (.91 + variant * .025))
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

/** Ox()'s eight uneven shoreline clusters, shelf rocks and submerged pebble field. */
export function addPondRocks(group: Group, node: PondNode, field: ReturnType<typeof createPondTerrainField>) {
  let seed = 49212
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const material = pondRockMaterial(node, true, '#f4eee2', 1, true), scanned = Array.from({ length: 5 }, (_, i) => scannedRock(i))
  const rounded = Array.from({ length: 6 }, (_, i) => smoothBoulder(i))
  const scaleUnit = Math.min(node.width / 18.2, (node.shape === 'circle' ? node.width : node.depth) / 13.6)
  const perimeter = field.outline
  const lengths = perimeter.map((p, i) => { const b = perimeter[(i + 1) % perimeter.length]!; return Math.hypot(b[0] - p[0], b[1] - p[1]) })
  const total = lengths.reduce((a, b) => a + b, 0)
  const pointAt = (angle: number, radial: number): [number, number] => {
    // Ellipses use the exact fs() shoreline; authored concave shapes use perimeter distance.
    if (node.shape === 'oval' || node.shape === 'circle') {
      const x = Math.cos(angle) * node.width / 2, z = Math.sin(angle) * (node.shape === 'circle' ? node.width : node.depth) / 2
      const r = field.radial(x, z)
      return [x / r * radial, z / r * radial]
    }
    let distance = ((angle / (2 * Math.PI) % 1 + 1) % 1) * total
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i]!) {
        const a = perimeter[i]!, b = perimeter[(i + 1) % perimeter.length]!, t = distance / lengths[i]!
        return [(a[0] + (b[0] - a[0]) * t) * radial, (a[1] + (b[1] - a[1]) * t) * radial]
      }
      distance -= lengths[i]!
    }
    return perimeter[0]!
  }
  const place = (x: number, z: number, size: number, submerged = false) => {
    const geometry = random() < .6 ? rounded[Math.floor(random() * 6)]! : scanned[Math.floor(random() * 5)]!
    const rock = new Mesh(geometry, material)
    rock.name = submerged ? 'pond-shelf-rock' : 'pond-shore-rock'
    rock.scale.set(size, size * (.75 + random() * .22), size * (.85 + random() * .3))
    rock.rotation.set((random() - .5) * .12, random() * Math.PI * 2, (random() - .5) * .12)
    rock.position.set(x, field.height(x, z) - geometry.boundingBox!.min.y * rock.scale.y - size * .12, z)
    if (submerged) rock.position.y = Math.min(rock.position.y, node.elevation - node.waterDrop - .02 - geometry.boundingBox!.max.y * rock.scale.y)
    rock.castShadow = !submerged; rock.receiveShadow = !submerged; group.add(rock)
  }
  const paletteForBatches = new Map<number, ReturnType<typeof pondRockMaterial>>()
  const borderBatches = new Map<ReturnType<typeof pondRockMaterial>, BufferGeometry[]>()
  const obstacles: { x: number; z: number; radius: number; top: number; kind: string }[] = []
  if (node.rockBorder === 'continuous' || node.rockBorder === 'stone') {
    const palette = paletteForBatches
    for (const design of pondRockBorder(node)) {
      let borderMaterial = palette.get(design.colorIndex)
      if (!borderMaterial) {
        const tone = (design.colorIndex / 7 - .5) * node.rockBorderColorVariation
        const tint = new Color(node.rockBorder === 'stone' ? '#b6ac99' : '#f4eee2').offsetHSL(tone * .05, tone * .12, tone * .25)
        borderMaterial = pondRockMaterial(node, true, `#${tint.getHexString()}`, node.rockBorderMoss * (node.rockBorder === 'stone' ? .25 : 1), true)
        palette.set(design.colorIndex, borderMaterial)
      }
      const geometry = design.stoneFootprint ? flatStoneGeometry(design) : borderRockGeometry(node, design.shapeSeed)
      const rock = new Mesh(geometry, borderMaterial)
      rock.name = 'pond-shore-rock'; rock.userData.pondRockBorder = true
      if (!design.stoneFootprint) rock.scale.set(design.size * design.aspect, design.size * design.height, design.size / design.aspect)
      rock.rotation.set(design.tiltX, design.angle, design.tiltZ)
      // Use the tilted bounds so every individual rock sits into the terrain.
      const support = geometry.boundingBox!.clone().applyMatrix4(new Matrix4().compose(new Vector3(), rock.quaternion, rock.scale))
      rock.position.set(design.x, field.height(design.x, design.z) - support.min.y - (design.stoneFootprint ? .025 : design.size * .16), design.z)
      rock.updateMatrix()
      obstacles.push({ x: rock.position.x, z: rock.position.z, radius: design.stoneFootprint ? geometry.boundingSphere!.radius : Math.max(rock.scale.x, rock.scale.z) * .5,
        top: rock.position.y + support.max.y, kind: 'pond-shore-rock' })
      // Keep each rock's original coordinates for triplanar texture projection.
      const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone()
      baked.setAttribute('rockLocalPosition', baked.getAttribute('position').clone())
      baked.setAttribute('rockLocalNormal', baked.getAttribute('normal').clone())
      baked.applyMatrix4(rock.matrix)
      const batch = borderBatches.get(borderMaterial) ?? []
      batch.push(baked); borderBatches.set(borderMaterial, batch)
      geometry.dispose()
    }
  } else if (node.bank === 'stone' && node.rockBorder === 'clusters') {
    const clusters = [[.1, 4, 0], [.72, 4, 1], [1.55, 3, 0], [2.38, 5, 1], [3.03, 4, 1], [3.82, 3, 0], [4.57, 5, 0], [5.4, 4, 0]]
    for (const [angle, count, hero] of clusters) for (let i = 0; i < count!; i++) {
      const a = angle! + (i - (count! - 1) / 2) * .115 + (random() - .5) * .06
      const [x, z] = pointAt(a, .982 + (i % 2 ? -.024 : .021) + random() * .023)
      place(x, z, (hero && i === Math.floor(count! / 2) ? 2.15 : .6 + random() * .82) * scaleUnit)
    }
  }
  for (const [borderMaterial, geometries] of borderBatches) {
    const merged = mergeGeometries(geometries)!
    merged.computeBoundingBox(); merged.computeBoundingSphere()
    const batch = new Mesh(merged, borderMaterial)
    bindPondRockMaterial(batch, borderMaterial, [...paletteForBatches.keys()].find(index => paletteForBatches.get(index) === borderMaterial)!)
    batch.name = 'pond-rock-border-batch'; batch.userData.pondRockBorder = true
    batch.castShadow = true; batch.receiveShadow = true; group.add(batch)
    geometries.forEach(geometry => geometry.dispose())
  }
  for (let i = 0; i < 6; i++) {
    const [x, z] = pointAt(i / 6 * Math.PI * 2 + random() * .13, i % 2 ? .7 : .88)
    // Discard stones outside concave authored shorelines.
    if (field.radial(x, z) < 1) place(x, z, (i % 5 === 0 ? 1.7 + random() * .4 : .4 + random() * .6) * scaleUnit, true)
  }
  // The bed texture carries gravel detail. Only a sparse set needs geometry;
  // twenty triangles per pebble instead of a scanned 300-triangle mesh.
  const pebbleGeometry = new IcosahedronGeometry(.5, 0)
  pebbleGeometry.computeBoundingBox()
  const pebbleCount = Math.min(256, Math.max(48, Math.round(node.width * (node.shape === 'circle' ? node.width : node.depth) * 4)))
  const pebbles = new InstancedMesh(pebbleGeometry, pondRockMaterial(node, false), pebbleCount)
  bindPondRockMaterial(pebbles, pebbles.material as ReturnType<typeof pondRockMaterial>, -1)
  pebbles.name = 'pond-underwater-pebbles'; pebbles.receiveShadow = false
  const matrix = new Matrix4(), rotation = new Quaternion(), scale = new Vector3(), position = new Vector3()
  let count = 0
  for (let i = 0; i < pebbleCount; i++) {
    const [x, z] = pointAt(random() * Math.PI * 2, .66 + random() * .35)
    const y = field.height(x, z), size = (.025 + .14 * random() ** 2) * scaleUnit
    if (y >= node.elevation - node.waterDrop - size || field.radial(x, z) > 1) continue
    rotation.setFromEuler(new Euler(0, random() * Math.PI * 2, 0))
    scale.set(size, size * .8, size)
    position.set(x, y - pebbleGeometry.boundingBox!.min.y * size * .8 - size * .15, z)
    pebbles.setMatrixAt(count++, matrix.compose(position, rotation, scale))
  }
  pebbles.count = count; group.add(pebbles)
  group.traverse(object => {
    if (!(object instanceof Mesh) || !['pond-shore-rock', 'pond-shelf-rock'].includes(object.name)) return
    obstacles.push({ x: object.position.x, z: object.position.z, radius: object.scale.x * .35,
      top: object.position.y + object.geometry.boundingBox!.max.y * object.scale.y, kind: object.name })
  })
  // Cluster and shelf stones share one material but retain individual local UVs.
  for (const name of ['pond-shore-rock', 'pond-shelf-rock']) {
    const meshes = group.children.filter((object): object is Mesh => object instanceof Mesh && object.name === name)
    if (!meshes.length) continue
    const pieces = meshes.map(rock => {
      const baked = rock.geometry.index ? rock.geometry.toNonIndexed() : rock.geometry.clone()
      baked.setAttribute('rockLocalPosition', baked.getAttribute('position').clone())
      baked.setAttribute('rockLocalNormal', baked.getAttribute('normal').clone())
      rock.updateMatrix(); baked.applyMatrix4(rock.matrix)
      group.remove(rock)
      return baked
    })
    const merged = mergeGeometries(pieces)!
    merged.computeBoundingBox(); merged.computeBoundingSphere()
    const batch = new Mesh(merged, material)
    bindPondRockMaterial(batch, material, -1)
    batch.name = `${name}-batch`; batch.castShadow = name === 'pond-shore-rock'; batch.receiveShadow = name === 'pond-shore-rock'
    group.add(batch); pieces.forEach(piece => piece.dispose())
  }
  group.userData.pondRockObstacles = obstacles
  // Only retained geometry belongs to the group; dispose unused variants now.
  const used = new Set<BufferGeometry>()
  group.traverse(object => { if (object instanceof Mesh) used.add(object.geometry) })
  for (const geometry of [...scanned, ...rounded]) if (!used.has(geometry)) geometry.dispose()
  if (!group.children.some(object => object instanceof Mesh && object.material === material)) material.dispose()
}
