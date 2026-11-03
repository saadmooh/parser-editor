import type { Point } from './schema'

const ANGLE_STEP = Math.PI / 12

/** Match Streetscape's 15-degree angle ray with distance quantized on the ray. */
export function snapAlongAngle(from: Point, point: Point, step: number): Point {
  const dx = point[0] - from[0], dz = point[1] - from[1]
  if (dx === 0 && dz === 0) return from
  const angle = Math.round(Math.atan2(dz, dx) / ANGLE_STEP) * ANGLE_STEP
  const x = Math.cos(angle), z = Math.sin(angle)
  const projected = dx * x + dz * z
  const length = step > 0 ? Math.round(projected / step) * step : projected
  return [from[0] + x * length, from[1] + z * length]
}

/** Keep the first leg normal to a hardscape edge when it starts on that edge. */
export function projectToEdgeNormal(from: Point, point: Point, edgeDirection: Point): Point {
  const nx = -edgeDirection[1], nz = edgeDirection[0]
  const dx = point[0] - from[0], dz = point[1] - from[1]
  const distance = dx * nx + dz * nz
  return [from[0] + nx * distance, from[1] + nz * distance]
}
