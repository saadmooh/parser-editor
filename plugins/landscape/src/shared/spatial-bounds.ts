export type Bounds2D = { minX: number; minZ: number; maxX: number; maxZ: number }

type Positioned = { position?: readonly number[]; rotation?: number | readonly number[] }

export function worldBounds(
  points: readonly (readonly number[])[],
  node: Positioned,
  padding = 0,
): Bounds2D | null {
  if (!points.length) return null
  const yaw = typeof node.rotation === 'number' ? node.rotation : node.rotation?.[1] ?? 0
  const cosine = Math.cos(yaw), sine = Math.sin(yaw)
  const x0 = node.position?.[0] ?? 0, z0 = node.position?.[2] ?? 0
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (const point of points) {
    const x = point[0], z = point[1]
    if (x === undefined || z === undefined || !Number.isFinite(x) || !Number.isFinite(z)) return null
    const worldX = x0 + x * cosine + z * sine
    const worldZ = z0 - x * sine + z * cosine
    minX = Math.min(minX, worldX); maxX = Math.max(maxX, worldX)
    minZ = Math.min(minZ, worldZ); maxZ = Math.max(maxZ, worldZ)
  }
  return { minX: minX - padding, minZ: minZ - padding, maxX: maxX + padding, maxZ: maxZ + padding }
}

export function boundsIntersect(a: Bounds2D, b: Bounds2D) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ
}
