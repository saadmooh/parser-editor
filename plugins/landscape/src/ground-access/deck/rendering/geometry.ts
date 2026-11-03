import { railFootprint } from './rail-joins'
import { landscapeToolColors } from '../../../shared/tool-colors'
import { freehandFloorplanHandles } from '../../../ground-areas/domain/curve-edit'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { createMaterial, resolveMaterialRef } from '@pascal-app/viewer'
import type { MultiPolygon, Polygon } from 'polygon-clipping'
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, type Material } from 'three'
import { pavingPolygons } from '../../../pathways/rendering/paving-polygons'
import { extrudePaving } from '../../../pathways/rendering/safe-extrusion'
import { isCurvedSurface, surfaceOutline } from '../../shared/outline'
import { deckBorderWidth } from '../domain/settings'
import { DeckNode } from '../domain/schema'
import { deckRailingOutline, deckRailingEdgeIndex } from '../domain/railing'
import { poolCutoutsFor } from '../../../shared/pool-cutouts'

type Point = [number, number]

function polygonMesh(group: Group, polygon: Polygon, depth: number, y: number,
  material: MeshStandardMaterial, name: string) {
  if (depth < 0.002) return
  const geometry = extrudePaving(polygon, { depth, bevelEnabled: false, curveSegments: 1 })
  if (!geometry) return
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, y, 0)
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function edgeMesh(group: Group, a: Point, b: Point, height: number, width: number,
  y: number, material: MeshStandardMaterial, name: string, trim = 0) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const length = Math.hypot(dx, dz) - trim * 2
  if (length < 0.01 || height < 0.01) return
  const mesh = new Mesh(new BoxGeometry(length, height, width), material)
  mesh.name = name
  mesh.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2)
  mesh.rotation.y = -Math.atan2(dz, dx)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function post(group: Group, p: Point, size: number, bottom: number, top: number,
  material: MeshStandardMaterial, name: string) {
  if (top - bottom < 0.02) return
  const mesh = new Mesh(new BoxGeometry(size, top - bottom, size), material)
  mesh.name = name
  mesh.position.set(p[0], (bottom + top) / 2, p[1])
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function ringSamples(ring: Point[], spacing: number): Point[] {
  if (ring.length < 2) return []
  const edges = ring.map((a, index) => {
    const b = ring[(index + 1) % ring.length]!
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) }
  })
  const perimeter = edges.reduce((total, edge) => total + edge.length, 0)
  if (perimeter < 0.001) return []
  const count = Math.max(1, Math.ceil(perimeter / spacing))
  const points: Point[] = []
  let edgeIndex = 0, start = 0
  for (let index = 0; index < count; index++) {
    const target = index * perimeter / count
    while (edgeIndex < edges.length - 1 && target > start + edges[edgeIndex]!.length) {
      start += edges[edgeIndex]!.length
      edgeIndex++
    }
    const edge = edges[edgeIndex]!
    const t = edge.length ? (target - start) / edge.length : 0
    points.push([edge.a[0] + (edge.b[0] - edge.a[0]) * t,
      edge.a[1] + (edge.b[1] - edge.a[1]) * t])
  }
  return points
}

function edgeSamples(a: Point, b: Point, spacing: number): Point[] {
  const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing))
  return Array.from({ length: count + 1 }, (_, index): Point => [
    a[0] + (b[0] - a[0]) * index / count,
    a[1] + (b[1] - a[1]) * index / count,
  ])
}

function boardAxes(node: DeckNode): { normal: Point; tangent: Point } {
  if (node.boardDirection === 'crosswise') return { normal: [0, 1], tangent: [1, 0] }
  if (node.boardDirection === 'diagonal') return {
    normal: [-Math.SQRT1_2, Math.SQRT1_2], tangent: [Math.SQRT1_2, Math.SQRT1_2],
  }
  return { normal: [1, 0], tangent: [0, 1] }
}

function stripPolygons(node: DeckNode, field: MultiPolygon, normal: Point, tangent: Point,
  width: number, gap: number, visit: (polygon: Polygon, index: number) => void) {
  const outline = surfaceOutline(node)
  const project = (axis: Point) => outline.map(([x, z]) => x * axis[0] + z * axis[1])
  const us = project(normal), vs = project(tangent)
  const pitch = width + gap
  const from = Math.floor(Math.min(...us) / pitch)
  const to = Math.ceil(Math.max(...us) / pitch)
  const v0 = Math.min(...vs) - 0.1, v1 = Math.max(...vs) + 0.1
  const point = (u: number, v: number): Point => [normal[0] * u + tangent[0] * v,
    normal[1] * u + tangent[1] * v]
  for (let index = from; index <= to; index++) {
    const u0 = index * pitch + gap / 2
    const u1 = u0 + width
    const strip: MultiPolygon = [[[point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1)]]]
    for (const polygon of pavingPolygons.intersection(field, strip)) visit(polygon, index)
  }
}

