import type { AnyNode } from '@pascal-app/core'

export type ObjectBranch = { node: AnyNode; children: ObjectBranch[]; landscape: boolean }

/** Keep matching objects' ancestors, even when they belong to another plugin. */
export function objectHierarchy(nodes: Readonly<Record<string, AnyNode>>, levelId: string | null, matches: AnyNode[]): ObjectBranch[] {
  const included = new Map<string, AnyNode>()
  const landscapeIds = new Set(matches.map((node) => node.id as string))
  for (const match of matches) {
    const visited = new Set<string>()
    let node: AnyNode | undefined = match
    while (node && !visited.has(node.id)) {
      visited.add(node.id)
      included.set(node.id, node)
      if (node.id === levelId) break
      node = node.parentId ? nodes[node.parentId] : undefined
    }
  }
  const branches = new Map<string, ObjectBranch>([...included].map(([id, node]) => [id, { node, children: [], landscape: landscapeIds.has(id) }]))
  const roots: ObjectBranch[] = []
  for (const branch of branches.values()) {
    const parent = branch.node.parentId ? branches.get(branch.node.parentId) : undefined
    // Broken/cyclic graphs remain inspectable without recursive rendering loops.
    const visited = new Set<string>([branch.node.id])
    let ancestor = parent
    let cyclic = false
    while (ancestor) {
      if (visited.has(ancestor.node.id)) { cyclic = true; break }
      visited.add(ancestor.node.id)
      ancestor = ancestor.node.parentId ? branches.get(ancestor.node.parentId) : undefined
    }
    if (parent && !cyclic && branch.node.id !== levelId) parent.children.push(branch)
    else roots.push(branch)
  }
  return roots
}
