import type { GeometryContext } from '@pascal-app/core'
import { isNaturalStoneFinish, type PathwayNode } from '../domain/schema'
import { poolCutoutsFor, type PoolCutoutSurface } from '../../shared/pool-cutouts'
import { laidPavingTiles, type PavingTile } from './laid-paving'
import { naturalStones } from './natural-stones'
import { pavingPolygons } from './paving-polygons'

/** Authored stone footprints, including joints and pool openings as empty space. */
export function pathwayStoneFootprints(node: PathwayNode, context?: GeometryContext): PavingTile[] {
  const tiles = isNaturalStoneFinish(node.finish)
    ? naturalStones(node).map(stone => ({ ...stone, border: false }))
    : laidPavingTiles(node)
  const cutouts = poolCutoutsFor(node as unknown as PoolCutoutSurface, context)
  if (!cutouts.length) return tiles
  return tiles.flatMap(tile => pavingPolygons.difference([tile.ring, ...(tile.holes ?? [])], cutouts)
    .map(polygon => ({ ...tile, ring: polygon[0] as PavingTile['ring'],
      holes: polygon.slice(1) as NonNullable<PavingTile['holes']> })))
}
