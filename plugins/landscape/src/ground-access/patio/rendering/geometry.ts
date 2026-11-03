import { landscapeToolColors } from '../../../shared/tool-colors'
import { freehandFloorplanHandles } from '../../../ground-areas/domain/curve-edit'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import { BoxGeometry, Euler, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  Quaternion, Vector3 } from 'three'
import type { MultiPolygon } from 'polygon-clipping'
import { pavingPolygons } from '../../../pathways/rendering/paving-polygons'
import { extrudePaving } from '../../../pathways/rendering/safe-extrusion'
import { patioOutline } from '../domain/outline'
import { isCurvedSurface } from '../../shared/outline'
import { PatioNode } from '../domain/schema'
import { poolCutoutsFor } from '../../../shared/pool-cutouts'
import { applyLandscapePaintedMaterials } from '../../shared/paint'

export const finishColor = { concrete: '#aeaca5', stone: '#b8aa93', brick: '#aa705a' } as const
export const patioFieldColor = (node: PatioNode) => node.fieldColor

type Tile = { x: number; z: number; w: number; d: number }
function borderSize(node: PatioNode) {
  return node.borderStyle === 'contrast'
    ? Math.min(node.borderWidth, node.width / 3, node.depth / 3) : 0
}

export function patioTiles(node: PatioNode): Tile[] {
  const border = borderSize(node)
  const fieldWidth = node.width - 2 * border
  const fieldDepth = node.depth - 2 * border
  const { jointWidth } = node
  const tileW = node.paverWidth
  const tileD = node.paverDepth
  const rows = Math.ceil(fieldDepth / tileD)
  const cols = Math.ceil(fieldWidth / tileW) + (node.pattern === 'running-bond' ? 1 : 0)
  const pieces: Tile[] = []
  const minX = -fieldWidth / 2
  const maxX = fieldWidth / 2
  const minZ = -fieldDepth / 2
  const maxZ = fieldDepth / 2
  for (let row = 0; row < rows; row++) {
    const z0 = minZ + row * tileD
    const z1 = Math.min(maxZ, z0 + tileD)
    const offset = node.pattern === 'running-bond' && row % 2 ? tileW / 2 : 0
    for (let col = -1; col < cols; col++) {
      const x0 = Math.max(minX, minX + col * tileW + offset)
      const x1 = Math.min(maxX, minX + (col + 1) * tileW + offset)
      if (x1 - x0 <= jointWidth * 1.5 || z1 - z0 <= jointWidth * 1.5) continue
      pieces.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2,
        w: x1 - x0 - jointWidth, d: z1 - z0 - jointWidth })
    }
  }
  return pieces
}

function slopeGradient(node: PatioNode): [number, number] {
  const slope = node.slopePercent / 100
  switch (node.drainDirection) {
    case 'front': return [0, slope]
    case 'back': return [0, -slope]
    case 'left': return [slope, 0]
    case 'right': return [-slope, 0]
  }
  return [0, 0]
}

function path(ring: readonly number[][]) {
  return ring.map(([x, z], index) => `${index ? 'L' : 'M'} ${x} ${z}`).join(' ') + ' Z'
}

function appendEditHandles(children: FloorplanGeometry[], node: PatioNode, ctx: GeometryContext) {
  if (ctx.viewState?.selected && node.shape === 'freehand') children.push(...freehandFloorplanHandles(node))
  if (!ctx.viewState?.selected || node.shape === 'freehand' || isCurvedSurface(node.shape)) return
  const outline = patioOutline(node)
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!, b = outline[(index + 1) % outline.length]!
    children.push({ kind: 'edge-handle', x1: a[0], y1: a[1], x2: b[0], y2: b[1],
      affordance: 'move-edge', payload: { edgeIndex: index } })
  }
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!, b = outline[(index + 1) % outline.length]!
    children.push({ kind: 'midpoint-handle', point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      affordance: 'add-vertex', payload: { edgeIndex: index } })
  }
  for (let index = 0; index < outline.length; index++) children.push({ kind: 'endpoint-handle',
    point: outline[index]!, state: 'idle', affordance: 'move-vertex', payload: { vertexIndex: index } })
}

