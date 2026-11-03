import { landscapeToolColors } from '../../shared/tool-colors'
import { freehandFloorplanHandles } from '../domain/curve-edit'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import { heightAt, persistedTerrainFieldOf, sceneRegistry } from '@pascal-app/core'
import { pondSiteDesign, pondSiteFrame } from '../../pond/site-terrain'
import { PondNode } from '../../pond/schema'
import { createPondTerrainField } from '../../pond/terrain'
import polygonClipping from 'polygon-clipping'
import { Box3, DoubleSide, Group, Matrix4, Mesh, MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector2 } from 'three'
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js'
import type { Texture } from 'three'
import type { GroundAreaNode, GroundSurface } from '../domain/schema'
import { grassTexture, makeGrassBlades } from './grass'
import { grass2GroundTexture } from './grass2-ground'
import { makeGrass2, makeStreamedGrass2 } from './grass2'
import { Grass2Stream } from './grass2-stream'
import { grassEdgeSampler } from './grass2-edge'
import { grassContainsPoint, visibleGrassFootprint } from './footprint'
import { gravelTexture } from './gravel'
import { getMudTexture } from './mud'
import { makeMulchChips, mulchTexture } from './mulch'
import { sandTexture } from './sand'
import { makeSoilClods, soilTexture } from './soil'
import { subtractPoolCutouts } from '../../shared/pool-cutouts'
import { applyLandscapePaintedMaterials } from '../../ground-access/shared/paint'

const SURFACE_STYLE: Record<GroundSurface, { color: string; roughness: number }> = {
  grass: { color: '#718451', roughness: 0.98 },
  grass2: { color: '#47652d', roughness: 0.98 },
  soil: { color: '#5b5841', roughness: 1 },
  mulch: { color: '#76523b', roughness: 1 },
  gravel: { color: '#918f83', roughness: 0.96 },
  sand: { color: '#cbb78d', roughness: 1 },
  mud: { color: '#614533', roughness: 0.88 },
}

const SURFACE_TEXTURE: Record<Exclude<GroundSurface, 'mud'>, Texture> = {
  grass: grassTexture,
  grass2: grass2GroundTexture(),
  soil: soilTexture,
  mulch: mulchTexture,
  gravel: gravelTexture,
  sand: sandTexture,
}

// Match the meadow atlas roots separately from the geometric blade roots.
// Share these textures across areas and keep their detail at a fixed world scale.
const grass2BillboardGround = grass2GroundTexture('billboards')

export function groundSurfaceTexture(surface: GroundSurface) {
  return surface === 'mud' ? getMudTexture() : SURFACE_TEXTURE[surface]
}

export function groundSurfaceColor(surface: GroundSurface) {
  return SURFACE_STYLE[surface].color
}

