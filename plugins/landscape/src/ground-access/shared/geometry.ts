import { landscapeToolColors } from '../../shared/tool-colors'
import { freehandFloorplanHandles, type CurveNode } from '../../ground-areas/domain/curve-edit'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import type { MultiPolygon } from 'polygon-clipping'
import { pavingPolygons } from '../../pathways/rendering/paving-polygons'
import { extrudePaving } from '../../pathways/rendering/safe-extrusion'
import { poolCutoutsFor } from '../../shared/pool-cutouts'
import { isCurvedSurface, surfaceOutline, type DrawnSurface } from './outline'
import type { AccessShape } from './schema'

export type AccessKind = 'patio' | 'deck' | 'concrete-slab' | 'landing' | 'edging' | 'retaining-wall'

type EdgingOptions = {
  material?: 'stone' | 'brick' | 'concrete' | 'metal' | 'timber' | 'plastic' | 'gravel' | 'living'
  profile?: 'flush' | 'low' | 'raised' | 'mowing-strip'
  layout?: 'continuous' | 'blocks' | 'soldier-course' | 'stones' | 'woven'
  color?: string
  unitLength?: number
  jointWidth?: number
  irregularity?: number
}

const colors: Record<AccessKind, string> = {
  patio: '#b8aa93', deck: '#a4774e', 'concrete-slab': '#aaa9a2',
  landing: '#b9ab96', edging: '#918575', 'retaining-wall': '#9d9387',
}

