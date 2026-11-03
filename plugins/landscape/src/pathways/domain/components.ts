import type { PathGraph } from './schema'

/** Connected centerline pieces, regardless of whether their paving footprints overlap. */
export function pathComponents(graph: PathGraph): PathGraph[] {
  const incident = new Map<string, string[]>()
  for (const edge of graph.edges) {
    incident.set(edge.from, [...(incident.get(edge.from) ?? []), edge.to])
    incident.set(edge.to, [...(incident.get(edge.to) ?? []), edge.from])
  }
  const visited = new Set<string>()
  const components: PathGraph[] = []
  for (const first of graph.vertices) {
    if (!incident.has(first.id) || visited.has(first.id)) continue
    const queue = [first.id]
    const ids = new Set<string>()
    while (queue.length) {
      const id = queue.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      ids.add(id)
      queue.push(...(incident.get(id) ?? []))
    }
    components.push({
      vertices: graph.vertices.filter((vertex) => ids.has(vertex.id)),
      edges: graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
    })
  }
  return components
}
