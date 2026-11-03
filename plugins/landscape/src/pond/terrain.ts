import { BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { surfaceOutline } from '../ground-access/shared/outline'
import type { PondNode } from './schema'

type Point = [number, number]
const smooth = (x: number, lo: number, hi: number) => {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/** The reference's fs(): a perturbed elliptical shoreline, not pool coping. */
export function shorelineRadius(angle: number) {
  return 1 + .05 * Math.sin(angle * 3 + .7) + .031 * Math.sin(angle * 5 - 1.1) + .02 * Math.cos(angle * 2 + .4)
}

export function pondOutline(node: PondNode): Point[] {
  if (node.shape !== 'oval') return surfaceOutline(node)
  return Array.from({ length: 128 }, (_, i): Point => {
    const a = i / 128 * Math.PI * 2, r = shorelineRadius(a)
    return [Math.cos(a) * node.width / 2 * r, Math.sin(a) * node.depth / 2 * r]
  })
}

export function pondTerrainBounds(node: PondNode) {
  const outline = pondOutline(node), padding = node.bankWidth * 2
  return { minX: Math.min(...outline.map(p => p[0])) - padding,
    maxX: Math.max(...outline.map(p => p[0])) + padding,
    minZ: Math.min(...outline.map(p => p[1])) - padding,
    maxZ: Math.max(...outline.map(p => p[1])) + padding }
}

export function createPondTerrainField(node: PondNode) {
  const outline = pondOutline(node), bounds = pondTerrainBounds(node)
  const radius = Math.min(node.width, node.shape === 'circle' ? node.width : node.depth) / 2
  const distance = (x: number, z: number) => {
    let inside = false, nearest = Infinity
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[j]!, b = outline[i]!, dx = b[0] - a[0], dz = b[1] - a[1]
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
      nearest = Math.min(nearest, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t))
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
    }
    return inside ? -nearest : nearest
  }
  const radial = (x: number, z: number) => {
    if (node.shape === 'oval' || node.shape === 'circle') {
      const nx = x / (node.width / 2), nz = z / ((node.shape === 'circle' ? node.width : node.depth) / 2)
      return Math.hypot(nx, nz) / (node.shape === 'oval' ? shorelineRadius(Math.atan2(nz, nx)) : 1)
    }
    return 1 + distance(x, z) / radius
  }
  const height = (x: number, z: number) => {
    const r = radial(x, z)
    // Jn()'s broad deep floor, smooth shelf and off-centre deeper pocket.
    if (r <= 1) {
      const sx = x / node.width * 18.2, sz = z / (node.shape === 'circle' ? node.width : node.depth) * 13.6
      const pocket = Math.exp(-(((sx - 1) / 5.3) ** 4) - ((sz + 2.8) / 3.5) ** 4)
      return node.elevation - node.basinDepth * (1 - smooth(r, .5, 1))
        + .006 * node.basinDepth * Math.sin(sx * .93 + sz * .27) * Math.cos(sz * .8) * (1 - r)
        - .12 * node.basinDepth * pocket * (1 - smooth(r, .64, .98))
    }
    const outside = node.shape === 'oval' || node.shape === 'circle' ? (r - 1) * radius : distance(x, z)
    const bank = node.thickness * smooth(outside, 0, node.bankWidth * .7)
    const rolling = bank * (.14 * Math.sin(x * .9 + z * .6) + .11 * Math.cos(z * 1.2 - x * .3))
    const edge = Math.min(x - bounds.minX, bounds.maxX - x, z - bounds.minZ, bounds.maxZ - z)
    return node.elevation + .018 + (bank + rolling - .018)
      * (1 - smooth(outside, node.bankWidth, node.bankWidth * 1.85)) * smooth(edge, 0, node.bankWidth * .65)
  }
  const blendAt = (x: number, z: number) => {
    const r = radial(x, z)
    const outside = node.shape === 'oval' || node.shape === 'circle' ? (r - 1) * radius : distance(x, z)
    const edge = Math.min(x - bounds.minX, bounds.maxX - x, z - bounds.minZ, bounds.maxZ - z)
    return (1 - smooth(outside, node.bankWidth * .75, node.bankWidth * 1.8)) * smooth(edge, 0, node.bankWidth * .65)
  }
  return { height, radial, outline, bounds, blendAt }
}

