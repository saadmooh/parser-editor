import { addCurves } from './network'
import { pathComponents } from './components'
import type { Curve } from './curves'
import { PathwayNode, type PathEdge, type PathGraph } from './schema'

type Change = {
  create: PathwayNode[]
  update: PathwayNode[]
  delete: string[]
  activeId: string | null
}

/** Keep each connected centerline component in one selectable scene node. */
export function planPathwayItems(
  existing: PathwayNode[],
  curves: Curve[],
  width: number,
  template: PathwayNode,
  shape?: PathEdge['shape'],
): Change {
  const compatible = existing.filter((node) => node.parentId === template.parentId &&
    Math.abs(node.elevation - template.elevation) < 1e-5)
  const combined: PathGraph = {
    vertices: compatible.flatMap((node) => node.vertices),
    edges: compatible.flatMap((node) => node.edges),
  }
  const graph = addCurves(combined, curves, width, shape)
  const parts = pathComponents(graph)
  const allocated = new Set<string>()
  const create: PathwayNode[] = [], update: PathwayNode[] = []
  let activeId: string | null = null
  const newEnds = curves.flatMap((curve) => [curve[0], curve[3]])
  for (const part of parts) {
    const owners = compatible.filter((node) => node.vertices.some((oldVertex) =>
      part.vertices.some((vertex) => vertex.id === oldVertex.id)))
    const owner = owners.find((node) => !allocated.has(node.id))
    const source = owner ?? owners[0] ?? template
    const next = PathwayNode.parse({ ...source, ...part,
      ...(owner ? {} : { id: undefined }) })
    if (owner) {
      allocated.add(owner.id)
      if (JSON.stringify([owner.vertices, owner.edges]) !== JSON.stringify([next.vertices, next.edges])) update.push(next)
    }
    else create.push(next)
    if (curves.length && part.vertices.some((vertex) => newEnds.some((point) =>
      Math.hypot(vertex.point[0] - point[0], vertex.point[1] - point[1]) < 1e-5))) {
      activeId = next.id
    }
  }
  return { create, update, delete: compatible.filter((node) => !allocated.has(node.id)).map((node) => node.id), activeId }
}
