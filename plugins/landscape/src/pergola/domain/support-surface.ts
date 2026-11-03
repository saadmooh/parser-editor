import type { AnyNode } from '@pascal-app/core'
import { surfaceOutline } from '../../ground-access/shared/outline'
import type { PergolaNode } from './schema'

export const PERGOLA_SUPPORT_SURFACE_KINDS = new Set([
  'landscape:ground-area',
  'landscape:patio',
  'landscape:deck',
  'landscape:concrete-slab',
  'landscape:landing',
])

// A small gap keeps the foot plates above paving and deck boards.
export const PERGOLA_SUPPORT_CLEARANCE = 0.01

type Point = [number, number]
type SurfaceLike = {
  id: string
  type?: unknown
  parentId?: string | null
  visible?: boolean
  position?: [number, number, number]
  rotation?: unknown
  shape?: string
  outline?: Point[]
  width?: number
  depth?: number
  thickness?: number
  elevation?: number
  slopePercent?: number
  drainDirection?: string
}

export type SupportPose = { x: number; z: number; yaw: number }

export function pergolaSupportPose(surface: SurfaceLike): SupportPose {
  const rotation = surface.rotation
  return {
    x: surface.position?.[0] ?? 0,
    z: surface.position?.[2] ?? 0,
    yaw: Array.isArray(rotation) ? Number(rotation[1] ?? 0) : Number(rotation ?? 0),
  }
}

export function pergolaPointOnSupport(surface: SurfaceLike, point: Point): Point {
  const position = surface.position ?? [0, 0, 0]
  const rawRotation = surface.rotation
  const angle = Array.isArray(rawRotation) ? Number(rawRotation[1] ?? 0) : Number(rawRotation ?? 0)
  const dx = point[0] - position[0]
  const dz = point[1] - position[2]
  return [dx * Math.cos(angle) - dz * Math.sin(angle),
    dx * Math.sin(angle) + dz * Math.cos(angle)]
}

export function pergolaPointFromSupport(surface: SurfaceLike, point: Point): Point {
  const { x, z, yaw } = pergolaSupportPose(surface)
  const c = Math.cos(yaw), s = Math.sin(yaw)
  return [x + c * point[0] + s * point[1], z - s * point[0] + c * point[1]]
}

function containsPoint(outline: Point[], [x, z]: Point): boolean {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!
    if ((a[1] > z) !== (b[1] > z) &&
      x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function surfaceContains(surface: SurfaceLike, point: Point): boolean {
  const local = pergolaPointOnSupport(surface, point)
  if (String(surface.type) === 'landscape:ground-area')
    return (surface.outline?.length ?? 0) >= 3 && containsPoint(surface.outline!, local)
  if (!surface.width || !surface.depth) return false
  return containsPoint(surfaceOutline(surface as Parameters<typeof surfaceOutline>[0]), local)
}

/** Walking face at the pergola's level-local XZ, including patio paving. */
export function pergolaSupportSurfaceTop(surface: SurfaceLike, point?: Point): number {
  const kind = String(surface.type)
  const base = (surface.position?.[1] ?? 0) + (surface.elevation ?? 0)
  if (kind === 'landscape:ground-area') return base + 0.018 + PERGOLA_SUPPORT_CLEARANCE
  let top = base + (surface.thickness ?? 0)
  if (kind === 'landscape:patio') {
    top += Math.min(0.045, (surface.thickness ?? 0) / 3)
    if (point && surface.slopePercent) {
      const [x, z] = pergolaPointOnSupport(surface, point)
      const slope = surface.slopePercent / 100
      switch (surface.drainDirection) {
        case 'front': top += slope * z; break
        case 'back': top -= slope * z; break
        case 'left': top += slope * x; break
        case 'right': top -= slope * x; break
      }
    }
  }
  return top + PERGOLA_SUPPORT_CLEARANCE
}

/** Select the highest eligible surface under the pergola centre. */
export function findPergolaSupportSurface(
  pergola: PergolaNode,
  nodes: Record<string, AnyNode>,
  preferredId?: string,
  pointerElevation?: number,
): SurfaceLike | undefined {
  const point: Point = [pergola.position[0], pergola.position[2]]
  const candidates = Object.values(nodes).map((node) => node as unknown as SurfaceLike)
    .filter((surface) => PERGOLA_SUPPORT_SURFACE_KINDS.has(String(surface.type)) &&
      surface.parentId === pergola.parentId && surface.visible !== false &&
      surfaceContains(surface, point) &&
      (surface.id === preferredId || pointerElevation === undefined ||
        pergolaSupportSurfaceTop(surface, point) <= pointerElevation + 0.08))
  const preferred = preferredId ? candidates.find((surface) => surface.id === preferredId) : undefined
  return preferred ?? candidates.sort((a, b) =>
    pergolaSupportSurfaceTop(b, point) - pergolaSupportSurfaceTop(a, point))[0]
}