function polygonMesh(polygon: MultiPolygon[number], depth: number, y: number,
  gradientX: number, gradientZ: number, material: MeshStandardMaterial, name: string) {
  const geometry = extrudePaving(polygon, { depth, bevelEnabled: false, curveSegments: 1 })
  if (!geometry) return null
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++)
    positions.setY(i, positions.getY(i) + y + gradientX * positions.getX(i) + gradientZ * positions.getZ(i))
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function buildShapedPatio(node: PatioNode, cutouts: MultiPolygon = []): Group {
  const group = new Group()
  const baseOutline: MultiPolygon = [[patioOutline(node)]]
  const outline = cutouts.length ? pavingPolygons.difference(baseOutline, ...cutouts) : baseOutline
  const [gx, gz] = slopeGradient(node)
  const baseMaterial = new MeshStandardMaterial({ color: '#746b60', roughness: 1 })
  for (const polygon of outline) {
    const mesh = polygonMesh(polygon, node.thickness, node.elevation, gx, gz, baseMaterial, 'patio-base')
    if (mesh) group.add(mesh)
  }
  const border = node.borderStyle === 'contrast' ? node.borderWidth : 0
  const inset = border ? pavingPolygons.inset(outline, border) : outline
  const field = inset.length ? inset : outline
  const paverHeight = Math.min(0.045, node.thickness / 3)
  const top = node.elevation + node.thickness
  const fieldMaterial = new MeshStandardMaterial({ color: patioFieldColor(node), roughness: 0.88 })
  const maxPieces = 2000
  const detailedPavers = (Math.ceil(node.width / node.paverWidth) + 2) *
    Math.ceil(node.depth / node.paverDepth) <= maxPieces
  const jointMaterial = new MeshStandardMaterial({ color: detailedPavers ? '#756c60' : patioFieldColor(node), roughness: 1 })
  for (const polygon of field) {
    const mesh = polygonMesh(polygon, 0.004, top, gx, gz, jointMaterial, 'patio-joints')
    if (mesh) group.add(mesh)
  }
  if (border && inset.length) {
    const borderMaterial = new MeshStandardMaterial({ color: node.borderColor, roughness: 0.9 })
    for (const polygon of pavingPolygons.difference(outline, inset)) {
      const mesh = polygonMesh(polygon, paverHeight, top, gx, gz, borderMaterial, 'patio-border')
      if (mesh) group.add(mesh)
    }
  }
  // Clip every paver to the actual boundary, including concave corners.
  const fieldWidth = node.width
  const fieldDepth = node.depth
  if (!detailedPavers) { fieldMaterial.dispose(); return group }
  let count = 0
  for (let row = 0; row < Math.ceil(fieldDepth / node.paverDepth) && count < maxPieces; row++) {
    const z0 = -fieldDepth / 2 + row * node.paverDepth + node.jointWidth / 2
    const z1 = Math.min(fieldDepth / 2, z0 + node.paverDepth - node.jointWidth)
    const offset = node.pattern === 'running-bond' && row % 2 ? node.paverWidth / 2 : 0
    for (let col = -1; col <= Math.ceil(fieldWidth / node.paverWidth) && count < maxPieces; col++) {
      const x0 = -fieldWidth / 2 + col * node.paverWidth + offset + node.jointWidth / 2
      const x1 = Math.min(fieldWidth / 2, x0 + node.paverWidth - node.jointWidth)
      if (x1 <= x0 || z1 <= z0) continue
      const clipped = pavingPolygons.intersection(field, [[[
        [x0, z0], [x1, z0], [x1, z1], [x0, z1],
      ]]])
      for (const polygon of clipped) {
        const mesh = polygonMesh(polygon, paverHeight, top, gx, gz, fieldMaterial, 'patio-paver')
        if (mesh) { group.add(mesh); count++ }
      }
    }
  }
  return group
}