function boardPolygons(node: DeckNode, field: MultiPolygon,
  visit: (polygon: Polygon, index: number) => void) {
  const { normal, tangent } = boardAxes(node)
  stripPolygons(node, field, normal, tangent, node.boardWidth, node.boardGap, visit)
}

function deckSurfaceRegions(node: DeckNode, outer: MultiPolygon) {
  const borderWidth = deckBorderWidth(node)
  const borderInside = borderWidth ? pavingPolygons.inset(outer, borderWidth) : []
  if (!borderInside.length) return { field: outer, bands: [] as MultiPolygon[] }
  const fieldWithGap = pavingPolygons.inset(outer, borderWidth + node.boardGap)
  const field = fieldWithGap.length ? fieldWithGap : borderInside
  if (node.borderStyle === 'double') {
    const courseWidth = (borderWidth - node.boardGap) / 2
    const firstInside = pavingPolygons.inset(outer, courseWidth)
    const secondOutside = pavingPolygons.inset(outer, courseWidth + node.boardGap)
    if (firstInside.length && secondOutside.length) return { field, bands: [
      pavingPolygons.difference(outer, firstInside),
      pavingPolygons.difference(secondOutside, borderInside),
    ] }
  }
  return { field, bands: [pavingPolygons.difference(outer, borderInside)] }
}

function deckSupportPoints(node: DeckNode, outer: MultiPolygon, spacing: number) {
  const size = Math.min(node.postSize, node.width * 0.45, node.depth * 0.45)
  const inset = pavingPolygons.inset(outer, size / 2)
  const seen = new Set<string>()
  const points: Point[] = []
  for (const polygon of inset) {
    const ring = polygon[0]!.slice(0, -1) as Point[]
    const candidates = isCurvedSurface(node.shape) ? ringSamples(ring, spacing)
      : ring.flatMap((a, index) => edgeSamples(a, ring[(index + 1) % ring.length]!, spacing))
    for (const p of candidates) {
      const key = `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`
      if (seen.has(key)) continue
      seen.add(key)
      points.push(p)
    }
  }
  return { points, size }
}

function deckSurfaceRole(name: string): string | null {
  if (name === 'deck-board') return 'boards'
  if (name === 'deck-picture-frame') return 'border'
  if (name === 'deck-fascia') return 'fascia'
  if (name === 'deck-rim-frame' || name === 'deck-joist') return 'frame'
  if (name === 'deck-support-post') return 'supports'
  if (name === 'deck-support-base') return 'supports'
  if (name === 'deck-skirt' || name === 'deck-skirt-slat') return 'skirting'
  return null
}

function applyPaintedMaterials(node: DeckNode, group: Group) {
  const resolved = new Map<string, Material | null>()
  const replaced = new Set<Material>()
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const role = deckSurfaceRole(object.name)
    if (!role) return
    object.userData.slotId = role
    const painted = node.paintedMaterials[role]
    if (!painted) return
    if (!resolved.has(role)) resolved.set(role, painted.material
      ? createMaterial(painted.material, 'rendered')
      : painted.materialPreset
        ? resolveMaterialRef(painted.materialPreset, useScene.getState().materials, 'rendered')
        : null)
    const material = resolved.get(role)
    if (!material) return
    replaced.add(object.material as Material)
    object.material = material
  })
  for (const material of replaced) material.dispose()
}

