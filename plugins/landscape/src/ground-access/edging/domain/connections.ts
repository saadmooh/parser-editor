import type { AnyNode } from '@pascal-app/core'
import type { EdgingNode } from './schema'
import { levelPoints } from './route'

export type EdgingTerminal = { id: 'start' | 'end'; point: [number, number]; direction: [number, number]; length: number }
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)
const pointsOf = (node: EdgingNode) => node.points.length ? node.points : [[-node.width / 2, 0], [node.width / 2, 0]] as [number, number][]

export function edgingTerminals(node: EdgingNode, nodes: Record<string, AnyNode>): EdgingTerminal[] {
  if (node.closed) return []
  const points = pointsOf(node)
  if (points.length < 2) return []
  const allRuns = Object.values(nodes)
    .filter((item) => (item.id as string) !== node.id && (item.type as string) === 'landscape:edging' && item.parentId === node.parentId)
    .map((item) => item as unknown as EdgingNode)
  const ends: EdgingTerminal[] = [
    { id: 'start', point: points[0]!, direction: [points[0]![0] - points[1]![0], points[0]![1] - points[1]![1]], length: distance(points[0]!, points[1]!) },
    { id: 'end', point: points.at(-1)!, direction: [points.at(-1)![0] - points.at(-2)![0], points.at(-1)![1] - points.at(-2)![1]], length: distance(points.at(-1)!, points.at(-2)!) },
  ]
  return ends.filter((end) => {
    if (end.length < 1e-4) return false
    const levelPoint = levelPoints(node)[end.id === 'start' ? 0 : points.length - 1]!
    return !allRuns.some((run) => {
      const route = levelPoints(run)
      if (run.closed) route.push(route[0]!)
      for (let index = 1; index < route.length; index++) {
        const a = route[index - 1]!, b = route[index]!
        const dx = b[0] - a[0], dz = b[1] - a[1]
        const t = Math.max(0, Math.min(1, ((levelPoint[0] - a[0]) * dx + (levelPoint[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)))
        if (distance(levelPoint, [a[0] + t * dx, a[1] + t * dz]) < 0.08) return true
      }
      return false
    })
  }).map((end) => {
    const length = Math.hypot(...end.direction)
    return { ...end, direction: [end.direction[0] / length, end.direction[1] / length] }
  })
}
