import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { curvePointsSchema } from './freehand-curve'

export const GROUND_AREA_KIND = 'landscape:ground-area'

const point = z.tuple([z.number().finite(), z.number().finite()])
export type Point = z.infer<typeof point>

export const GROUND_SURFACES = [
  'grass',
  'grass2',
  'soil',
  'mulch',
  'gravel',
  'sand',
  'mud',
] as const
export type GroundSurface = (typeof GROUND_SURFACES)[number]

export const grass2SettingsSchema = z.object({
  mode: z.enum(['blades', 'billboards']).default('blades'),
  lighting: z.boolean().default(true),
  density: z.number().finite().min(0.15).max(2).default(1),
  height: z.number().finite().min(0.35).max(2).default(1),
  flowers: z.boolean().default(true),
  flowerDensity: z.number().finite().min(0).max(1).default(0.6),
  flowerMix: z.enum(['mixed', 'clover', 'dandelion', 'wildflowers']).default('mixed'),
  wind: z.number().finite().min(0).max(1).default(0.55),
  seed: z.number().int().min(0).max(100000).default(1),
})
export type Grass2Settings = z.infer<typeof grass2SettingsSchema>

export const GroundAreaNode = BaseNode.extend({
  children: z.array(z.string()).default([]),
  id: objectId('ground-area'),
  type: nodeType(GROUND_AREA_KIND),
  // The editor initializes the tool before the first point exists. Placement
  // validates that completed areas have at least three points.
  outline: z
    .array(point)
    .refine((points) => points.length === 0 || points.length >= 3, {
      message: 'A ground area needs at least three outline points.',
    })
    .default([]),
  shape: z.enum(['rectangle', 'custom', 'freehand', 'circle', 'oval']).default('rectangle'),
  curvePoints: curvePointsSchema,
  surface: z.enum(GROUND_SURFACES).default('grass'),
  plantingBed: z.boolean().default(false),
  mulchDepth: z.number().finite().min(0.01).max(0.5).default(0.075),
  mulchBagLitres: z.number().finite().min(1).max(1000).default(50),
  grass2Settings: grass2SettingsSchema.default(() => grass2SettingsSchema.parse({})),
  elevation: z.number().finite().min(-100).max(100).default(0),
  paintedMaterials: z.record(z.string(), z.object({
    material: MaterialSchema.optional(),
    materialPreset: z.string().optional(),
  })).default({}),
})
export type GroundAreaNode = z.infer<typeof GroundAreaNode>