function buildGroundAreaSurface(node: GroundAreaNode, includeDetails: boolean, ctx?: GeometryContext, streamGrass = false): Group {
  const group = new Group()
  if (node.outline.length < 3) return group
  const original = [[node.outline]] as import('polygon-clipping').MultiPolygon
  const footprint = subtractPoolCutouts(
    (node.surface === 'grass' || node.surface === 'grass2') && includeDetails ? visibleGrassFootprint(node, ctx) : original,
    node as unknown as import('../../shared/pool-cutouts').PoolCutoutSurface,
    ctx,
  )
  if (!footprint.length) return group
  const material = new MeshStandardMaterial({
    color: '#ffffff',
    map: node.surface === 'mud' ? getMudTexture()
      : node.surface === 'grass2' && node.grass2Settings?.mode === 'billboards'
        ? grass2BillboardGround : SURFACE_TEXTURE[node.surface],
    roughness: SURFACE_STYLE[node.surface].roughness,
    side: DoubleSide,
  })
  const siteFrame = pondSiteFrame({ parentId: node.parentId, position: [0, 0, 0], rotation: [0, 0, 0] }, ctx?.sceneNodes)
  const terrain = siteFrame && persistedTerrainFieldOf(siteFrame.site)
  const groundHeightAt = (x: number, z: number) => {
    if (!terrain || !siteFrame) return node.elevation + (ctx?.levelBaseAt?.(x, z) ?? 0)
    const c = Math.cos(siteFrame.yaw), s = Math.sin(siteFrame.yaw)
    const wx = siteFrame.x + x * c + z * s, wz = siteFrame.z + z * c - x * s
    let bankBlend = 0
    for (const { frame, field } of ponds) {
      const dx = wx - frame.x, dz = wz - frame.z, pc = Math.cos(frame.yaw), ps = Math.sin(frame.yaw)
      bankBlend = Math.max(bankBlend, field.blendAt(dx * pc - dz * ps, dz * pc + dx * ps))
    }
    return node.elevation * (1 - bankBlend) + heightAt(terrain, wx, wz) - siteFrame.y
  }
  const ponds = terrain && siteFrame ? Object.values(ctx?.sceneNodes ?? {}).flatMap(raw => {
    if ((raw.type as string) !== 'landscape:pond' || raw.visible === false) return []
    const parsed = PondNode.safeParse(raw)
    if (!parsed.success) return []
    const { node: pond, frame } = pondSiteDesign(parsed.data, ctx?.sceneNodes)
    const field = createPondTerrainField(pond)
    return frame?.site.id === siteFrame.site.id ? [{ pond, frame, field, bounds: field.bounds }] : []
  }) : []
  const dryGround = (x: number, z: number) => {
    if (!siteFrame) return true
    const c = Math.cos(siteFrame.yaw), s = Math.sin(siteFrame.yaw)
    const wx = siteFrame.x + x * c + z * s, wz = siteFrame.z + z * c - x * s
    for (const { pond, frame, bounds } of ponds) {
      const dx = wx - frame.x, dz = wz - frame.z, pc = Math.cos(frame.yaw), ps = Math.sin(frame.yaw)
      const px = dx * pc - dz * ps, pz = dz * pc + dx * ps
      if (px < bounds.minX || px > bounds.maxX || pz < bounds.minZ || pz > bounds.maxZ) continue
      if (groundHeightAt(x, z) + siteFrame.y < pond.elevation + frame.y - pond.waterDrop + .03) return false
    }
    return true
  }
  const groundBounds = new Box3()
  for (const polygon of footprint) {
    const outer = polygon[0]
    if (!outer || outer.length < 3) continue
    const shape = new Shape(outer.map(([x, z]) => new Vector2(x, -z)))
    shape.holes = polygon.slice(1).map((ring) => new Path(ring.map(([x, z]) => new Vector2(x, -z))))
    let geometry = new ShapeGeometry(shape)
    geometry.rotateX(-Math.PI / 2)
    if (terrain || (node.surface === 'grass2' && ctx?.levelBaseAt)) {
      geometry.computeBoundingBox()
      const bounds = geometry.boundingBox!
      let low = Infinity, high = -Infinity
      for (let row = 0; row <= 6; row++) for (let col = 0; col <= 6; col++) {
        const x = bounds.min.x + (bounds.max.x - bounds.min.x) * col / 6
        const z = bounds.min.z + (bounds.max.z - bounds.min.z) * row / 6
        const y = groundHeightAt(x, z)
        low = Math.min(low, y)
        high = Math.max(high, y)
      }
      // Coarse probes can miss a small basin between samples. A pond always
      // needs sufficient vertices for the ground layer to follow its banks.
      if (high - low > 0.005 || ponds.length > 0) {
        const area = (bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z)
        const edgeLength = terrain ? Math.max(terrain.spacing, Math.sqrt(area / 30000)) : Math.max(0.5, Math.sqrt(area / 4000))
        const refined = new TessellateModifier(edgeLength, 12).modify(geometry)
        geometry.dispose()
        geometry = refined
      }
      const positions = geometry.getAttribute('position')
      for (let index = 0; index < positions.count; index++)
        positions.setY(index, groundHeightAt(positions.getX(index), positions.getZ(index)) + 0.018)
      positions.needsUpdate = true
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    } else {
      geometry.translate(0, node.elevation + 0.018, 0)
    }
    geometry.computeVertexNormals()
    if (node.surface === 'grass2') {
      geometry.computeBoundingBox()
      groundBounds.union(geometry.boundingBox!)
    }
    const mesh = new Mesh(geometry, material)
    mesh.name = `ground-area-${node.surface}`
    mesh.userData.slotId = 'surface'
    mesh.receiveShadow = true
    mesh.castShadow = false
    group.add(mesh)
  }
  if (node.surface === 'grass' && includeDetails) {
    const blades = makeGrassBlades(node.outline, node.elevation, (x, z) => grassContainsPoint(footprint, x, z) && dryGround(x, z))
    if (blades) {
      if (terrain) {
        const matrix = new Matrix4()
        for (let index = 0; index < blades.count; index++) {
          blades.getMatrixAt(index, matrix)
          matrix.elements[13] = groundHeightAt(matrix.elements[12]!, matrix.elements[14]!) + .007
          blades.setMatrixAt(index, matrix)
        }
        blades.instanceMatrix.needsUpdate = true; blades.computeBoundingSphere()
      }
      group.add(blades)
    }
  }
  if (node.surface === 'grass2' && includeDetails) {
    const contains = (x: number, z: number) => grassContainsPoint(footprint, x, z) && dryGround(x, z)
    const edgeAt = grassEdgeSampler(footprint)
    const previous = streamGrass && ctx
      ? sceneRegistry.nodes.get(node.id)?.getObjectByName('ground-area-grass2-stream') : undefined
    // Include the edge blend's neighbourhood when deciding if a tile is reusable.
    const tileSignature = (x: number, z: number) => {
      const minX = x * 8 - 0.5, minZ = z * 8 - 0.5, maxX = (x + 1) * 8 + 0.5, maxZ = (z + 1) * 8 + 0.5
      const heights = terrain ? Array.from({ length: 81 }, (_, index) => groundHeightAt(minX + (index % 9), minZ + Math.floor(index / 9))) : []
      return JSON.stringify([polygonClipping.intersection(footprint,
        [[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]]]), heights])
    }
    group.add(streamGrass
      ? makeStreamedGrass2(node.outline, contains, node.grass2Settings, groundHeightAt, groundBounds,
        { previous: previous instanceof Grass2Stream ? previous : undefined, tileSignature, edgeAt })
      : makeGrass2(node.outline, node.elevation, contains, node.grass2Settings, groundHeightAt, edgeAt))
  }
  const hasPoolCutout = footprint.length !== 1 || footprint[0]?.length !== 1
  if (node.surface === 'soil' && includeDetails && !hasPoolCutout && !terrain) {
    const clods = makeSoilClods(node.outline, node.elevation)
    if (clods) group.add(clods)
  }
  if (node.surface === 'mulch' && includeDetails && !hasPoolCutout && !terrain) {
    const chips = makeMulchChips(node.outline, node.elevation)
    if (chips) group.add(chips)
  }
  if (includeDetails) applyLandscapePaintedMaterials(group, node.paintedMaterials, (mesh) =>
    mesh.userData.slotId === 'surface' ? 'surface' : null)
  return group
}

