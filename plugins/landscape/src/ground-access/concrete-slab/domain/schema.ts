import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { dimensions, drawnOutline } from '../../shared/schema'

export const CONCRETESLAB_KIND = 'landscape:concrete-slab'
export const ConcreteSlabNode = BaseNode.extend({
  id: objectId('concrete-slab'),
  type: nodeType(CONCRETESLAB_KIND),
  ...dimensions,
  ...drawnOutline,
  width: dimensions.width.default(4),
  depth: dimensions.depth.default(3),
  thickness: dimensions.thickness.default(0.15),
  finish: z.enum(['broom', 'exposed-aggregate', 'polished']).default('broom'),
  jointLayout: z.enum(['none', 'grid']).default('grid'),
  jointSpacing: z.number().finite().min(0.5).max(6).default(0.5),
  jointWidth: z.number().finite().min(0.002).max(0.02).default(0.01),
  edgeProfile: z.enum(['square', 'chamfered']).default('chamfered'),
  paintedMaterials: z.record(z.string(), z.object({
    material: MaterialSchema.optional(),
    materialPreset: z.string().optional(),
  })).default({}),
})
export type ConcreteSlabNode = z.infer<typeof ConcreteSlabNode>
