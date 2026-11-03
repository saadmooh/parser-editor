import type { AnyNode } from '@pascal-app/core'

export function levelDescendants(nodes: Readonly<Record<string, AnyNode>>, levelId: string | null): AnyNode[] {
  if (!levelId) return []
  const children = new Map<string, AnyNode[]>()
  for (const node of Object.values(nodes)) {
    if (!node.parentId) continue
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node)
    children.set(node.parentId, siblings)
  }
  const result: AnyNode[] = []
  const visited = new Set([levelId])
  const queue = [...(children.get(levelId) ?? [])]
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]!
    if (visited.has(node.id)) continue
    visited.add(node.id)
    result.push(node)
    queue.push(...(children.get(node.id) ?? []))
  }
  return result
}

export function catalogMatches(label: string, category: string, query: string): boolean {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const text = `${label} ${category}`.toLocaleLowerCase()
  return words.every((word) => text.includes(word))
}