function deckRailing(group: Group, node: DeckNode, outline: Point[]) {
  if (node.railingStyle === 'none') return
  const rail = new MeshStandardMaterial({ color: node.railingColor, roughness: 0.8 })
  const glass = new MeshStandardMaterial({ color: '#9fc3c9', transparent: true,
    opacity: 0.38, depthWrite: false, roughness: 0.2 })
  const top = node.thickness + node.railingHeight
  const selected = new Set(node.railingEdges)
  // Smooth freehand boundaries can contain hundreds of tiny edges.
  const step = outline.length > 160 && node.railingEdgeMode === 'all'
    ? Math.ceil(outline.length / 160) : 1
  const vertices = step === 1 ? outline : outline.filter((_, i) => i % step === 0)
  const enabled = vertices.map((a, edge) => node.railingEdgeMode !== 'selected' || selected.has(deckRailingEdgeIndex(node, a, vertices[(edge + 1) % vertices.length]!)))
  const seen = new Set<string>()
  vertices.forEach((a, edge) => {
    const b = vertices[(edge + 1) % vertices.length]!
    if (!enabled[edge]) return
    polygonMesh(group, [railFootprint(vertices, edge, 0.065, enabled)], 0.045, top - 0.045, rail, 'deck-top-rail')
    if (node.railingStyle === 'wood' || node.railingStyle === 'metal')
      polygonMesh(group, [railFootprint(vertices, edge, 0.05, enabled)], 0.035, node.thickness + 0.1 - 0.0175, rail, 'deck-bottom-rail')
    const posts = edgeSamples(a, b, node.railingPostSpacing)
    for (const p of posts) {
      const key = `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`
      if (seen.has(key)) continue
      seen.add(key)
      post(group, p, node.railingStyle === 'wood' ? 0.09 : 0.055,
        node.thickness, top, rail, 'deck-railing-post')
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const p = posts[i]!, q = posts[i + 1]!
      if (node.railingStyle === 'glass') {
        edgeMesh(group, p, q, node.railingHeight - 0.2, 0.012,
          node.thickness + node.railingHeight / 2, glass, 'deck-glass-panel', 0.07)
      } else if (node.railingStyle === 'cable') {
        for (let h = 0.16; h < node.railingHeight - 0.08; h += 0.13)
          edgeMesh(group, p, q, 0.008, 0.008, node.thickness + h, rail, 'deck-cable', 0.03)
      } else {
        const spacing = node.railingStyle === 'wood' ? 0.13 : 0.11
        for (const baluster of edgeSamples(p, q, spacing).slice(1, -1))
          post(group, baluster, node.railingStyle === 'wood' ? 0.045 : 0.02,
            node.thickness + 0.12, top - 0.04, rail, 'deck-baluster')
      }
    }
  })
}

export function buildDeckGeometry(raw: DeckNode, ctx?: GeometryContext): Group {
  const node = DeckNode.parse(raw)
  const group = new Group()
  const outline = surfaceOutline(node)
  const initial: MultiPolygon = [[outline]]
  const cutouts = poolCutoutsFor(node as unknown as DeckNode & { id: string; type: string; parentId: string | null }, ctx)
  const outer = cutouts.length ? pavingPolygons.difference(initial, ...cutouts) : initial
  const boardT = Math.min(node.boardThickness, node.thickness / 3)
  const frameTop = node.thickness - boardT
  const frameBottom = Math.max(0, frameTop - node.frameDepth)
  const rimInset = pavingPolygons.inset(outer, Math.max(0.045, node.postSize / 2))
  const fasciaInset = node.fascia ? pavingPolygons.inset(outer, 0.02) : outer
  const rimOuter = fasciaInset.length ? fasciaInset : outer
  const rim = rimInset.length ? pavingPolygons.difference(rimOuter, rimInset) : rimOuter
  const frame = new MeshStandardMaterial({ color: node.frameColor, roughness: 0.95 })
  for (const polygon of rim) polygonMesh(group, polygon, frameTop - frameBottom,
    frameBottom, frame, 'deck-rim-frame')
  const { normal, tangent } = boardAxes(node)
  if (rimInset.length)
    stripPolygons(node, rimInset, tangent, normal, 0.055, 0.395, (polygon) =>
      polygonMesh(group, polygon, frameTop - frameBottom, frameBottom, frame, 'deck-joist'))
  const { field, bands } = deckSurfaceRegions(node, outer)
  const natural = ['pressure-treated', 'cedar', 'hardwood'].includes(node.material)
  const toneCount = node.material === 'pvc' ? 1 : natural ? 4 : 2
  const boards = Array.from({ length: toneCount }, (_, index) => new MeshStandardMaterial({
    color: new Color(node.boardColor).offsetHSL(0, 0, natural ? (index - 1.5) * 0.018 : (index - 0.5) * 0.008),
    roughness: node.material === 'pvc' ? 0.55 : node.material === 'composite' ? 0.7 : 0.87,
  }))
  boardPolygons(node, field, (polygon, index) => polygonMesh(group, polygon, boardT,
    frameTop, boards[Math.abs(index) % boards.length]!, 'deck-board'))
  if (bands.length) {
    const border = new MeshStandardMaterial({ color: node.borderColor, roughness: 0.82 })
    for (const band of bands) for (const polygon of band)
      polygonMesh(group, polygon, boardT, frameTop, border, 'deck-picture-frame')
  }
  if (node.fascia) {
    const fascia = new MeshStandardMaterial({ color: node.fasciaColor, roughness: 0.9 })
    for (const polygon of fasciaInset.length ? pavingPolygons.difference(outer, fasciaInset) : outer)
      polygonMesh(group, polygon, frameTop - frameBottom, frameBottom, fascia, 'deck-fascia')
  }
  if (frameBottom > 0.015 && (node.deckType === 'platform' || node.supportPosts)) {
    const support = new MeshStandardMaterial({ color: node.postColor, roughness: 0.95 })
    const { points, size } = deckSupportPoints(node, outer, node.supportSpacing)
    for (const p of points)
      post(group, p, size, 0, frameBottom + 0.005, support, 'deck-support-post')
    if (!points.length) {
      const inset = pavingPolygons.inset(outer, 0.035)
      for (const polygon of inset.length ? inset : outer)
        polygonMesh(group, polygon, frameBottom + 0.005, 0, support, 'deck-support-base')
    }
  } else if (frameBottom > 0.015 && node.deckType === 'raised') {
    const support = new MeshStandardMaterial({ color: node.postColor, roughness: 0.95 })
    const inset = pavingPolygons.inset(outer, 0.035)
    for (const polygon of inset.length ? inset : outer)
      polygonMesh(group, polygon, frameBottom + 0.005, 0, support, 'deck-support-base')
  }
  if (node.skirtStyle !== 'none' && frameBottom > 0.08) {
    const skirt = new MeshStandardMaterial({ color: node.skirtColor, roughness: 0.9 })
    if (node.skirtStyle === 'solid') {
      const inset = pavingPolygons.inset(outer, 0.025)
      for (const polygon of inset.length ? pavingPolygons.difference(outer, inset) : outer)
        polygonMesh(group, polygon, frameBottom + 0.005, 0, skirt, 'deck-skirt')
    } else for (const p of ringSamples(outline, 0.12))
      post(group, p, 0.045, 0, frameBottom + 0.005, skirt, 'deck-skirt-slat')
  }
  deckRailing(group, node, deckRailingOutline(node))
  applyPaintedMaterials(node, group)
  return group
}

