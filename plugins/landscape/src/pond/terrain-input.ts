import { getLevelElevations, type GeometryContext } from '@pascal-app/core'
import type { PondNode } from './schema'

type Nodes = NonNullable<GeometryContext['sceneNodes']>
const identities = new WeakMap<object, number>()
let nextIdentity = 0
function identity(value: unknown) {
  if (!value || typeof value !== 'object') return value ?? null
  let id = identities.get(value)
  if (id === undefined) { id = ++nextIdentity; identities.set(value, id) }
  return id
}

/** Ignore appearance edits and unrelated objects; keep hierarchy and terrain changes. */
export function pondTerrainContextKey(node: Pick<PondNode, 'parentId'>, nodes: Nodes) {
  const parents: unknown[] = [], seen = new Set<string>()
  let id = node.parentId
  while (id && !seen.has(id)) {
    seen.add(id)
    const parent = nodes[id as keyof Nodes]
    if (!parent) { parents.push(id); break }
    const raw = parent as unknown as Record<string, unknown>
    parents.push([id, parent.parentId, parent.visible, raw.position, raw.rotation,
      identity(raw.terrain), identity(raw.polygon),
      parent.type === 'level' ? getLevelElevations(nodes).get(parent.id)?.baseY ?? 0 : null])
    if (parent.type === 'site') break
    id = parent.parentId
  }
  return JSON.stringify(parents)
}

export function pondTerrainInputKey(nodes: Nodes) {
  return JSON.stringify(Object.values(nodes).flatMap(raw => {
    if (raw.type === 'site') {
      const site = raw as unknown as Record<string, unknown>
      return [[raw.id, raw.visible, identity(site.terrain), identity(site.polygon)]]
    }
    if ((raw.type as string) !== 'landscape:pond') return []
    const node = raw as unknown as PondNode
    return [[node.id, node.visible, node.position, node.rotation, node.width, node.depth,
      node.shape, node.outline, node.elevation, node.basinDepth, node.waterDrop,
      node.bankWidth, node.thickness, pondTerrainContextKey(node, nodes)]]
  }))
}

/** Material edits refresh shading without re-excavating the site terrain. */
export function pondTerrainAppearanceKey(nodes: Nodes) {
  return JSON.stringify([pondTerrainInputKey(nodes), Object.values(nodes).flatMap(raw =>
    (raw.type as string) === 'landscape:pond'
      ? [[raw.id, (raw as unknown as PondNode).bedSurface ?? 'silt']] : [])])
}
