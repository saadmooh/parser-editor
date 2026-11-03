import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { dimensions, drawnOutline } from '../ground-access/shared/schema'

export const POND_KIND = 'landscape:pond'
export const PondNode = BaseNode.extend({
  id: objectId('pond'), type: nodeType(POND_KIND),
  ...dimensions, ...drawnOutline,
  shape: drawnOutline.shape.default('oval'),
  width: dimensions.width.default(5), depth: dimensions.depth.default(3.5),
  // Thickness is the bank's height, used by the shared drawing preview.
  thickness: z.number().finite().min(0.03).max(0.5).default(0.12),
  // Offset above the landscape ground beneath the pond (or level datum).
  elevation: z.number().finite().min(-20).max(20).default(0),
  basinDepth: z.number().finite().min(0.15).max(3).default(0.8),
  waterDrop: z.number().finite().min(0).max(0.12).default(0.04),
  bankWidth: z.number().finite().min(0.08).max(1.5).default(0.35),
  bank: z.enum(['stone', 'gravel']).default('stone'),
  rockBorder: z.enum(['stone', 'clusters', 'continuous', 'none']).default('stone'),
  rockBorderPlacement: z.enum(['shoreline', 'outer', 'both']).default('shoreline'),
  rockBorderSize: z.number().finite().min(0.15).max(1.5).default(0.4),
  rockBorderGap: z.number().finite().min(0).max(0.5).default(0.20),
  rockBorderVariation: z.number().finite().min(0).max(1).default(0.25),
  rockBorderSeed: z.number().int().min(0).max(999999).default(49212),
  rockBorderShape: z.enum(['mixed', 'rounded', 'angular']).default('mixed'),
  rockBorderShapeVariation: z.number().finite().min(0).max(1).default(0.65),
  rockBorderHeightVariation: z.number().finite().min(0).max(1).default(0.55),
  rockBorderPositionVariation: z.number().finite().min(0).max(1).default(0.45),
  rockBorderRotationVariation: z.number().finite().min(0).max(1).default(0.75),
  rockBorderColorVariation: z.number().finite().min(0).max(1).default(0.35),
  rockBorderMoss: z.number().finite().min(0).max(1).default(0.45),
  bedSurface: z.enum(['silt', 'sand', 'gravel', 'river-stone', 'algae']).default('silt'),
  waterColor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#328e92'),
  rippleStrength: z.number().finite().min(0).max(1).default(0.35),
  waterPreset: z.enum(['natural', 'glass', 'cinematic', 'playful', 'custom']).default('natural'),
  waterClarity: z.number().finite().min(.5).max(2).default(1.3),
  reflectionStrength: z.number().finite().min(0).max(1).default(1),
  refractionStrength: z.number().finite().min(0).max(1.6).default(1),
  sunGlints: z.number().finite().min(0).max(2).default(1),
  underwaterLight: z.number().finite().min(0).max(1.8).default(.55),
  waveSpeed: z.number().finite().min(.5).max(1.6).default(1),
  waveSettling: z.number().finite().min(.4).max(2).default(1),
  rain: z.number().finite().min(0).max(1).default(0),
  fishType: z.enum(['mixed', 'koi', 'goldfish', 'carp', 'perch', 'trout']).default('mixed'),
  fishCount: z.number().int().min(0).max(24).default(0),
  fishSize: z.number().finite().min(.15).max(.8).default(.45),
  fishResponse: z.number().finite().min(0).max(2).default(1),
  animated: z.boolean().default(true),
})
export type PondNode = z.infer<typeof PondNode>