function box(group: Group, material: MeshStandardMaterial, name: string,
  width: number, height: number, depth: number, x = 0, y = height / 2, z = 0) {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
  mesh.name = name
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function isShaped(node: AccessShape): node is DrawnSurface {
  return isCurvedSurface(node.shape) ||
    (node.shape !== 'rectangle' && node.shape !== undefined && (node.outline?.length ?? 0) >= 3)
}

function extruded(group: Group, polygon: MultiPolygon[number], depth: number, y: number,
  material: MeshStandardMaterial, name: string) {
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

function shapedAccessGeometry(node: DrawnSurface, kind: AccessKind, sourceRegions?: MultiPolygon): Group {
  const group = new Group()
  const outline: MultiPolygon = sourceRegions ?? [[surfaceOutline(node)]]
  const slab = kind === 'concrete-slab' ? node as DrawnSurface & {
    finish?: 'broom' | 'exposed-aggregate' | 'polished'; edgeProfile?: 'square' | 'chamfered'
  } : null
  const material = new MeshStandardMaterial({
    color: slab?.finish === 'exposed-aggregate' ? '#aaa69c' : slab?.finish === 'polished' ? '#b8b7b1'
      : kind === 'deck' ? '#825c3d' : colors[kind],
    roughness: slab?.finish === 'polished' ? 0.38 : slab?.finish === 'exposed-aggregate' ? 0.98 : 0.88,
  })
  const boardHeight = kind === 'deck' ? Math.min(0.035, node.thickness / 3) : 0
  const slabExtrudeOptions = slab?.edgeProfile === 'chamfered'
    ? { bevelEnabled: true, bevelSegments: 1, bevelThickness: 0.012, bevelSize: 0.012 }
    : { bevelEnabled: false }
  for (const polygon of outline) {
    if (slab) {
      const bevel = slab.edgeProfile === 'chamfered' ? 0.012 : 0
      const bevelRegions = bevel ? pavingPolygons.inset([polygon], bevel) : [polygon]
      for (const bevelRegion of bevelRegions) {
        const geometry = extrudePaving(bevelRegion, { depth: Math.max(0.03, node.thickness - bevel * 2),
          steps: 1, curveSegments: 1, ...slabExtrudeOptions })
        if (geometry) {
          geometry.rotateX(-Math.PI / 2)
          if (bevel) geometry.translate(0, bevel, 0)
          const mesh = new Mesh(geometry, material)
          mesh.name = 'concrete-slab-surface'
          mesh.castShadow = true
          mesh.receiveShadow = true
          group.add(mesh)
        }
      }
    } else extruded(group, polygon, node.thickness - boardHeight, 0, material, `${kind}-surface`)
  }
  if (slab && (node as DrawnSurface & { jointLayout?: 'none' | 'grid'; jointSpacing?: number; jointWidth?: number }).jointLayout !== 'none') {
    const settings = node as DrawnSurface & { jointSpacing?: number; jointWidth?: number }
    const spacing = settings.jointSpacing ?? 3
    const jointWidth = settings.jointWidth ?? 0.006
    const joint = new MeshStandardMaterial({ color: '#77756f', roughness: 0.95 })
    const halfX = node.width / 2, halfZ = node.depth / 2
    const surfaceHeight = node.thickness
    const addJoint = (polygon: MultiPolygon[number], name: string) =>
      extruded(group, polygon, 0.003, surfaceHeight - 0.002, joint, name)
    for (let x = -halfX + spacing; x < halfX - 0.01; x += spacing) {
      const stripe: MultiPolygon = [[[[x - jointWidth / 2, -halfZ], [x + jointWidth / 2, -halfZ],
        [x + jointWidth / 2, halfZ], [x - jointWidth / 2, halfZ]]]]
      for (const polygon of pavingPolygons.intersection(outline, stripe)) addJoint(polygon, `concrete-joint-x-${x.toFixed(2)}`)
    }
    for (let z = -halfZ + spacing; z < halfZ - 0.01; z += spacing) {
      const stripe: MultiPolygon = [[[[ -halfX, z - jointWidth / 2], [halfX, z - jointWidth / 2],
        [halfX, z + jointWidth / 2], [-halfX, z + jointWidth / 2]]]]
      for (const polygon of pavingPolygons.intersection(outline, stripe)) addJoint(polygon, `concrete-joint-z-${z.toFixed(2)}`)
    }
  }
  if (kind === 'deck') {
    const boardMaterial = new MeshStandardMaterial({ color: colors.deck, roughness: 0.85 })
    const pitch = 0.16
    for (let index = 0; index < Math.ceil(node.width / pitch); index++) {
      const x0 = -node.width / 2 + index * pitch + 0.004
      const x1 = Math.min(node.width / 2, x0 + pitch - 0.008)
      if (x1 <= x0) continue
      for (const polygon of pavingPolygons.intersection(outline, [[[
        [x0, -node.depth / 2], [x1, -node.depth / 2],
        [x1, node.depth / 2], [x0, node.depth / 2],
      ]]])) extruded(group, polygon, boardHeight, node.thickness - boardHeight, boardMaterial, `deck-board-${index}`)
    }
  }
  return group
}

export function buildAccessGeometry(node: AccessShape, kind: AccessKind, ctx?: GeometryContext): Group {
  const cutouts = poolCutoutsFor(node as AccessShape & { id: string; type: string; parentId: string | null }, ctx)
  if (cutouts.length) {
    const outline = isShaped(node) ? surfaceOutline(node) : [
      [-node.width / 2, -node.depth / 2], [node.width / 2, -node.depth / 2],
      [node.width / 2, node.depth / 2], [-node.width / 2, node.depth / 2],
    ]
    const regions = pavingPolygons.difference([[outline as [number, number][]]], ...cutouts)
    if (kind === 'concrete-slab') return shapedAccessGeometry(node as DrawnSurface, kind, regions)
    const group = new Group()
    const material = new MeshStandardMaterial({ color: colors[kind], roughness: 0.9 })
    for (const polygon of regions) extruded(group, polygon, node.thickness, 0, material, `${kind}-surface`)
    return group
  }
  if (kind === 'concrete-slab') return shapedAccessGeometry(node as DrawnSurface, kind)
  if (isShaped(node) && ['deck', 'concrete-slab', 'landing'].includes(kind))
    return shapedAccessGeometry(node, kind)
  const group = new Group()
  const material = new MeshStandardMaterial({ color: colors[kind], roughness: 0.9 })
  const { width, depth, thickness } = node
  if (kind === 'edging') {
    const edging = node as AccessShape & EdgingOptions
    const materialColors: Record<NonNullable<EdgingOptions['material']>, string> = {
      stone: '#918575', brick: '#a66e59', concrete: '#aaa9a2', metal: '#687078',
      timber: '#8b6243', plastic: '#4c5148', gravel: '#b2a58e', living: '#56764b',
    }
    const edgeMaterial = new MeshStandardMaterial({
      color: edging.color ?? materialColors[edging.material ?? 'stone'],
      roughness: edging.material === 'metal' ? 0.42 : 0.9,
      metalness: edging.material === 'metal' ? 0.65 : 0,
    })
    material.dispose()
    const profile = edging.profile ?? 'low'
    const height = profile === 'flush' ? Math.min(thickness, 0.035)
      : profile === 'mowing-strip' ? Math.max(thickness, 0.08) : thickness
    const pitch = Math.max(0.05, edging.unitLength ?? 0.3)
    const layout = edging.layout ?? 'blocks'
    if (layout === 'continuous' || edging.material === 'metal' || edging.material === 'plastic' || edging.material === 'living') {
      box(group, edgeMaterial, 'edging-continuous', width, height, depth)
    } else {
      const count = Math.max(1, Math.ceil(width / pitch))
      const unitWidth = width / count
      const gap = Math.min(edging.jointWidth ?? 0.012, unitWidth * 0.35)
      for (let index = 0; index < count; index++) {
        const factor = layout === 'stones' ? 0.86 + 0.14 * Math.sin((index + 1) * 17.3) * (edging.irregularity ?? 0.2) : 1
        const pieceHeight = layout === 'soldier-course' ? Math.max(height, depth * 0.85) : height
        box(group, edgeMaterial, `edging-unit-${index + 1}`,
          Math.max(0.03, (unitWidth - gap) * factor), pieceHeight,
          profile === 'mowing-strip' ? Math.max(depth, 0.3) : depth,
          -width / 2 + unitWidth * (index + 0.5), pieceHeight / 2)
      }
    }
  } else if (kind === 'deck') {
    // Raised boards and joists make the starter deck distinct from a solid slab.
    box(group, material, 'deck-frame-front', width, 0.12, 0.1, 0, thickness - 0.06, -depth / 2 + 0.05)
    box(group, material, 'deck-frame-back', width, 0.12, 0.1, 0, thickness - 0.06, depth / 2 - 0.05)
    const count = Math.max(1, Math.ceil(width / 0.16))
    const boardWidth = width / count
    for (let i = 0; i < count; i++)
      box(group, material, `deck-board-${i}`, Math.max(0.02, boardWidth - 0.008), 0.035, depth,
        -width / 2 + boardWidth * (i + 0.5), thickness - 0.0175)
  } else if (kind === 'patio') {
    const cols = Math.max(1, Math.ceil(width / 0.8))
    const rows = Math.max(1, Math.ceil(depth / 0.8))
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++)
      box(group, material, `patio-paver-${x}-${z}`, width / cols - 0.012, thickness, depth / rows - 0.012,
        -width / 2 + width * (x + 0.5) / cols, thickness / 2,
        -depth / 2 + depth * (z + 0.5) / rows)
  } else {
    box(group, material, kind, width, thickness, depth)
  }
  return group
}

export function buildAccessFloorplan(node: AccessShape, kind: AccessKind, ctx: GeometryContext): FloorplanGeometry {
  const { width, depth } = node
  const outline = isShaped(node) ? surfaceOutline(node) : [
    [-width / 2, -depth / 2], [width / 2, -depth / 2],
    [width / 2, depth / 2], [-width / 2, depth / 2],
  ]
  const children: FloorplanGeometry[] = [{
    kind: 'path',
    d: poolCutoutsFor(node as AccessShape & { id: string; type: string; parentId: string | null }, ctx).length
      ? pavingPolygons.difference([[outline as [number, number][]]], ...poolCutoutsFor(node as AccessShape & { id: string; type: string; parentId: string | null }, ctx))
        .flatMap((polygon) => polygon.map((ring) => ring.map(([x, z], index) => `${index ? 'L' : 'M'} ${x} ${z}`).join(' ') + ' Z')).join(' ')
      : outline.map(([x, z], index) => `${index ? 'L' : 'M'} ${x} ${z}`).join(' ') + ' Z',
    fillRule: 'evenodd',
    fill: colors[kind],
    stroke: ctx.viewState?.selected ? (ctx.viewState.palette?.selectedStroke ?? landscapeToolColors.selected) : '#6d655c',
    strokeWidth: ctx.viewState?.selected ? 0.045 : 0.018,
  }]
  if (ctx.viewState?.selected && node.shape === 'freehand') children.push(...freehandFloorplanHandles(node as AccessShape & CurveNode))
  if (ctx.viewState?.selected && ['deck', 'concrete-slab', 'landing'].includes(kind) &&
      node.shape !== 'freehand' && !isCurvedSurface(node.shape)) {
    for (let index = 0; index < outline.length; index++) {
      const a = outline[index]!, b = outline[(index + 1) % outline.length]!
      children.push({ kind: 'edge-handle', x1: a[0]!, y1: a[1]!, x2: b[0]!, y2: b[1]!,
        affordance: 'move-edge', payload: { edgeIndex: index } })
    }
    for (let index = 0; index < outline.length; index++) {
      const a = outline[index]!, b = outline[(index + 1) % outline.length]!
      children.push({ kind: 'midpoint-handle', point: [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2],
        affordance: 'add-vertex', payload: { edgeIndex: index } })
    }
    for (let index = 0; index < outline.length; index++) children.push({ kind: 'endpoint-handle',
      point: [outline[index]![0]!, outline[index]![1]!], state: 'idle',
      affordance: 'move-vertex', payload: { vertexIndex: index } })
  }
  return { kind: 'group', children,
    transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation[1] } }
}

export function disposeAccessGeometry(group: Group) {
  const disposed = new Set<Mesh['material']>()
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (disposed.has(material) || material.userData.__pascalCachedMaterial) continue
      disposed.add(material)
      material.dispose()
    }
  })
}
