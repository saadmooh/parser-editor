import { type Object3D, Vector3 } from 'three'

type DrawingPosition = {
  localPosition: readonly [number, number, number]
  position: readonly [number, number, number]
  node?: unknown
}

/** Grid coordinates already belong to the level; object hits belong to the hit mesh. */
export function groundDrawingPosition(event: DrawingPosition, level?: Object3D): Vector3 {
  const point = new Vector3(...event.localPosition)
  if ('node' in event) {
    point.set(...event.position)
    if (level) {
      level.updateWorldMatrix(true, false)
      level.worldToLocal(point)
    }
  }
  return point
}
