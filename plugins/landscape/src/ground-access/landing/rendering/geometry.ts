import type { GeometryContext } from '@pascal-app/core'
import type { LandingNode } from '../domain/schema'
import { buildAccessFloorplan, buildAccessGeometry } from '../../shared/geometry'
import { applyLandscapePaintedMaterials } from '../../shared/paint'

export const buildLandingGeometry = (node: LandingNode, ctx?: GeometryContext) => {
  const group = buildAccessGeometry(node, 'landing', ctx)
  applyLandscapePaintedMaterials(group, node.paintedMaterials, () => 'surface')
  return group
}
export const buildLandingFloorplan = (node: LandingNode, ctx: GeometryContext) =>
  buildAccessFloorplan(node, 'landing', ctx)
