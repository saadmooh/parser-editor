import type { AnyNode } from '@pascal-app/core'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { validateOutline } from '../ground-areas/domain/polygon'
import { PathwayNode } from '../pathways/domain/schema'
import { distance, edgeCurve, sample } from '../pathways/domain/curves'
import { plantingClearanceChecks } from './planting-clearance'

export type LandscapeIssue = { nodeId: string; relatedId?: string; message: string }
export function landscapeDesignChecks(nodes: readonly AnyNode[], sceneNodes?: Readonly<Record<string, AnyNode>>): LandscapeIssue[] {
  const issues: LandscapeIssue[] = []
  for (const node of nodes) {
    const add = (message: string) => issues.push({ nodeId: node.id, message })
    if ((node.type as string) === 'landscape:ground-area') {
      const parsed = GroundAreaNode.safeParse(node)
      if (!parsed.success) { add('Ground area contains invalid saved data.'); continue }
      const error = validateOutline(parsed.data.outline)
      if (error) add(error)
    }
    if ((node.type as string) === 'landscape:pathway') {
      const parsed = PathwayNode.safeParse(node)
      if (!parsed.success) { add('Walkway contains invalid saved data or missing junctions.'); continue }
      const path = parsed.data
      if (!path.edges.length) { add('Walkway has no segments.'); continue }
      const adjacency = new Map(path.vertices.map((vertex) => [vertex.id, new Set<string>()]))
      for (const edge of path.edges) {
        adjacency.get(edge.from)?.add(edge.to); adjacency.get(edge.to)?.add(edge.from)
        const points = sample(edgeCurve(path, edge)).map((entry) => entry.point)
        const length = points.slice(1).reduce((sum, point, index) => sum + distance(point, points[index]!), 0)
        if (length < 0.03) add(`Segment ${edge.id} is shorter than 3 cm.`)
      }
      const isolated = [...adjacency.values()].filter((neighbors) => !neighbors.size).length
      if (isolated) add(`${isolated} unused walkway junction${isolated === 1 ? '' : 's'}.`)
      const visited = new Set<string>()
      let components = 0
      for (const [id, neighbors] of adjacency) {
        if (visited.has(id) || !neighbors.size) continue
        components++
        const queue = [id]
        for (let index = 0; index < queue.length; index++) {
          const current = queue[index]!
          if (visited.has(current)) continue
          visited.add(current)
          queue.push(...adjacency.get(current) ?? [])
        }
      }
      if (components > 1) add(`Walkway contains ${components} disconnected networks. Confirm this is intentional.`)
    }
  }
  return [...issues, ...plantingClearanceChecks(nodes, 100, sceneNodes)]
}
