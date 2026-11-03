import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { dimensions, drawnOutline } from '../../shared/schema'

export const PATIO_KIND = 'landscape:patio'
export const PatioNode = BaseNode.extend({
  id: objectId('patio'),
  type: nodeType(PATIO_KIND),
  ...dimensions,
  width: dimensions.width.default(4),
  depth: dimensions.depth.default(3),
  // Outline coordinates are fractions of width/depth around the node centre.
  // An empty outline keeps older rectangular patios readable.
  ...drawnOutline,
  thickness: dimensions.thickness.default(0.12),
  elevation: z.number().finite().min(-2).max(2).default(0),
  slopePercent: z.number().finite().min(0).max(5).default(0),
  drainDirection: z.enum(['front', 'back', 'left', 'right']).default('front'),
  finish: z.enum(['concrete', 'stone', 'brick']).default('stone'),
  pattern: z.enum(['grid', 'running-bond']).default('running-bond'),
  paverWidth: z.number().finite().min(0.2).max(2).default(0.6),
  paverDepth: z.number().finite().min(0.2).max(2).default(0.4),
  jointWidth: z.number().finite().min(0.003).max(0.04).default(0.012),
  borderStyle: z.enum(['none', 'contrast']).default('contrast'),
  borderWidth: z.number().finite().min(0.08).max(0.6).default(0.16),
  fieldColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#b8aa93'),
  borderColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#8d806e'),
  paintedMaterials: z.record(z.string(), z.object({
    material: MaterialSchema.optional(),
    materialPreset: z.string().optional(),
  })).default({}),
})
export type PatioNode = z.infer<typeof PatioNode>
