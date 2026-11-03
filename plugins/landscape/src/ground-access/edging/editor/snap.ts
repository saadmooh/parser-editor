import { useScene } from '@pascal-app/core'
import { clearSlabSnapFeedback, resolveSlabPlanPointSnap, useWallSnapIndicator } from '@pascal-app/editor'
import { EDGING_KIND, EdgingNode } from '../domain/schema'
import { levelPoints, type Point } from '../domain/route'
import { snapToHardscape } from '../../shared/hardscape-snap'

export { clearSlabSnapFeedback as clearEdgingSnapFeedback }

export function resolveEdgingSnap(rawPoint: Point, fallbackPoint: Point, levelId: string | null,
  excludeId?: string): Point {
  let nearest: Point | null = null
  let distance = 0.25
  for (const raw of Object.values(useScene.getState().nodes)) {
    if ((raw.type as string) !== EDGING_KIND || raw.id === excludeId ||
      raw.parentId !== levelId || raw.visible === false) continue
    const node = EdgingNode.parse(raw)
    if (node.closed || node.points.length < 2) continue
    const points = levelPoints(node)
    for (const point of [points[0]!, points.at(-1)!]) {
      const candidate = Math.hypot(rawPoint[0] - point[0], rawPoint[1] - point[1])
      if (candidate < distance) { nearest = point; distance = candidate }
    }
  }
  if (nearest) {
    clearSlabSnapFeedback()
    useWallSnapIndicator.getState().set({ x: nearest[0], z: nearest[1], kind: 'endpoint' })
    return nearest
  }
  const hardscape = snapToHardscape(rawPoint, useScene.getState().nodes,
    levelId ?? '', excludeId, 0.24)
  if (hardscape) {
    clearSlabSnapFeedback()
    useWallSnapIndicator.getState().set({ x: hardscape.point[0], z: hardscape.point[1],
      kind: hardscape.kind === 'vertex' ? 'endpoint' : 'wall' })
    return hardscape.point
  }
  const result = resolveSlabPlanPointSnap({ rawPoint, fallbackPoint, levelId,
    excludeId })
  if (!result.wallSnap && result.guides.length) {
    useWallSnapIndicator.getState().set({ x: result.point[0], z: result.point[1], kind: 'intersection' })
  }
  return result.point
}
