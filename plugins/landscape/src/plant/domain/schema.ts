import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { PLANT_PRESET_BY_KEY } from './catalog'

export const PLANT_KIND = 'landscape:plant'
export const PlantNode = BaseNode.extend({
  id: objectId('plant'),
  type: nodeType(PLANT_KIND),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).default([0, 0, 0]),
  rotation: z.tuple([z.literal(0), z.number().finite(), z.literal(0)]).default([0, 0, 0]),
  preset: z.string().refine((key) => Boolean(PLANT_PRESET_BY_KEY[key]), 'Unknown plant preset').default('fab:oak'),
  scale: z.number().min(0.1).max(5).default(1),
  density: z.number().min(0.1).max(2).default(1),
  variation: z.number().min(0).max(1).default(0.4),
  seed: z.number().int().min(0).max(99999).default(1),
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})
export type PlantNode = z.infer<typeof PlantNode>
