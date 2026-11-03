import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { curvePointsSchema } from '../../../ground-areas/domain/freehand-curve'
import { dimensions } from '../../shared/schema'

export const EDGING_KIND = 'landscape:edging'
export const edgingProfiles = ['flush', 'low', 'raised', 'mowing-strip'] as const
export const edgingLayouts = ['continuous', 'separated', 'woven'] as const
export const edgingForms = ['strip', 'pavers', 'stone', 'square-posts', 'round-posts', 'capped-wall'] as const
const point = z.tuple([z.number().finite(), z.number().finite()])
export const EdgingNode = BaseNode.extend({
  id: objectId('edging'),
  type: nodeType(EDGING_KIND),
  ...dimensions,
  width: dimensions.width.default(3),
  // Shared dimensions enforce a 20 cm minimum; keep defaults valid at creation.
  depth: dimensions.depth.default(0.3),
  thickness: dimensions.thickness.default(0.18),
  profile: z.enum(edgingProfiles).default('low'),
  form: z.enum(edgingForms).default('pavers'),
  postHeightPattern: z.enum(['even', 'staggered']).default('even'),
  capOverhang: z.number().finite().min(0).max(0.3).default(0.06),
  capThickness: z.number().finite().min(0.02).max(0.3).default(0.07),
  layout: z.enum([...edgingLayouts, 'blocks', 'soldier-course', 'stones'])
    .transform((layout) => layout === 'blocks' || layout === 'soldier-course' || layout === 'stones'
      ? 'separated' as const : layout)
    .default('separated'),
  drawMode: z.enum(['straight', 'curve', 'freehand']).default('straight'),
  paintedMaterials: z.record(z.string(), z.object({
    material: MaterialSchema.optional(),
    materialPreset: z.string().optional(),
  })).default({}),
  unitLength: z.number().finite().min(0.05).max(2).default(0.3),
  jointWidth: z.number().finite().min(0).max(0.1).default(0.012),
  irregularity: z.number().finite().min(0).max(1).default(0.2),
  points: z.array(point).default([]),
  curvePoints: curvePointsSchema,
  tangents: z.array(point.nullable()).optional(),
  closed: z.boolean().default(false),
})
export type EdgingNode = z.infer<typeof EdgingNode>
