import type { AnyNode } from '@pascal-app/core'

/** Cached ancestor visibility for one immutable scene snapshot. Cycles are hidden. */
export function sceneVisibility(sceneNodes: Readonly<Record<string, AnyNode>>) {
  const visibility = new Map<string, boolean>()
  const isVisible = (node: AnyNode) => {
    const cached = visibility.get(node.id)
    if (cached !== undefined) return cached
    const visited = new Set<string>()
    let current: AnyNode | undefined = node
    let visible = true
    while (current) {
      const known = visibility.get(current.id)
      if (known !== undefined) { visible = known; break }
      if (visited.has(current.id) || current.visible === false) { visible = false; break }
      visited.add(current.id)
      current = current.parentId ? sceneNodes[current.parentId] : undefined
    }
    for (const id of visited) visibility.set(id, visible)
    return visible
  }
  return isVisible
}
