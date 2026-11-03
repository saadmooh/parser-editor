import {
  calculateLevelMiters,
  getWallBaseElevationForNodes,
  getWallCurveFrameAt,
  getWallCurveLength,
  getWallEffectiveHeightForNodes,
  getWallMiterBoundaryPoints,
  type AnyNodeId,
  type FloorplanGeometry,
  type GeometryContext,
  type WallMiterBoundaryPoints,
  type WallNode,
  useScene,
} from '@pascal-app/core'
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Material, Mesh, MeshStandardMaterial, Shape, Vector2 } from 'three'
import { RETAININGWALL_KIND, type RetainingWallNode } from '../domain/schema'
import { buildAccessFloorplan, buildAccessGeometry } from '../../shared/geometry'
import { applyLandscapePaintedMaterials } from '../../shared/paint'

type JoinedEnds = { start: boolean; end: boolean }

function removeJoinedEndFaces(geometry: BufferGeometry, boundaries: WallMiterBoundaryPoints,
  joined: JoinedEnds): BufferGeometry {
  if (!joined.start && !joined.end) return geometry
  const source = geometry.index ? geometry.toNonIndexed() : geometry
  const position = source.getAttribute('position')
  const start = [boundaries.startLeft, boundaries.startRight]
  const end = [boundaries.endLeft, boundaries.endRight]
  const onEdge = (vertex: number, edge: typeof start) => {
    const [a, b] = edge
    const x = position.getX(vertex), z = position.getZ(vertex)
    const dx = b!.x - a!.x, dz = b!.y - a!.y
    const length = Math.hypot(dx, dz)
    return length > 1e-8 && Math.abs((x - a!.x) * dz - (z - a!.y) * dx) / length < 1e-5
  }
  const kept: number[] = []
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const atStart = joined.start && [0, 1, 2].every((offset) => onEdge(vertex + offset, start))
    const atEnd = joined.end && [0, 1, 2].every((offset) => onEdge(vertex + offset, end))
    if (!atStart && !atEnd) kept.push(vertex, vertex + 1, vertex + 2)
  }
  const result = new BufferGeometry()
  for (const name of ['position', 'normal', 'uv']) {
    const attribute = source.getAttribute(name)
    if (!attribute) continue
    const values: number[] = []
    for (const vertex of kept)
      for (let component = 0; component < attribute.itemSize; component++)
        values.push(attribute.getComponent(vertex, component))
    result.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize))
  }
  if (source !== geometry) source.dispose()
  geometry.dispose()
  return result
}

function addPiece(group: Group, material: MeshStandardMaterial, name: string,
  wall: WallNode, from: number, to: number, bottom: number, height: number,
  depth: number, boundaries: WallMiterBoundaryPoints | null, joined: JoinedEnds) {
  const length = getWallCurveLength(wall) * (to - from)
  if (length < 0.01 || height <= 0) return
  const halfDepth = depth / 2
  const count = Math.max(1, Math.ceil(length / 0.12))
  const left = [] as Vector2[]
  const right = [] as Vector2[]
  for (let i = 0; i <= count; i++) {
    const frame = getWallCurveFrameAt(wall, from + (to - from) * i / count)
    left.push(new Vector2(frame.point.x + frame.normal.x * halfDepth,
      frame.point.y + frame.normal.y * halfDepth))
    right.push(new Vector2(frame.point.x - frame.normal.x * halfDepth,
      frame.point.y - frame.normal.y * halfDepth))
  }
  if (boundaries && from < 1e-6) {
    left[0]!.set(boundaries.startLeft.x, boundaries.startLeft.y)
    right[0]!.set(boundaries.startRight.x, boundaries.startRight.y)
  }
  if (boundaries && to > 1 - 1e-6) {
    left[count]!.set(boundaries.endLeft.x, boundaries.endLeft.y)
    right[count]!.set(boundaries.endRight.x, boundaries.endRight.y)
  }
  const outline = [...right, ...left.reverse()]
  const shape = new Shape(outline.map((point) => new Vector2(point.x, -point.y)))
  let geometry: BufferGeometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, bottom, 0)
  if (boundaries && ((from < 1e-6 && joined.start) || (to > 1 - 1e-6 && joined.end)))
    geometry = removeJoinedEndFaces(geometry, boundaries,
      { start: from < 1e-6 && joined.start, end: to > 1 - 1e-6 && joined.end })
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.userData.slotId = name === 'mortar' ? 'mortar'
    : name.startsWith('cap') ? 'cap' : 'masonry'
  mesh.castShadow = true
  mesh.receiveShadow = true
  // Keep the masonry hit-testable so the retaining-wall finish can receive paint.
  group.add(mesh)
}