export function buildPatioGeometry(raw: PatioNode, ctx?: GeometryContext): Group {
  // Saved starter patios predate the paving and drainage fields. The scene
  // renderer can pass those raw nodes here without reparsing their schema.
  const node = PatioNode.parse(raw)
  const cutouts = poolCutoutsFor(node as unknown as PatioNode & { id: string; type: string; parentId: string | null }, ctx)
  if (cutouts.length || isCurvedSurface(node.shape) || (node.shape !== 'rectangle' && node.outline.length >= 3)) {
    const group = buildShapedPatio(node, cutouts)
    applyLandscapePaintedMaterials(group, node.paintedMaterials, (mesh) =>
      mesh.name === 'patio-base' ? 'base' : mesh.name === 'patio-border' ? 'border'
        : mesh.name === 'patio-paver' ? 'surface' : null)
    return group
  }
  const group = new Group()
  const { width, depth, thickness, elevation } = node
  const [gradientX, gradientZ] = slopeGradient(node)
  const heightAt = (x: number, z: number) => gradientX * x + gradientZ * z
  const baseGeometry = new BoxGeometry(width, thickness, depth)
  const positions = baseGeometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++)
    positions.setY(i, positions.getY(i) + heightAt(positions.getX(i), positions.getZ(i)))
  positions.needsUpdate = true
  baseGeometry.computeVertexNormals()
  const base = new Mesh(baseGeometry,
    new MeshStandardMaterial({ color: '#746b60', roughness: 1 }))
  base.name = 'patio-base'
  base.userData.slotId = 'base'
  base.position.y = elevation + thickness / 2
  base.receiveShadow = true
  group.add(base)

  const paverHeight = Math.min(0.045, thickness / 3)
  const topY = elevation + thickness + paverHeight / 2
  const material = new MeshStandardMaterial({ color: patioFieldColor(node), roughness: 0.88 })
  const pieces = patioTiles(node)
  const rotation = new Quaternion().setFromEuler(new Euler(-Math.atan(gradientZ), 0, Math.atan(gradientX)))
  if (pieces.length) {
    const pavers = new InstancedMesh(new BoxGeometry(1, 1, 1), material, pieces.length)
    const matrix = new Matrix4()
    pieces.forEach((p, i) => {
      matrix.compose(new Vector3(p.x, topY + heightAt(p.x, p.z), p.z), rotation,
        new Vector3(p.w, paverHeight, p.d))
      pavers.setMatrixAt(i, matrix)
    })
    pavers.instanceMatrix.needsUpdate = true
    pavers.name = 'patio-pavers'
    pavers.userData.slotId = 'surface'
    pavers.castShadow = true
    pavers.receiveShadow = true
    group.add(pavers)
  } else material.dispose()

  const border = borderSize(node)
  if (border > 0) {
    const borderMaterial = new MeshStandardMaterial({ color: node.borderColor, roughness: 0.9 })
    const addBand = (name: string, w: number, d: number, x: number, z: number) => {
      const mesh = new Mesh(new BoxGeometry(w, paverHeight, d), borderMaterial)
      mesh.name = name
      mesh.userData.slotId = 'border'
      mesh.position.set(x, topY + heightAt(x, z), z)
      mesh.quaternion.copy(rotation)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
    const gap = Math.min(node.jointWidth, border / 4)
    addBand('patio-border-front', width - gap, border - gap, 0, -depth / 2 + border / 2)
    addBand('patio-border-back', width - gap, border - gap, 0, depth / 2 - border / 2)
    addBand('patio-border-left', border - gap, depth - 2 * border - gap, -width / 2 + border / 2, 0)
    addBand('patio-border-right', border - gap, depth - 2 * border - gap, width / 2 - border / 2, 0)
  }
  applyLandscapePaintedMaterials(group, node.paintedMaterials, (mesh) => mesh.userData.slotId ?? null)
  return group
}

