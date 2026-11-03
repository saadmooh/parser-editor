import type { EdgingNode } from './schema'
import type { Point } from './route'
import { simplifyEdgingStroke } from './sampling'

/** Joined runs contain render samples, which must not each become an editing handle. */
export function edgingEditIndices(node: Pick<EdgingNode, 'points' | 'closed' | 'drawMode'>): number[] {
  if (node.drawMode !== 'freehand' || node.points.length < 3)
    return node.points.map((_, index) => index)
  const route = node.closed ? [...node.points, node.points[0]!] : node.points
  const indices = new Map(node.points.map((point, index) => [point, index]))
  return [...new Set(simplifyEdgingStroke(route, 0.08).map((point) => indices.get(point)!))]
}

/** Move editing anchors while smoothly carrying the samples between them. */
export function moveEdgingControls(points: Point[], controls: number[], closed: boolean,
  moves: ReadonlyMap<number, Point>): Point[] {
  const result = points.map(([x, z]): Point => [x, z])
  const spans = controls.length - 1 + (closed ? 1 : 0)
  for (let span = 0; span < spans; span++) {
    const start = controls[span]!, end = controls[(span + 1) % controls.length]!
    const indices = [start]
    while (indices.at(-1) !== end && indices.length <= points.length)
      indices.push((indices.at(-1)! + 1) % points.length)
    const distances = [0]
    for (let i = 1; i < indices.length; i++) {
      const a = points[indices[i - 1]!]!, b = points[indices[i]!]!
      distances.push(distances.at(-1)! + Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
    const total = distances.at(-1)!
    const a = moves.get(start) ?? [0, 0], b = moves.get(end) ?? [0, 0]
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i]!, point = points[index]!
      const t = total > 1e-8 ? distances[i]! / total : 0
      const blend = t * t * (3 - 2 * t)
      result[index] = [point[0] + a[0] * (1 - blend) + b[0] * blend,
        point[1] + a[1] * (1 - blend) + b[1] * blend]
    }
  }
  return result
}