function palette(style: RetainingWallNode['style']) {
  if (style === 'fieldstone') return ['#aa9880', '#92846e', '#c0ad8d', '#817660']
  if (style === 'smooth') return ['#a9a7a0', '#aaa8a1', '#aaa8a1', '#aaa8a1']
  return ['#a6a29a', '#b7b2a8', '#94918a', '#c2beb5']
}

function masonryGeometry(node: RetainingWallNode, ctx: GeometryContext) {
  const group = new Group()
  const host = ctx.resolve(node.hostWallId as AnyNodeId)
  if (host?.type !== 'wall') return group
  const wall = host as WallNode
  const nodes = ctx.sceneNodes ?? useScene.getState().nodes
  const wallHeight = getWallEffectiveHeightForNodes(wall, nodes)
  const base = getWallBaseElevationForNodes(wall, nodes)
  const length = getWallCurveLength(wall)
  if (length < 0.02 || wallHeight <= 0) return group
  const depth = wall.thickness ?? node.depth
  const adjoiningWalls = Object.values(nodes).filter((candidate): candidate is WallNode =>
    candidate.type === 'wall' && candidate.parentId === wall.parentId &&
    candidate.metadata?.landscapeRetainingWall === true)
  if (!adjoiningWalls.some((candidate) => candidate.id === wall.id)) adjoiningWalls.push(wall)
  const finishByHost = new Map<string, RetainingWallNode>()
  for (const candidate of Object.values(nodes)) {
    if ((candidate.type as string) !== RETAININGWALL_KIND) continue
    const finish = candidate as unknown as RetainingWallNode
    if (finish.hostWallId) finishByHost.set(finish.hostWallId, finish)
  }
  const boundariesAt = (surfaceDepth: number, surface: 'mortar' | 'block' | 'cap') => {
    const widened = adjoiningWalls.map((candidate) => ({
      ...candidate,
      thickness: candidate.id === wall.id ? surfaceDepth :
        (candidate.thickness ?? depth) + (surface === 'mortar' ? 0.012 :
          surface === 'block' ? 0.032 : (finishByHost.get(candidate.id)?.capOverhang ?? node.capOverhang) * 2),
    }))
    return getWallMiterBoundaryPoints({ ...wall, thickness: surfaceDepth }, calculateLevelMiters(widened))
  }
  const mortarDepth = depth + 0.012
  const blockDepth = depth + 0.032
  const capDepth = depth + node.capOverhang * 2
  const mortarBoundary = boundariesAt(mortarDepth, 'mortar')
  const blockBoundary = boundariesAt(blockDepth, 'block')
  const capBoundary = boundariesAt(capDepth, 'cap')
  const sharedEndpoint = (point: [number, number]) => adjoiningWalls.some((candidate) =>
    candidate.id !== wall.id && [candidate.start, candidate.end].some((end) =>
      Math.hypot(point[0] - end[0], point[1] - end[1]) < 0.001))
  const joined = { start: sharedEndpoint(wall.start), end: sharedEndpoint(wall.end) }
  const colors = palette(node.style)
  const mortar = new MeshStandardMaterial({ color: node.style === 'fieldstone' ? '#69645b' : '#777671', roughness: 0.94 })
  const blocks = colors.map((color) => new MeshStandardMaterial({ color, roughness: 0.92 }))
  const cap = new MeshStandardMaterial({ color: node.style === 'fieldstone' ? '#baa98d' : '#c8c4bb', roughness: 0.86 })
  // At an exposed end the masonry layers intentionally share a cut plane.
  // Keep the visible course in front of its mortar backing on that plane.
  mortar.polygonOffset = true
  mortar.polygonOffsetFactor = -1
  mortar.polygonOffsetUnits = -1
  for (const block of blocks) {
    block.polygonOffset = true
    block.polygonOffsetFactor = -2
    block.polygonOffsetUnits = -2
  }
  cap.polygonOffset = true
  cap.polygonOffsetFactor = -3
  cap.polygonOffsetUnits = -3

  // The backing and every visible course use the same junction as the host wall.
  addPiece(group, mortar, 'mortar', wall, 0, 1, base, wallHeight, mortarDepth, mortarBoundary, joined)

  if (node.style === 'smooth') {
    addPiece(group, blocks[0]!, 'smooth-face', wall, 0, 1,
      base + 0.004, wallHeight - 0.008, blockDepth, blockBoundary, joined)
  } else {
    const rows = Math.max(1, Math.ceil(wallHeight / node.courseHeight))
    const rowHeight = wallHeight / rows
    for (let row = 0; row < rows; row++) {
      const count = Math.max(1, Math.ceil(length / node.unitLength))
      const unit = length / count
      const offset = row % 2 ? unit / 2 : 0
      for (let index = -1; index <= count; index++) {
        const start = Math.max(0, index * unit + offset)
        const end = Math.min(length, (index + 1) * unit + offset)
        if (end - start < 0.035) continue
        const gap = Math.min(node.jointWidth, (end - start) / 3)
        const from = start === 0 ? 0 : (start + gap / 2) / length
        const to = end === length ? 1 : (end - gap / 2) / length
        const color = blocks[(index * 7 + row * 3 + 1000) % blocks.length]!
        addPiece(group, color, `block-${row}-${index}`, wall, from, to,
          base + row * rowHeight + gap / 2, rowHeight - gap, blockDepth, blockBoundary, joined)
      }
    }
  }

  if (node.capEnabled) {
    const count = Math.max(1, Math.ceil(length / Math.max(node.unitLength, 0.35)))
    for (let index = 0; index < count; index++) {
      const gap = Math.min(node.jointWidth, length / count / 3)
      const from = index === 0 ? 0 : (index * length / count + gap / 2) / length
      const to = index === count - 1 ? 1 : ((index + 1) * length / count - gap / 2) / length
      addPiece(group, cap, `cap-${index}`, wall, from, to,
        base + wallHeight - 0.008, node.capHeight, capDepth, capBoundary, joined)
    }
  }
  return group
}

