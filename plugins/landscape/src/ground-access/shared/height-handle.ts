import type { HandleDescriptor } from '@pascal-app/core'
import { ShapeUtils, Vector2 } from 'three'
import { isCurvedSurface, surfaceOutline, type DrawnSurface } from './outline'

function surfaceHandlePoint(node: DrawnSurface): [number, number] {
  if (node.shape === 'rectangle' || isCurvedSurface(node.shape)) return [0, 0]
  const points = surfaceOutline(node)
  const triangles = ShapeUtils.triangulateShape(
    points.map(([x, z]) => new Vector2(x, z)), [])
  let bestArea = 0
  let best: [number, number] = [0, 0]
  for (const [aIndex, bIndex, cIndex] of triangles) {
    const a = points[aIndex!]!, b = points[bIndex!]!, c = points[cIndex!]!
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) -
      (b[1] - a[1]) * (c[0] - a[0]))
    if (area <= bestArea) continue
    bestArea = area
    best = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]
  }
  return best
}

export function surfaceHeightHandle<N extends DrawnSurface>(
  minimum: (node: N) => number = () => 0.03,
): HandleDescriptor<N> {
  return {
    kind: 'linear-resize', axis: 'y', anchor: 'min',
    min: (node) => minimum(node), max: 2,
    currentValue: (node) => node.thickness,
    apply: (node, value) => ({ thickness: Math.max(minimum(node), value) }) as Partial<N>,
    placement: { position: (node) => {
      const [x, z] = surfaceHandlePoint(node)
      return [x, node.thickness + 0.25, z]
    } },
  }
}