export function buildGroundAreaGeometry(node: GroundAreaNode, ctx?: GeometryContext): Group {
  return buildGroundAreaSurface(node, true, ctx)
}

export function buildGroundAreaLiveGeometry(node: GroundAreaNode, ctx?: GeometryContext): Group {
  return buildGroundAreaSurface(node, true, ctx, true)
}

export function buildGroundAreaPreviewGeometry(node: GroundAreaNode): Group {
  return buildGroundAreaSurface(node, false)
}

export function buildGroundAreaFloorplan(
  node: GroundAreaNode,
  ctx: GeometryContext,
): FloorplanGeometry {
  if (node.outline.length < 3) return { kind: 'group', children: [] }
  const selected = ctx.viewState?.selected || ctx.viewState?.highlighted
  const footprint = subtractPoolCutouts(
    node.surface === 'grass' || node.surface === 'grass2' ? visibleGrassFootprint(node, ctx) : [[node.outline]],
    node as unknown as import('../../shared/pool-cutouts').PoolCutoutSurface,
    ctx,
  )
  if (!footprint.length) return { kind: 'group', children: [] }
  const d = footprint.flatMap((polygon) => polygon.map((ring) =>
    ring.map(([x, z], index) => `${index ? 'L' : 'M'}${x} ${z}`).join(' ') + ' Z')).join(' ')
  const shape: FloorplanGeometry = {
    kind: 'path',
    d,
    fillRule: 'evenodd',
    fill: groundSurfaceColor(node.surface),
    stroke: selected ? (ctx.viewState?.palette?.selectedStroke ?? landscapeToolColors.selected) : '#64714c',
    strokeWidth: selected ? 0.045 : 0.018,
    opacity: 0.9,
  }
  if (ctx.viewState?.selected && node.shape === 'freehand') return { kind: 'group', children: [shape, ...freehandFloorplanHandles(node)] }
  if (!ctx.viewState?.selected || node.shape === 'circle' || node.shape === 'oval') return shape
  const outline = node.outline
  const handles: FloorplanGeometry[] = []
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!, b = outline[(index + 1) % outline.length]!
    handles.push({ kind: 'edge-handle', x1: a[0], y1: a[1], x2: b[0], y2: b[1],
      affordance: 'move-edge', payload: { edgeIndex: index } })
  }
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!, b = outline[(index + 1) % outline.length]!
    handles.push({ kind: 'midpoint-handle', point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      affordance: 'add-vertex', payload: { edgeIndex: index } })
  }
  for (let index = 0; index < outline.length; index++) handles.push({ kind: 'endpoint-handle',
    point: outline[index]!, state: 'idle', affordance: 'move-vertex', payload: { vertexIndex: index } })
  return { kind: 'group', children: [shape, ...handles] }
}

export function disposeGroundAreaGeometry(group: Group) {
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.dispose()
  })
}