export function buildRetainingWallGeometry(node: RetainingWallNode, ctx: GeometryContext): Group {
  const group = node.hostWallId ? masonryGeometry(node, ctx) : buildAccessGeometry(node, 'retaining-wall')
  applyLandscapePaintedMaterials(group, node.paintedMaterials, (mesh) =>
    node.hostWallId ? mesh.userData.slotId ?? null : 'surface')

  if (node.hostWallId) {
    // Painted materials replace the defaults, so preserve the depth bias that
    // keeps masonry courses and caps clear of the backing. Clone instead of
    // mutating the shared material cache.
    const biasByRole: Record<string, number> = { mortar: -1, masonry: -2, cap: -3 }
    const biasedMaterials = new Map<string, Material>()
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const role = object.userData.slotId
      const factor = typeof role === 'string' ? biasByRole[role] : undefined
      if (factor === undefined || !node.paintedMaterials?.[role]) return
      const applyBias = (material: Material) => {
        const key = `${role}:${material.uuid}`
        let biased = biasedMaterials.get(key)
        if (!biased) {
          biased = material.clone()
          biased.polygonOffset = true
          biased.polygonOffsetFactor = factor
          biased.polygonOffsetUnits = factor
          delete biased.userData.__pascalCachedMaterial
          biasedMaterials.set(key, biased)
        }
        return biased
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(applyBias)
        : applyBias(object.material)
    })
  }

  return group
}

export function buildRetainingWallFloorplan(node: RetainingWallNode, ctx: GeometryContext): FloorplanGeometry {
  return node.hostWallId ? { kind: 'group', children: [] }
    : buildAccessFloorplan(node, 'retaining-wall', ctx)
}
