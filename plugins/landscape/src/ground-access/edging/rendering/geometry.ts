import { landscapeToolColors } from '../../../shared/tool-colors'
import { freehandFloorplanHandles } from '../../../ground-areas/domain/curve-edit'
import { edgingCurveNode } from '../domain/curve'
import { useScene, type AnyNode, type FloorplanGeometry, type GeometryContext } from '@pascal-app/core'
import { BoxGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, Vector2 } from 'three'
import type { Polygon } from 'polygon-clipping'
import { createMaterial, resolveMaterialRef } from '@pascal-app/viewer'
import { extrudePaving } from '../../../pathways/rendering/safe-extrusion'
import { buildOutline } from '../../../pathways/rendering/outline'
import type { EdgingNode } from '../domain/schema'
import { edgingTerminals } from '../domain/connections'
import { edgingEditIndices } from '../domain/edit'
import { edgingControlHandle, edgingLayoutPoints, edgingRenderPoints } from '../domain/sampling'
import { edgingInsertPosition } from '../domain/insert-point'

export type EdgingPoint = EdgingNode['points'][number]

/** Legacy rectangular edging remains visible; new empty drafts stay empty. */
export function edgingPoints(node: EdgingNode): EdgingPoint[] {
  return Array.isArray(node.points) && node.points.length
    ? node.points
    : node.points === undefined ? [[-node.width / 2, 0], [node.width / 2, 0]] : []
}

function outlineNode(points: EdgingPoint[], closed: boolean, width: number) {
  const vertices = points.map((point, index) => ({ id: `edging-${index}`, point }))
  const links = points.slice(1).map((_, index) => [index, index + 1] as const)
  if (closed && points.length > 2) links.push([points.length - 1, 0])
  const edges = links.map(([from, to]) => {
    const a = points[from]!, b = points[to]!
    return { id: `edge-${from}-${to}`, from: `edging-${from}`, to: `edging-${to}`,
      controls: [[a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
        [a[0] + (b[0] - a[0]) * 2 / 3, a[1] + (b[1] - a[1]) * 2 / 3]] as [EdgingPoint, EdgingPoint],
      shape: 'straight' as const, width }
  })
  return { vertices, edges, cornerStyle: 'square' as const }
}

/** Build one joined ribbon so continuous edging has a true offset miter at each bend. */
function miteredRibbon(points: EdgingPoint[], width: number): Polygon | null {
  const route = points.filter((point, index) => index === 0 ||
    Math.hypot(point[0] - points[index - 1]![0], point[1] - points[index - 1]![1]) > 1e-4)
  if (route.length < 2) return null
  const half = width / 2
  const left: EdgingPoint[] = []
  const right: EdgingPoint[] = []
  for (let index = 0; index < route.length; index += 1) {
    const point = route[index]!
    const before = route[Math.max(0, index - 1)]!
    const after = route[Math.min(route.length - 1, index + 1)]!
    const incomingLength = Math.hypot(point[0] - before[0], point[1] - before[1])
    const outgoingLength = Math.hypot(after[0] - point[0], after[1] - point[1])
    const incoming: EdgingPoint = incomingLength > 1e-5
      ? [(point[0] - before[0]) / incomingLength, (point[1] - before[1]) / incomingLength]
      : [(after[0] - point[0]) / Math.max(outgoingLength, 1e-5), (after[1] - point[1]) / Math.max(outgoingLength, 1e-5)]
    const outgoing: EdgingPoint = outgoingLength > 1e-5
      ? [(after[0] - point[0]) / outgoingLength, (after[1] - point[1]) / outgoingLength]
      : incoming
    const n1: EdgingPoint = [-incoming[1], incoming[0]]
    const n2: EdgingPoint = [-outgoing[1], outgoing[0]]
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1]
    let magnitude = Math.hypot(mx, mz)
    if (magnitude < 1e-5) { mx = n2[0]; mz = n2[1]; magnitude = 1 }
    mx /= magnitude; mz /= magnitude
    const denominator = mx * n2[0] + mz * n2[1]
    const miterLength = Math.min(half * 4, half / Math.max(0.25, Math.abs(denominator)))
    const ox = mx * miterLength, oz = mz * miterLength
    left.push([point[0] + ox, point[1] + oz])
    right.push([point[0] - ox, point[1] - oz])
  }
  return [[...left, ...right.reverse()]]
}

