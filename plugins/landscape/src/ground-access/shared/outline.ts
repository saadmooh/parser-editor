import { normalizeOutline, validateOutline } from '../../ground-areas/domain/polygon'
import type { Point } from '../../ground-areas/domain/schema'
import type { AccessShape } from './schema'
import { ellipseOutline, isEllipseShape } from '../../ground-areas/domain/ellipse'

export type DrawnSurface = AccessShape & { shape: 'rectangle' | 'custom' | 'freehand' | 'circle' | 'oval'; outline: Point[] }

export function isCurvedSurface(shape: AccessShape['shape']) {
  return isEllipseShape(shape)
}

export { ellipseOutline }

export function curvedSurfaceFields(first: Point, second: Point, shape: 'circle' | 'oval', label = 'surface') {
  const width = shape === 'circle' ? 2 * Math.hypot(second[0] - first[0], second[1] - first[1])
    : Math.abs(second[0] - first[0])
  const depth = shape === 'circle' ? width : Math.abs(second[1] - first[1])
  if (width < 0.2 || depth < 0.2 || width > 30 || depth > 30)
    return { error: `Draw a ${label} between 0.2 m and 30 m on each side.` } as const
  const center: Point = shape === 'circle' ? first
    : [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
  return { error: null, width, depth, position: [center[0], 0, center[1]] as [number, number, number],
    shape, outline: [] as Point[] }
}

export function circleSizePatch(node: AccessShape, patch: Partial<Pick<AccessShape, 'width' | 'depth'>>) {
  if (node.shape !== 'circle') return patch
  const diameter = patch.width ?? patch.depth
  return diameter === undefined ? patch : { ...patch, width: diameter, depth: diameter }
}

export function circleDerivedSize(node: AccessShape, patch: Partial<Pick<AccessShape, 'width' | 'depth'>>) {
  const diameter = patch.width ?? patch.depth
  return node.shape === 'circle' && diameter !== undefined
    ? { width: diameter, depth: diameter } : {}
}

export function surfaceOutline(node: DrawnSurface): Point[] {
  if (isCurvedSurface(node.shape)) return ellipseOutline([0, 0], node.width / 2,
    (node.shape === 'circle' ? node.width : node.depth) / 2)
  if (node.shape !== 'rectangle' && node.outline.length >= 3)
    return node.outline.map(([x, z]): Point => [x * node.width, z * node.depth])
  return [
    [-node.width / 2, -node.depth / 2], [node.width / 2, -node.depth / 2],
    [node.width / 2, node.depth / 2], [-node.width / 2, node.depth / 2],
  ]
}

export function surfaceDrawingFields(raw: Point[], shape: DrawnSurface['shape'], label = 'surface') {
  const points = normalizeOutline(raw)
  const error = validateOutline(points)
  if (error) return { error } as const
  const minX = Math.min(...points.map((point) => point[0]))
  const maxX = Math.max(...points.map((point) => point[0]))
  const minZ = Math.min(...points.map((point) => point[1]))
  const maxZ = Math.max(...points.map((point) => point[1]))
  const width = maxX - minX
  const depth = maxZ - minZ
  if (width < 0.2 || depth < 0.2 || width > 30 || depth > 30)
    return { error: `Draw a ${label} between 0.2 m and 30 m on each side.` } as const
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  return { error: null, width, depth, position: [cx, 0, cz] as [number, number, number],
    shape, outline: shape === 'rectangle' ? [] : points.map(([x, z]): Point => [(x - cx) / width, (z - cz) / depth]) }
}

/** The polygon editor works in level coordinates; surface geometry is node-local. */
export function surfaceLevelOutline(node: DrawnSurface): Point[] {
  const angle = node.rotation[1]
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return surfaceOutline(node).map(([x, z]): Point => [
    node.position[0] + x * cos + z * sin,
    node.position[2] - x * sin + z * cos,
  ])
}

export function surfaceEditPatch(node: DrawnSurface, levelPoints: Point[], label = 'surface') {
  const angle = node.rotation[1]
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const local = levelPoints.map(([x, z]): Point => {
    const dx = x - node.position[0], dz = z - node.position[2]
    return [dx * cos - dz * sin, dx * sin + dz * cos]
  })
  const rectangle = local.length === 4 && local.every((point, index) => {
    const next = local[(index + 1) % local.length]!
    return Math.abs(point[0] - next[0]) < 0.001 || Math.abs(point[1] - next[1]) < 0.001
  })
  const fields = surfaceDrawingFields(local, rectangle ? 'rectangle' : 'custom', label)
  if (fields.error || !fields.position) return null
  const [cx, , cz] = fields.position
  const { error: _error, ...patch } = fields
  return {
    ...patch,
    curvePoints: undefined,
    position: [node.position[0] + cx * cos + cz * sin, node.position[1],
      node.position[2] - cx * sin + cz * cos] as [number, number, number],
  }
}
