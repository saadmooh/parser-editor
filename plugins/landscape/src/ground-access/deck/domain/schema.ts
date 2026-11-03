import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { dimensions, drawnOutline } from '../../shared/schema'

export const DECK_KIND = 'landscape:deck'
export const DeckNode = BaseNode.extend({
  id: objectId('deck'),
  type: nodeType(DECK_KIND),
  ...dimensions,
  ...drawnOutline,
  width: dimensions.width.default(4),
  depth: dimensions.depth.default(3),
  thickness: dimensions.thickness.default(0.35),
  deckType: z.enum(['platform', 'raised']).default('platform'),
  material: z.enum(['pressure-treated', 'cedar', 'hardwood', 'composite', 'pvc']).default('cedar'),
  boardDirection: z.enum(['lengthwise', 'crosswise', 'diagonal']).default('lengthwise'),
  boardWidth: z.number().finite().min(0.09).max(0.25).default(0.14),
  boardGap: z.number().finite().min(0.003).max(0.025).default(0.008),
  boardThickness: z.number().finite().min(0.018).max(0.06).default(0.032),
  boardColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#a4774e'),
  borderStyle: z.enum(['none', 'single', 'double']).default('none'),
  borderColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#785339'),
  fascia: z.boolean().default(true),
  fasciaColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#785339'),
  frameDepth: z.number().finite().min(0.08).max(0.4).default(0.18),
  frameColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#66513f'),
  supportPosts: z.boolean().default(false),
  supportSpacing: z.number().finite().min(0.8).max(4).default(2),
  postSize: z.number().finite().min(0.07).max(0.25).default(0.12),
  postColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#66513f'),
  skirtStyle: z.enum(['none', 'solid', 'slatted']).default('none'),
  skirtColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#785339'),
  railingStyle: z.enum(['none', 'wood', 'metal', 'cable', 'glass']).default('none'),
  railingHeight: z.number().finite().min(0.3).default(1),
  railingColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#5b5046'),
  railingPostSpacing: z.number().finite().min(0.1).default(1.8),
  railingEdgeMode: z.enum(['all', 'selected']).default('all'),
  railingEdges: z.array(z.number().int().min(0)).default([]),
  paintedMaterials: z.record(z.string(), z.object({
    material: MaterialSchema.optional(),
    materialPreset: z.string().optional(),
  })).default({}),
})
export type DeckNode = z.infer<typeof DeckNode>