function miteredClosedRibbon(points: EdgingPoint[], width: number): Polygon | null {
  const route = points.filter((point, index) => index === 0 ||
    Math.hypot(point[0] - points[index - 1]![0], point[1] - points[index - 1]![1]) > 1e-4)
  if (route.length > 2 && Math.hypot(route[0]![0] - route.at(-1)![0], route[0]![1] - route.at(-1)![1]) < 1e-4)
    route.pop()
  if (route.length < 3) return null
  const half = width / 2
  const left: EdgingPoint[] = [], right: EdgingPoint[] = []
  for (let index = 0; index < route.length; index += 1) {
    const point = route[index]!
    const before = route[(index + route.length - 1) % route.length]!
    const after = route[(index + 1) % route.length]!
    const inLength = Math.hypot(point[0] - before[0], point[1] - before[1])
    const outLength = Math.hypot(after[0] - point[0], after[1] - point[1])
    if (inLength < 1e-5 || outLength < 1e-5) return null
    const ix = (point[0] - before[0]) / inLength, iz = (point[1] - before[1]) / inLength
    const ox = (after[0] - point[0]) / outLength, oz = (after[1] - point[1]) / outLength
    const n1: EdgingPoint = [-iz, ix], n2: EdgingPoint = [-oz, ox]
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1]
    const miterDirectionLength = Math.hypot(mx, mz)
    if (miterDirectionLength < 1e-5) return null
    mx /= miterDirectionLength; mz /= miterDirectionLength
    const denominator = mx * n2[0] + mz * n2[1]
    const distance = Math.min(half * 4, half / Math.max(0.25, Math.abs(denominator)))
    const offset: EdgingPoint = [mx * distance, mz * distance]
    left.push([point[0] + offset[0], point[1] + offset[1]])
    right.push([point[0] - offset[0], point[1] - offset[1]])
  }
  const area = route.reduce((sum, point, index) => {
    const next = route[(index + 1) % route.length]!
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0)
  if (Math.abs(area) < 1e-5) return null
  return area > 0 ? [right, left] : [left, right]
}

function addPaintRole(mesh: Mesh, slot = 'edging') {
  mesh.userData.slotId = slot
  return mesh
}

