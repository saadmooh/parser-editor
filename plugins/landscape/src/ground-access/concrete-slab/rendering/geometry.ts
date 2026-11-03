import type { GeometryContext } from '@pascal-app/core'
import type { ConcreteSlabNode } from '../domain/schema'
import { buildAccessFloorplan, buildAccessGeometry } from '../../shared/geometry'
import { applyLandscapePaintedMaterials } from '../../shared/paint'

export const buildConcreteSlabGeometry = (node: ConcreteSlabNode, ctx?: GeometryContext) => {
  const group = buildAccessGeometry(node, 'concrete-slab', ctx)
  applyLandscapePaintedMaterials(group, node.paintedMaterials, () => 'surface')
  return group
}
export const buildConcreteSlabFloorplan = (node: ConcreteSlabNode, ctx: GeometryContext) =>
  buildAccessFloorplan(node, 'concrete-slab', ctx)
