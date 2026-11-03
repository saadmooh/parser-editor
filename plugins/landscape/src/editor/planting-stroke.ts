export type StrokePoint = readonly [number, number]

export function strokeSamples(from: StrokePoint, to: StrokePoint, spacing: number, limit: number): [number, number][] {
  if (!Number.isFinite(spacing) || spacing <= 0) return []
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1])
  const count = Math.min(Math.floor(distance / spacing), Math.max(0, limit))
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 1) * spacing / distance
    return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio]
  })
}

export function distanceToStroke(point: StrokePoint, from: StrokePoint, to: StrokePoint) {
  const dx = to[0] - from[0], dz = to[1] - from[1]
  const squared = dx * dx + dz * dz
  const t = squared ? Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) / squared)) : 0
  return Math.hypot(point[0] - from[0] - dx * t, point[1] - from[1] - dz * t)
}
