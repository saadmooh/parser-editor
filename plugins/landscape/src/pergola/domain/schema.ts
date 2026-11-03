import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

export const PERGOLA_KIND = 'landscape:pergola'
export const DEFAULT_ROOF_RISE = 0.79
export const DEFAULT_ARCH_DROP = 0.2
export const DEFAULT_ARCH_RISE = 0.42
const metres = (min: number, max: number, value: number) =>
  z.number().finite().min(min).max(max).default(value)
const color = (value: string) =>
  z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default(value)

export const PergolaNode = BaseNode.extend({
  id: objectId('pergola'),
  type: nodeType(PERGOLA_KIND),
  position: z
    .tuple([z.number().finite(), z.number().finite(), z.number().finite()])
    .default([0, 0, 0]),
  rotation: z
    .tuple([z.literal(0), z.number().finite(), z.literal(0)])
    .default([0, 0, 0]),
  supportSlabId: z.string().nullable().optional(),
  /** Landscape surface whose top elevation carries this pergola. */
  supportSurfaceId: z.string().nullable().optional(),
  width: metres(1.5, 10, 4),
  depth: metres(1.5, 8, 3),
  height: metres(1.8, 4, 2.4),
  backHeight: metres(1.8, 4, 2.0),
  roofForm: z.enum(['flat', 'single-slope', 'gable', 'curved']).default('single-slope'),
  roofRise: metres(0.2, 1.5, DEFAULT_ROOF_RISE),
  gableArch: z.boolean().default(true),
  gableArchDrop: metres(0.2, 0.7, DEFAULT_ARCH_DROP),
  gableArchCurve: metres(0.05, 0.5, DEFAULT_ARCH_RISE),
  archMode: z.enum(['none', 'front', 'back', 'both']).optional(),
  archStyle: z.enum(['segmental', 'rounded', 'pointed']).default('segmental'),
  archDepth: metres(0.08, 0.35, 0.16),
  postStyle: z
    .enum(['square', 'chamfered', 'round', 'tapered'])
    .default('square'),
  postShaftProfile: z.enum(['straight', 'bulged', 'hourglass']).default('straight'),
  postTaper: metres(0.05, 0.45, 0.24),
  postBulge: metres(0.02, 0.3, 0.12),
  postDetailStyle: z
    .enum([
      'plain',
      'boxed-base',
      'twin-bands',
      'faceted-base',
      'crown',
      'ringed',
      'pedestal',
      'flared-base',
      'stepped-cap',
    ])
    .default('plain'),
  leftPostInset: metres(0, 0.4, 0),
  rightPostInset: metres(0, 0.4, 0),
  frontPostInset: metres(0, 0.4, 0),
  backPostInset: metres(0, 0.4, 0),
  postSize: metres(0.08, 0.3, 0.16),
  postBaseStyle: z
    .enum(['none', 'simple-square', 'square-plinth', 'stepped-square', 'round-rings', 'panelled-pedestal', 'steel-shoe', 'stepped-plinth', 'round-plinth'])
    .default('square-plinth'),
  postBaseWidth: metres(0.12, 0.6, 0.25),
  postBaseHeight: metres(0.04, 0.4, 0.18),
  beamWidth: metres(0.08, 0.3, 0.16),
  beamHeight: metres(0.12, 0.4, 0.24),
  rafterWidth: metres(0.04, 0.12, 0.065),
  rafterHeight: metres(0.08, 0.25, 0.16),
  rafterSpacing: metres(0.2, 0.8, 0.45),
  overhang: metres(0, 0.6, 0.25),
  sideOverhang: z.number().finite().min(0).max(0.6).optional(),
  endOverhang: z.number().finite().min(0).max(0.6).optional(),
  memberEndStyle: z.enum(['square', 'beveled', 'curved']).default('square'),
  memberEndCut: metres(0.01, 0.12, 0.04),
  roofLayout: z.enum(['rafters', 'slatted', 'grid']).optional(),
  shadeSlats: z.boolean().default(true),
  slatSpacing: metres(0.1, 0.4, 0.18),
  slatWidth: metres(0.03, 0.12, 0.045),
  slatHeight: metres(0.025, 0.12, 0.035),
  gridCrossSpacing: metres(0.2, 1.2, 0.55),
  gridCrossWidth: metres(0.04, 0.2, 0.09),
  gridCrossHeight: metres(0.04, 0.2, 0.1),
  gridTopLayer: z.enum(['cross', 'rafters']).default('cross'),
  braces: z.boolean().default(true),
  braceStyle: z.enum(['diagonal', 'arched', 'swept', 'curved-bracket']).default('diagonal'),
  braceCurve: metres(0.15, 0.85, 0.55),
  braceThickness: metres(0.04, 0.16, 0.08),
  braceReach: metres(0.25, 0.9, 0.55),
  braceDrop: metres(0.2, 0.9, 0.55),
  sideScreens: z.enum(['none', 'left', 'right', 'both']).default('none'),
  screenStyle: z.enum(['horizontal-slats', 'vertical-slats', 'solid']).default('horizontal-slats'),
  screenHeight: metres(0.5, 2.5, 1.5),
  screenSlatWidth: metres(0.04, 0.2, 0.09),
  screenSlatGap: metres(0.02, 0.2, 0.055),
  finish: z.enum(['timber', 'metal']).default('timber'),
  postColor: color('#986b43'),
  beamColor: color('#af8054'),
  roofColor: color('#c49768'),
  paintedMaterials: z
    .record(
      z.string(),
      z.object({
        material: MaterialSchema.optional(),
        materialPreset: z.string().optional(),
      }),
    )
    .default({}),
})
export type PergolaNode = z.infer<typeof PergolaNode>
