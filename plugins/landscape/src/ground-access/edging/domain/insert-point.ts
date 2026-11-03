import { curveAt, sampleCurve, splitCurve, type CurvePoint } from '../../../ground-areas/domain/freehand-curve'
import { edgingControlHandle } from './sampling'
import type { EdgingNode } from './schema'
import type { Point } from './route'

export function edgingCurvePoints(node: EdgingNode): CurvePoint[] {
  return node.curvePoints ?? node.points.map((anchor, index) => {
    const [x, z] = edgingControlHandle(node, index)
    return { anchor: [...anchor] as Point,
      incoming: [anchor[0] - x, anchor[1] - z] as Point,
      outgoing: [anchor[0] + x, anchor[1] + z] as Point }
  })
}

export function edgingInsertPosition(node: EdgingNode, segment: number): Point | null {
  const next = node.points[(segment + 1) % node.points.length]
  if (!node.points[segment] || !next || (!node.closed && segment >= node.points.length - 1)) return null
  if (node.drawMode === 'curve') return curveAt(edgingCurvePoints(node), segment, 0.5)
  const at = node.points[segment]!
  return [(at[0] + next[0]) / 2, (at[1] + next[1]) / 2]
}

export function insertEdgingPoint(node: EdgingNode, segment: number): Partial<EdgingNode> | null {
  const point = edgingInsertPosition(node, segment)
  if (!point || node.drawMode === 'freehand') return null
  if (node.drawMode === 'curve') {
    const curvePoints = splitCurve(edgingCurvePoints(node), segment)
    return { curvePoints, points: sampleCurve(curvePoints, node.closed) }
  }
  const points = node.points.map((p): Point => [...p])
  points.splice(segment + 1, 0, point)
  return { points }
}