function addRibbon(group: Group, points: EdgingPoint[], closed: boolean, width: number,
  height: number, elevation: number, material: MeshStandardMaterial, name: string, slot = 'edging') {
  const ribbon = closed ? miteredClosedRibbon(points, width) : miteredRibbon(points, width)
  const polygons = ribbon ? [ribbon] : buildOutline(outlineNode(points, closed, width))
  for (const polygon of polygons) {
    const geometry = extrudePaving(polygon, { depth: height, bevelEnabled: false, steps: 1 })
    if (!geometry) continue
    geometry.rotateX(-Math.PI / 2)
    const mesh = addPaintRole(new Mesh(geometry, material), slot)
    mesh.name = name
    mesh.position.y = elevation
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
}

/** The same offset on both sides of a vertex gives adjacent pieces one diagonal seam. */
function cornerOffset(before: EdgingPoint, at: EdgingPoint, after: EdgingPoint, half: number): EdgingPoint {
  const inLength = Math.hypot(at[0] - before[0], at[1] - before[1])
  const outLength = Math.hypot(after[0] - at[0], after[1] - at[1])
  const inNormal: EdgingPoint = [-(at[1] - before[1]) / inLength, (at[0] - before[0]) / inLength]
  const outNormal: EdgingPoint = [-(after[1] - at[1]) / outLength, (after[0] - at[0]) / outLength]
  const sum: EdgingPoint = [inNormal[0] + outNormal[0], inNormal[1] + outNormal[1]]
  const magnitude = Math.hypot(...sum)
  if (magnitude < 1e-5) return [outNormal[0] * half, outNormal[1] * half]
  const direction: EdgingPoint = [sum[0] / magnitude, sum[1] / magnitude]
  const denominator = Math.abs(direction[0] * outNormal[0] + direction[1] * outNormal[1])
  const distance = Math.min(half * 4, half / Math.max(0.25, denominator))
  return [direction[0] * distance, direction[1] * distance]
}

export function buildEdgingGeometry(node: EdgingNode): Group {
  const group = new Group()
  group.name = 'landscape-edging'
  const material = new MeshStandardMaterial({ color: '#b6ad9d', roughness: 0.88 })
  const points = node.points?.length ? edgingRenderPoints(node) : edgingPoints(node)
  const form = node.form ?? 'pavers'
  const height = form === 'capped-wall' || form === 'square-posts' || form === 'round-posts'
    ? node.thickness : node.profile === 'flush' ? Math.min(node.thickness, 0.035)
    : node.profile === 'low' ? Math.min(node.thickness, 0.12) : node.thickness

  if (form === 'strip' && points.length >= 2) {
    addRibbon(group, points, node.closed, node.depth, height, 0, material, 'edging-strip')
  } else if (form === 'capped-wall' && points.length >= 2) {
    const capHeight = Math.min(node.capThickness, Math.max(0.02, height * 0.35))
    const bodyHeight = Math.max(0.02, height - capHeight)
    const courses = Math.max(1, Math.ceil(bodyHeight / 0.18))
    const courseHeight = bodyHeight / courses
    for (let course = 0; course < courses; course += 1) {
      const courseGroup = buildEdgingGeometry({ ...node, form: 'pavers', layout: 'separated',
        profile: 'raised', thickness: Math.max(0.025, courseHeight - 0.008),
        unitLength: Math.max(node.unitLength, 0.45), paintedMaterials: {} })
      courseGroup.name = `edging-wall-course-${course + 1}`
      courseGroup.position.y = course * courseHeight
      group.add(courseGroup)
    }
    const capMaterial = new MeshStandardMaterial({ color: '#d0c9b9', roughness: 0.82 })
    addRibbon(group, points, node.closed, node.depth + node.capOverhang * 2,
      capHeight, bodyHeight, capMaterial, 'edging-wall-cap', 'edging-cap')
    const capPaint = node.paintedMaterials?.['edging-cap']
    const capEffective = capPaint?.material ? createMaterial(capPaint.material, 'rendered')
      : capPaint?.materialPreset ? resolveMaterialRef(capPaint.materialPreset, useScene.getState().materials, 'rendered') : null
    if (capEffective) {
      group.traverse((object) => {
        if (object instanceof Mesh && object.userData.slotId === 'edging-cap') object.material = capEffective
      })
      capMaterial.dispose()
    }
    if (!group.getObjectByName('edging-wall-cap')) capMaterial.dispose()
  } else if ((form === 'square-posts' || form === 'round-posts') && points.length >= 2) {
    const centers = edgingLayoutPoints(points, node.depth + node.jointWidth, node.closed)
    const geometries = new Map<string, BoxGeometry | LatheGeometry>()
    for (let index = 0; index < centers.length; index += 1) {
      const center = centers[index]!
      const previous = centers[Math.max(0, index - 1)]!
      const next = centers[Math.min(centers.length - 1, index + 1)]!
      const stagger = node.postHeightPattern === 'staggered'
        ? 0.72 + 0.28 * Math.abs(Math.sin((index + 1) * 2.39)) : 1
      const postHeight = height * stagger
      const diameter = Math.max(0.05, node.depth - node.jointWidth)
      const key = `${form}-${Math.round(postHeight * 1000)}`
      let geometry = geometries.get(key)
      if (!geometry) {
        if (form === 'round-posts') {
          const radius = diameter / 2
          const bevel = Math.min(radius * 0.15, postHeight * 0.15)
          geometry = new LatheGeometry([
            new Vector2(0, 0), new Vector2(radius, 0),
            new Vector2(radius, postHeight - bevel),
            new Vector2(radius - bevel * 0.35, postHeight - bevel * 0.3),
            new Vector2(radius - bevel, postHeight), new Vector2(0, postHeight),
          ], 16)
        } else geometry = new BoxGeometry(diameter, postHeight, diameter)
        geometries.set(key, geometry)
      }
      const mesh = addPaintRole(new Mesh(geometry, material))
      mesh.name = `edging-${form}-${index + 1}`
      mesh.position.set(center[0], form === 'round-posts' ? 0 : postHeight / 2, center[1])
      if (form === 'square-posts') mesh.rotation.y = Math.atan2(-(next[1] - previous[1]), next[0] - previous[0])
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
  } else {
    const layoutPoints = node.drawMode === 'curve' || node.drawMode === 'freehand'
      ? edgingLayoutPoints(points, node.unitLength, node.closed) : points
    const unique = layoutPoints.filter((point, index) => index === 0 ||
      Math.hypot(point[0] - layoutPoints[index - 1]![0], point[1] - layoutPoints[index - 1]![1]) > 1e-4)
    if (node.closed && unique.length > 2 &&
      Math.hypot(unique[0]![0] - unique.at(-1)![0], unique[0]![1] - unique.at(-1)![1]) < 1e-4) unique.pop()
    const route = node.closed && unique.length > 2 ? [...unique, unique[0]!] : unique
    const pitch = Math.max(0.05, node.unitLength)
    for (let index = 0; index < route.length - 1; index += 1) {
      const a = route[index]!, b = route[index + 1]!
      const dx = b[0] - a[0], dz = b[1] - a[1]
      const length = Math.hypot(dx, dz)
      if (length < 0.02) continue
      const ux = dx / length, uz = dz / length
      const normal: EdgingPoint = [-uz * node.depth / 2, ux * node.depth / 2]
      const before = index > 0 ? route[index - 1] : node.closed && route.length > 3 ? route[route.length - 2] : undefined
      const after = index + 2 < route.length ? route[index + 2] : node.closed && route.length > 3 ? route[1] : undefined
      const startOffset = before ? cornerOffset(before, a, b, node.depth / 2) : normal
      const endOffset = after ? cornerOffset(a, b, after, node.depth / 2) : normal
      const count = Math.max(1, Math.ceil(length / pitch))
      const pieceLength = length / count
      for (let piece = 0; piece < count; piece += 1) {
        const woven = form === 'pavers' && node.layout === 'woven' && piece % 2 === 1
        const gap = Math.min(node.jointWidth, pieceLength * 0.4)
        const stoneVariation = form === 'stone' ? 1 - node.irregularity * 0.18 *
          Math.abs(Math.sin((index * 13 + piece * 7 + 1) * 3.71)) : 1
        const unitHeight = (woven ? height * 0.84 : height) * stoneVariation
        const cornerPiece = (piece === 0 && before) || (piece === count - 1 && after)
        const irregularScale = node.layout === 'woven' || cornerPiece ? 1 : 1 - node.irregularity * 0.1 *
          Math.abs(Math.sin((index * 37 + piece * 19 + 1) * 12.7))
        const shrink = (1 - irregularScale) * (pieceLength - gap) / 2
        const start = piece * pieceLength + (piece > 0 || before ? gap / 2 : 0) + shrink
        const end = (piece + 1) * pieceLength - (piece < count - 1 || after ? gap / 2 : 0) - shrink
        const startCenter: EdgingPoint = [a[0] + ux * start, a[1] + uz * start]
        const endCenter: EdgingPoint = [a[0] + ux * end, a[1] + uz * end]
        const startNormal = piece === 0 ? startOffset : normal
        const endNormal = piece === count - 1 ? endOffset : normal
        const startLeft: EdgingPoint = [startCenter[0] + startNormal[0], startCenter[1] + startNormal[1]]
        const endLeft: EdgingPoint = [endCenter[0] + endNormal[0], endCenter[1] + endNormal[1]]
        const endRight: EdgingPoint = [endCenter[0] - endNormal[0], endCenter[1] - endNormal[1]]
        const startRight: EdgingPoint = [startCenter[0] - startNormal[0], startCenter[1] - startNormal[1]]
        const roughness = form === 'stone' ? node.depth * node.irregularity * 0.12 : 0
        const leftBulge = roughness * Math.sin((index * 37 + piece * 19 + 1) * 4.17)
        const rightBulge = roughness * Math.sin((index * 29 + piece * 11 + 2) * 5.13)
        const footprint: Polygon = [[startLeft,
          ...(form === 'stone' ? [[(startLeft[0] + endLeft[0]) / 2 - uz * leftBulge,
            (startLeft[1] + endLeft[1]) / 2 + ux * leftBulge] as EdgingPoint] : []),
          endLeft, endRight,
          ...(form === 'stone' ? [[(endRight[0] + startRight[0]) / 2 + uz * rightBulge,
            (endRight[1] + startRight[1]) / 2 - ux * rightBulge] as EdgingPoint] : []),
          startRight]]
        const geometry = extrudePaving(footprint, { depth: unitHeight, bevelEnabled: false, steps: 1 })
        if (!geometry) continue
        geometry.rotateX(-Math.PI / 2)
        const mesh = addPaintRole(new Mesh(geometry, material))
        mesh.name = `edging-${form === 'stone' ? 'stone' : 'piece'}-${index + 1}-${piece + 1}`
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
      }
    }
  }
  const painted = node.paintedMaterials?.edging
  const effective = painted?.material ? createMaterial(painted.material, 'rendered')
    : painted?.materialPreset ? resolveMaterialRef(painted.materialPreset, useScene.getState().materials, 'rendered') : null
  if (effective) {
    const replaced = new Set<Mesh['material']>()
    group.traverse((object) => {
      if (object instanceof Mesh && object.userData.slotId === 'edging') {
        replaced.add(object.material)
        object.material = effective
      }
    })
    for (const prior of replaced) {
      if (Array.isArray(prior)) prior.forEach((item) => item.dispose())
      else prior.dispose()
    }
    if (!replaced.has(material)) material.dispose()
  }
  if (!effective && (form === 'capped-wall' || !group.children.length)) material.dispose()
  return group
}

export function buildEdgingFloorplan(node: EdgingNode, ctx: GeometryContext): FloorplanGeometry {
  const points = edgingPoints(node)
  const rendered = node.points?.length ? edgingRenderPoints(node) : points
  const selected = ctx.viewState?.selected || ctx.viewState?.highlighted
  const d = rendered.length >= 2
    ? `${rendered.map(([x, z], index) => `${index ? 'L' : 'M'} ${x} ${z}`).join(' ')}${node.closed ? ' Z' : ''}` : ''
  const children: FloorplanGeometry[] = d ? [{
    kind: 'path', d, fill: 'none', stroke: selected
      ? (ctx.viewState?.palette?.selectedStroke ?? landscapeToolColors.selected) : '#8d877b',
    strokeWidth: Math.max(node.depth, selected ? 0.045 : 0.02),
    strokeLinecap: 'square', strokeLinejoin: 'miter',
  }] : []
  if (selected && (node.drawMode === 'freehand' || node.curvePoints)) children.push(...freehandFloorplanHandles(edgingCurveNode(node)))
  if (selected && points.length >= 2 && node.drawMode !== 'freehand' && !node.curvePoints) {
    const spans = points.length - 1 + (node.closed ? 1 : 0)
    for (let segment = 0; segment < spans; segment++) {
      const point = edgingInsertPosition(node, segment)
      if (point) children.push({ kind: 'midpoint-handle', point,
        affordance: 'edging-insert-point', payload: { segment } })
    }
    if (!node.closed && node.drawMode !== 'curve') {
      const siblings = Object.fromEntries(ctx.siblings.map((sibling) => [sibling.id, sibling])) as Record<string, AnyNode>
      const terminals = edgingTerminals(node, siblings)
      for (const terminal of terminals) children.push({ kind: 'move-arrow',
        point: [terminal.point[0] + terminal.direction[0] * 0.45, terminal.point[1] + terminal.direction[1] * 0.45],
        angle: Math.atan2(terminal.direction[1], terminal.direction[0]),
        affordance: 'edging-extend-endpoint', payload: { id: terminal.id } })
    }
    if (node.drawMode === 'curve') points.forEach((point, index) => {
      const handle = edgingControlHandle(node, index).map((value) => value * 3) as EdgingPoint
      children.push({ kind: 'line', x1: point[0] - handle[0], y1: point[1] - handle[1],
        x2: point[0] + handle[0], y2: point[1] + handle[1], stroke: '#8381ed',
        strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' })
      for (const side of [-1, 1]) children.push({ kind: 'endpoint-handle',
        point: [point[0] + handle[0] * side, point[1] + handle[1] * side], state: 'idle', variant: 'curve',
        affordance: 'edging-move-tangent', payload: { index, side } })
    })
    edgingEditIndices({ ...node, points }).forEach((index) => children.push({ kind: 'endpoint-handle', point: points[index]!, state: 'idle',
      affordance: 'edging-move-point', payload: { index } }))
  }
  return { kind: 'group', children,
    transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation[1] } }
}
