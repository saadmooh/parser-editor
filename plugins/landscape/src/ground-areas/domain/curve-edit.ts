import type { FloorplanGeometry } from '@pascal-app/core'
import { curveAt, fitFreehandCurve, mapCurve, sampleCurve, type CurvePoint } from './freehand-curve'
import { validateOutline } from './polygon'
import type { Point } from './schema'

export type CurveNode = {
  id: string; parentId: string | null; type: string; shape?: string; outline: Point[];
  curvePoints?: CurvePoint[]; width?: number; depth?: number;
  position?: [number, number, number]; rotation?: [number, number, number];
  closed?: boolean;
  drawMode?: string;
}
export const CURVE_ARM_SCALE = 3
const surface = (node: CurveNode) => node.type !== 'landscape:ground-area' && node.type !== 'landscape:edging'
export function curveLocal(node: CurveNode): CurvePoint[] {
  const scale = (p: Point): Point => surface(node) ? [p[0] * node.width!, p[1] * node.depth!] : [...p]
  return node.curvePoints ? mapCurve(node.curvePoints, scale) : fitFreehandCurve(node.outline.map(scale), node.closed !== false)
}
export function curveToLevel(node: CurveNode, p: Point): Point {
  if (!node.position) return [...p]
  const c = Math.cos(node.rotation?.[1] ?? 0), s = Math.sin(node.rotation?.[1] ?? 0)
  return [node.position![0] + c * p[0] + s * p[1], node.position![2] - s * p[0] + c * p[1]]
}
export function curveInLevel(node: CurveNode): CurvePoint[] {
  return mapCurve(curveLocal(node), (p) => curveToLevel(node, p))
}
export function curveEditPatch(node: CurveNode, levelCurve: CurvePoint[]) {
  const angle = node.rotation?.[1] ?? 0, c = Math.cos(angle), s = Math.sin(angle)
  const local = mapCurve(levelCurve, (p): Point => {
    if (!node.position) return [...p]
    const dx = p[0] - node.position![0], dz = p[1] - node.position![2]
    return [c * dx - s * dz, s * dx + c * dz]
  })
  const outline = sampleCurve(local, node.closed !== false)
  if (node.closed !== false && validateOutline(outline)) return null
  if (node.type === 'landscape:edging') return { curvePoints: local, points: outline,
    drawMode: node.drawMode === 'curve' ? 'curve' as const : 'freehand' as const }
  if (!surface(node)) return { shape: 'freehand' as const, curvePoints: local, outline }
  const minX = Math.min(...outline.map((p) => p[0])), maxX = Math.max(...outline.map((p) => p[0]))
  const minZ = Math.min(...outline.map((p) => p[1])), maxZ = Math.max(...outline.map((p) => p[1]))
  const width = maxX - minX, depth = maxZ - minZ
  if (width < 0.2 || depth < 0.2 || width > 30 || depth > 30) return null
  const center: Point = [(minX + maxX) / 2, (minZ + maxZ) / 2]
  const normalize = (p: Point): Point => [(p[0] - center[0]) / width, (p[1] - center[1]) / depth]
  const position = curveToLevel(node, center)
  return { shape: 'freehand' as const, width, depth,
    position: [position[0], node.position![1], position[1]] as [number, number, number],
    curvePoints: mapCurve(local, normalize), outline: outline.map(normalize) }
}
export function displayedHandle(point: CurvePoint, side: 'incoming' | 'outgoing'): Point {
  return [point.anchor[0] + (point[side][0] - point.anchor[0]) * CURVE_ARM_SCALE,
    point.anchor[1] + (point[side][1] - point.anchor[1]) * CURVE_ARM_SCALE]
}
export function freehandFloorplanHandles(node: CurveNode): FloorplanGeometry[] {
  if (node.shape !== 'freehand' || node.outline.length < (node.closed === false ? 2 : 3)) return []
  const curve = curveLocal(node), children: FloorplanGeometry[] = []
  curve.forEach((point, index) => {
    for (const side of ['incoming', 'outgoing'] as const) {
      if (node.closed === false && ((index === 0 && side === 'incoming') || (index === curve.length - 1 && side === 'outgoing'))) continue
      const handle = displayedHandle(point, side)
      children.push({ kind: 'line', x1: point.anchor[0], y1: point.anchor[1], x2: handle[0], y2: handle[1],
        stroke: '#8381ed', strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' },
      { kind: 'endpoint-handle', point: handle, state: 'idle', variant: 'curve',
        affordance: 'freehand-curve', payload: { index, action: side } })
    }
    if (node.closed !== false || index < curve.length - 1) children.push({ kind: 'midpoint-handle', point: curveAt(curve, index, 0.5),
      affordance: 'freehand-curve', payload: { index, action: 'insert' } })
    children.push({ kind: 'endpoint-handle', point: point.anchor, state: 'idle',
      affordance: 'freehand-curve', payload: { index, action: 'anchor' } })
  })
  return children
}
