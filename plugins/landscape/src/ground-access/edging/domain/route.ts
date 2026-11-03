import type { EdgingNode } from './schema'

export type Point = EdgingNode['points'][number]

export function levelPoints(node: EdgingNode): Point[] {
  const angle = node.rotation[1], cos = Math.cos(angle), sin = Math.sin(angle)
  return node.points.map(([x, z]): Point => [
    node.position[0] + x * cos + z * sin,
    node.position[2] - x * sin + z * cos,
  ])
}

export function localPoints(node: EdgingNode, points: Point[]): Point[] {
  const angle = node.rotation[1], cos = Math.cos(angle), sin = Math.sin(angle)
  return points.map(([x, z]): Point => {
    const dx = x - node.position[0], dz = z - node.position[2]
    return [dx * cos - dz * sin, dx * sin + dz * cos]
  })
}
