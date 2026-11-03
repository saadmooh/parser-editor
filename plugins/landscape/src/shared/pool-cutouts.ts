import type { AnyNode, AnyNodeId, GeometryContext } from '@pascal-app/core'
import polygonClipping, { type MultiPolygon } from 'polygon-clipping'
import { pavingPolygons } from '../pathways/rendering/paving-polygons'
import { worldBounds } from './spatial-bounds'

type Point = [number, number]
type Positioned = { position?: [number, number, number]; rotation?: number | [number, number, number] }
export type PoolCutoutSurface = Positioned & { id: string; type: string; parentId: string | null; visible?: boolean }
type CutoutPool = PoolCutoutSurface & {
  polygon?: Point[]; length?: number; width?: number; shellThickness?: number
  openingClearance?: number; copingWidth?: number; copingStyle?: string; copingProfile?: string
}

function yaw(node: Positioned) {
  return typeof node.rotation === 'number' ? node.rotation : node.rotation?.[1] ?? 0
}

export function isWaterOpening(value: unknown): boolean {
  const type = (value as { type?: string } | undefined)?.type
  return type === 'pool:pool'
}

function openingOutline(pool: CutoutPool): Point[] {
  return pool.polygon?.length && pool.polygon.length >= 3 ? pool.polygon : [
    [-(pool.length ?? 8) / 2, -(pool.width ?? 4) / 2], [(pool.length ?? 8) / 2, -(pool.width ?? 4) / 2],
    [(pool.length ?? 8) / 2, (pool.width ?? 4) / 2], [-(pool.length ?? 8) / 2, (pool.width ?? 4) / 2],
  ]
}

function poolCutoutMargin(pool: CutoutPool) {
  const copingOverhang = pool.copingStyle === 'rock' ? 0.04
    : pool.copingStyle === 'natural-stone' ? 0.02
      : pool.copingProfile === 'bullnose' ? 0.04
        : pool.copingProfile === 'chamfered' ? 0.025 : 0.008
  return Math.max(
    (pool.shellThickness ?? 0) + (pool.openingClearance ?? 0.02),
    (pool.copingWidth ?? 0) + copingOverhang,
  ) + 0.005
}

/** Only properties that change the landscape opening belong in this signature. */
export function poolCutoutSignature(value: unknown): string | null {
  const pool = value as CutoutPool | null | undefined
  if (!pool || !isWaterOpening(pool) || pool.visible === false || !pool.parentId) return null
  return JSON.stringify([
    pool.parentId, pool.position?.[0] ?? 0, pool.position?.[2] ?? 0, yaw(pool),
    openingOutline(pool),
    poolCutoutMargin(pool),
  ])
}

export function poolCutoutWorldBounds(value: unknown) {
  const pool = value as CutoutPool | null | undefined
  if (!poolCutoutSignature(pool) || !pool) return null
  const outline = openingOutline(pool)
  return worldBounds(outline, pool, poolCutoutMargin(pool) + 0.05)
}

/** Pool footprints expressed in the local coordinate system of another surface. */
export function poolCutoutsFor(node: PoolCutoutSurface, ctx?: GeometryContext): MultiPolygon {
  const candidates = ctx?.sceneNodes
    ? Object.values(ctx.sceneNodes)
    : ctx?.parent && 'children' in ctx.parent && Array.isArray(ctx.parent.children)
      ? ctx.parent.children.map((id) => ctx.resolve(id as AnyNodeId)).filter((value): value is AnyNode => Boolean(value))
      : []
  const result: MultiPolygon = []
  for (const rawCandidate of candidates) {
    const candidate = rawCandidate as unknown as CutoutPool
    if (!isWaterOpening(candidate) || candidate.visible === false || candidate.parentId !== node.parentId) continue
    const pool = candidate
    const outline = openingOutline(pool)
    if (outline.length < 3) continue
    const poolYaw = yaw(pool), surfaceYaw = yaw(node)
    const world = outline.map(([x, z]): Point => [
      (pool.position?.[0] ?? 0) + x * Math.cos(poolYaw) + z * Math.sin(poolYaw),
      (pool.position?.[2] ?? 0) - x * Math.sin(poolYaw) + z * Math.cos(poolYaw),
    ])
    const margin = poolCutoutMargin(pool)
    const local = world.map(([x, z]): Point => {
      const dx = x - (node.position?.[0] ?? 0), dz = z - (node.position?.[2] ?? 0)
      return [dx * Math.cos(surfaceYaw) - dz * Math.sin(surfaceYaw), dx * Math.sin(surfaceYaw) + dz * Math.cos(surfaceYaw)]
    })
    // Cut paving beyond the visible coping, not just the shell. Otherwise a
    // flush pool and patio render overlapping surfaces around the rim.
    const expanded = margin > 0 ? pavingPolygons.inset([[local]], -margin) : [[local]]
    result.push(...expanded)
  }
  return result
}

export function subtractPoolCutouts(outline: MultiPolygon, node: PoolCutoutSurface, ctx?: GeometryContext): MultiPolygon {
  const cutouts = poolCutoutsFor(node, ctx)
  return cutouts.length && outline.length ? polygonClipping.difference(outline, ...cutouts) : outline
}
