import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { dimensions } from '../../shared/schema'

export const RETAININGWALL_KIND = 'landscape:retaining-wall'
export const RetainingWallNode = BaseNode.extend({
  id: objectId('retaining-wall'),
  type: nodeType(RETAININGWALL_KIND),
  ...dimensions,
  width: dimensions.width.default(3),
  depth: dimensions.depth.default(0.25),
  thickness: dimensions.thickness.default(0.9),
  hostWallId: z.string().optional(),
  style: z.enum(['stacked-block', 'fieldstone', 'smooth']).default('stacked-block'),
  courseHeight: z.number().finite().min(0.08).max(0.6).default(0.2),
  unitLength: z.number().finite().min(0.15).max(1.5).default(0.45),
  jointWidth: z.number().finite().min(0.002).max(0.05).default(0.012),
  capEnabled: z.boolean().default(true),
  capHeight: z.number().finite().min(0.03).max(0.2).default(0.075),
  capOverhang: z.number().finite().min(0).max(0.15).default(0.055),
  paintedMaterials: z.record(z.string(), z.object({
    material: MaterialSchema.optional(),
    materialPreset: z.string().optional(),
  })).default({}),
})
export type RetainingWallNode = z.infer<typeof RetainingWallNode>