/** A single heightfield from the deep bed through the shelves to the dry bank. */
export function buildPondTerrain(node: PondNode, field = createPondTerrainField(node), options: { preview?: boolean; terrainAttributes?: boolean } = {}) {
  const b = field.bounds
  const width = b.maxX - b.minX, depth = b.maxZ - b.minZ
  // Surface normals come from the wave texture; dense tessellation adds little
  // detail. Keep enough cells for bank clipping and smooth terrain silhouettes.
  const min = options.preview ? 24 : 32, max = options.preview ? 64 : 128, spacing = options.preview ? .22 : .15
  const nx = Math.max(min, Math.min(max, Math.ceil(width / spacing)))
  const nz = Math.max(min, Math.min(max, Math.ceil(depth / spacing)))
  const terrain = new PlaneGeometry(width, depth, nx, nz)
  terrain.rotateX(-Math.PI / 2); terrain.translate((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2)
  const p = terrain.attributes.position!, uv = terrain.attributes.uv!, blend: number[] = []
  for (let i = 0; i < p.count; i++) {
    p.setY(i, field.height(p.getX(i), p.getZ(i)))
    if (options.terrainAttributes !== false) {
      uv.setXY(i, p.getX(i) * .34, p.getZ(i) * .34)
      blend.push(field.blendAt(p.getX(i), p.getZ(i)))
    }
  }
  if (options.terrainAttributes !== false) {
    terrain.setAttribute('pondBlend', new Float32BufferAttribute(blend, 1))
    terrain.computeVertexNormals()
  }
  // Intersect each terrain triangle with the water plane. Shallows stay exposed;
  // no water sheet covers the dry banks, including concave custom outlines.
  const waterY = node.elevation - node.waterDrop, waterPositions: number[] = []
  const indices = terrain.index!
  for (let i = 0; i < indices.count; i += 3) {
    const triangle = [0, 1, 2].map(k => { const j = indices.getX(i + k); return [p.getX(j), p.getY(j), p.getZ(j)] as [number, number, number] })
    const clipped: [number, number, number][] = []
    for (let k = 0; k < 3; k++) {
      const a = triangle[k]!, c = triangle[(k + 1) % 3]!
      if (a[1] <= waterY) clipped.push([a[0], 0, a[2]])
      if ((a[1] <= waterY) !== (c[1] <= waterY)) {
        // Solve against the actual curved bed rather than a coarse cell's
        // linear height interpolation. Bias inward by 3 mm to avoid dry lips.
        let low = 0, high = 1
        const aWet = a[1] <= waterY
        for (let iteration = 0; iteration < 12; iteration++) {
          const middle = (low + high) / 2
          const wet = field.height(a[0] + (c[0]-a[0])*middle,a[2] + (c[2]-a[2])*middle) <= waterY - .003
          if (wet === aWet) low = middle
          else high = middle
        }
        const t = aWet ? low : high
        clipped.push([a[0] + (c[0] - a[0]) * t, 0, a[2] + (c[2] - a[2]) * t])
      }
    }
    for (let k = 1; k < clipped.length - 1; k++) waterPositions.push(...clipped[0]!, ...clipped[k]!, ...clipped[k + 1]!)
  }
  const water = new BufferGeometry()
  water.setAttribute('position', new Float32BufferAttribute(waterPositions, 3)); water.computeVertexNormals()
  const indexedWater = mergeVertices(water, 1e-6)
  water.dispose()
  const wp=indexedWater.getAttribute('position'), waterUV=new Float32Array(wp.count*2)
  for(let i=0;i<wp.count;i++) {waterUV[i*2]=(wp.getX(i)-b.minX)/width;waterUV[i*2+1]=(wp.getZ(i)-b.minZ)/depth}
  indexedWater.setAttribute('uv',new Float32BufferAttribute(waterUV,2))
  return { terrain, water: indexedWater, field }
}

/** Integrates the shaped basin, rather than assuming a flat rectangular tank. */
export function pondCapacity(node: PondNode) {
  const field = createPondTerrainField(node), b = field.bounds, samples = 96
  const dx = (b.maxX - b.minX) / samples, dz = (b.maxZ - b.minZ) / samples
  let volume = 0, area = 0
  for (let row = 0; row < samples; row++) for (let col = 0; col < samples; col++) {
    const depth = node.elevation - node.waterDrop - field.height(b.minX + (col + .5) * dx, b.minZ + (row + .5) * dz)
    if (depth > 0) { volume += depth * dx * dz; area += dx * dz }
  }
  return { volume, area }
}
