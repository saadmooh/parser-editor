import { normalizeOutline, validateOutline } from './polygon'
import type { Point } from './schema'

export function groundAreaEditPatch(outline: Point[]) {
  const points = normalizeOutline(outline)
  if (validateOutline(points)) return null
  const rectangle = points.length === 4 && points.every((point, index) => {
    const next = points[(index + 1) % points.length]!
    return Math.abs(point[0] - next[0]) < 0.001 || Math.abs(point[1] - next[1]) < 0.001
  })
  return { curvePoints: undefined, outline: points, shape: rectangle ? 'rectangle' as const : 'custom' as const }
}