export function buildPatioFloorplan(raw: PatioNode, ctx: GeometryContext): FloorplanGeometry {
  const node = PatioNode.parse(raw)
  if (isCurvedSurface(node.shape) || (node.shape !== 'rectangle' && node.outline.length >= 3)) {
    const outline: MultiPolygon = [[patioOutline(node)]]
    const border = node.borderStyle === 'contrast' ? node.borderWidth : 0
    const inset = border ? pavingPolygons.inset(outline, border) : outline
    const stroke = ctx.viewState?.selected ? (ctx.viewState.palette?.selectedStroke ?? landscapeToolColors.selected) : '#746b60'
    const children: FloorplanGeometry[] = [{ kind: 'path', d: path(outline[0]![0]!),
      fill: border && inset.length ? node.borderColor : patioFieldColor(node), stroke,
      strokeWidth: ctx.viewState?.selected ? 0.045 : 0.018 }]
    if (border && inset.length) for (const polygon of inset) children.push({ kind: 'path',
      d: polygon.map(path).join(' '), fillRule: 'evenodd', fill: patioFieldColor(node),
      stroke: '#746b60', strokeWidth: 0.008 })
    const estimated = (Math.ceil(node.width / node.paverWidth) + 2) * Math.ceil(node.depth / node.paverDepth)
    if (estimated <= 1500) {
      const tilePaths: string[] = []
      const field = inset.length ? inset : outline
      for (let row = 0; row < Math.ceil(node.depth / node.paverDepth); row++) {
        const z0 = -node.depth / 2 + row * node.paverDepth + node.jointWidth / 2
        const z1 = Math.min(node.depth / 2, z0 + node.paverDepth - node.jointWidth)
        const offset = node.pattern === 'running-bond' && row % 2 ? node.paverWidth / 2 : 0
        for (let col = -1; col <= Math.ceil(node.width / node.paverWidth); col++) {
          const x0 = -node.width / 2 + col * node.paverWidth + offset + node.jointWidth / 2
          const x1 = Math.min(node.width / 2, x0 + node.paverWidth - node.jointWidth)
          if (x1 <= x0 || z1 <= z0) continue
          for (const polygon of pavingPolygons.intersection(field, [[[
            [x0, z0], [x1, z0], [x1, z1], [x0, z1],
          ]]])) tilePaths.push(...polygon.map(path))
        }
      }
      if (tilePaths.length) children.push({ kind: 'path', d: tilePaths.join(' '),
        fill: 'none', stroke: '#756c60', strokeWidth: 0.005 })
    }
    appendEditHandles(children, node, ctx)
    return { kind: 'group', children,
      transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation[1] } }
  }
  const w = node.width / 2
  const d = node.depth / 2
  const stroke = ctx.viewState?.selected ? (ctx.viewState.palette?.selectedStroke ?? landscapeToolColors.selected) : '#746b60'
  const border = borderSize(node)
  const children: FloorplanGeometry[] = [{ kind: 'path',
    d: `M ${-w} ${-d} H ${w} V ${d} H ${-w} Z`, fill: border ? node.borderColor : patioFieldColor(node),
    stroke, strokeWidth: ctx.viewState?.selected ? 0.045 : 0.018 }]
  if (border) children.push({ kind: 'path',
    d: `M ${-w + border} ${-d + border} H ${w - border} V ${d - border} H ${-w + border} Z`,
    fill: patioFieldColor(node), stroke: '#746b60', strokeWidth: 0.008 })
  const tiles = patioTiles(node)
  if (tiles.length <= 1500) children.push({ kind: 'path',
    d: tiles.map(({ x, z, w: tileW, d: tileD }) =>
      `M ${x - tileW / 2} ${z - tileD / 2} h ${tileW} v ${tileD} h ${-tileW} Z`).join(' '),
    fill: 'none', stroke: '#756c60', strokeWidth: 0.005 })
  appendEditHandles(children, node, ctx)
  return { kind: 'group', children,
    transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation[1] } }
}
