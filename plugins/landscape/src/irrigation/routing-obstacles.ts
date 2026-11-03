import type { Point } from './ports'
export type RouteObstacle = { name: string; minX: number; maxX: number; minZ: number; maxZ: number }
/** Conservative bounds for same-level hardscape. Unknown geometry is never assumed clear. */
export function irrigationObstacles(parentId: string, nodes: Readonly<Record<string, unknown>>): RouteObstacle[] {
  return Object.values(nodes).flatMap(raw => {
    const n = raw as { type?: string; parentId?: string; visible?: boolean; name?: string; width?: number; depth?: number; position?: Point; rotation?: Point; outline?: [number, number][] }
    if (n.parentId !== parentId || !['landscape:patio', 'landscape:deck', 'landscape:concrete-slab', 'landscape:landing'].includes(n.type || '') || !n.position || !n.width || !n.depth) return []
    const outline = n.outline?.length ? n.outline : [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]
    const angle = n.rotation?.[1] || 0, c = Math.cos(angle), s = Math.sin(angle)
    const points = outline.map(p => [n.position![0] + p[0]! * n.width! * c + p[1]! * n.depth! * s, n.position![2] - p[0]! * n.width! * s + p[1]! * n.depth! * c])
    return [{ name: n.name || n.type!, minX: Math.min(...points.map(p => p[0]!)) - .25, maxX: Math.max(...points.map(p => p[0]!)) + .25, minZ: Math.min(...points.map(p => p[1]!)) - .25, maxZ: Math.max(...points.map(p => p[1]!)) + .25 }]
  })
}
export function pathHitsObstacle(path: readonly Point[], box: RouteObstacle) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, dx = b[0] - a[0], dz = b[2] - a[2]
    let from = 0, to = 1
    for (const [origin, delta, min, max] of [[a[0], dx, box.minX, box.maxX], [a[2], dz, box.minZ, box.maxZ]] as const) {
      if (Math.abs(delta) < 1e-9) { if (origin <= min || origin >= max) { from = 2; break } }
      else { const t1 = (min - origin) / delta, t2 = (max - origin) / delta; from = Math.max(from, Math.min(t1, t2)); to = Math.min(to, Math.max(t1, t2)) }
    }
    if (from <= to && from <= 1 && to >= 0) return true
  }
  return false
}