function path(polygon: Polygon) {
  return polygon.map((ring) => ring.map(([x, z], index) =>
    `${index ? 'L' : 'M'} ${x} ${z}`).join(' ') + ' Z').join(' ')
}

export function buildDeckFloorplan(raw: DeckNode, ctx: GeometryContext): FloorplanGeometry {
  const node = DeckNode.parse(raw)
  const outline = surfaceOutline(node)
  const outer: MultiPolygon = [[outline]]
  const { field, bands } = deckSurfaceRegions(node, outer)
  const stroke = ctx.viewState?.selected ? (ctx.viewState.palette?.selectedStroke ?? landscapeToolColors.selected) : '#66513f'
  const children: FloorplanGeometry[] = [{ kind: 'path', d: path(outer[0]!),
    fill: bands.length ? node.frameColor : node.boardColor,
    stroke, strokeWidth: ctx.viewState?.selected ? 0.045 : 0.018 }]
  if (bands.length) {
    for (const band of bands) for (const polygon of band)
      children.push({ kind: 'path', d: path(polygon), fillRule: 'evenodd',
        fill: node.borderColor })
    for (const polygon of field)
      children.push({ kind: 'path', d: path(polygon), fillRule: 'evenodd', fill: node.boardColor })
  }
  if ((node.width + node.depth) / (node.boardWidth + node.boardGap) <= 300) {
    const seams: string[] = []
    boardPolygons(node, field, (polygon) => seams.push(path(polygon)))
    if (seams.length) children.push({ kind: 'path', d: seams.join(' '),
      fill: 'none', stroke: node.frameColor, strokeWidth: 0.005 })
  }
  if (node.railingStyle !== 'none') {
    const selected = new Set(node.railingEdges)
    const railingOutline = deckRailingOutline(node)
    railingOutline.forEach((a, index) => {
      const b = railingOutline[(index + 1) % railingOutline.length]!
      if (node.railingEdgeMode === 'selected' && !selected.has(deckRailingEdgeIndex(node, a, b))) return
      children.push({ kind: 'path', d: `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`,
        fill: 'none', stroke: node.railingColor, strokeWidth: 0.03 })
    })
  }
  if (ctx.viewState?.selected && node.shape === 'freehand') children.push(...freehandFloorplanHandles(node))
  if (ctx.viewState?.selected && node.shape !== 'freehand' && !isCurvedSurface(node.shape)) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!, b = outline[(i + 1) % outline.length]!
      children.push({ kind: 'edge-handle', x1: a[0], y1: a[1], x2: b[0], y2: b[1],
        affordance: 'move-edge', payload: { edgeIndex: i } })
    }
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!, b = outline[(i + 1) % outline.length]!
      children.push({ kind: 'midpoint-handle', point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        affordance: 'add-vertex', payload: { edgeIndex: i } })
    }
    for (let i = 0; i < outline.length; i++) children.push({ kind: 'endpoint-handle',
      point: outline[i]!, state: 'idle', affordance: 'move-vertex', payload: { vertexIndex: i } })
  }
  return { kind: 'group', children,
    transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation[1] } }
}
