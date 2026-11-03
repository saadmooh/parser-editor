import { BaseNode, MaterialSchema, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

export const PATHWAY_KIND = 'landscape:pathway'
export const pathwayFinishes = ['concrete', 'brick', 'stone', 'gravel', 'laidStone', 'concreteSlabs', 'grassFlagstones', 'riverStones', 'steppingStones'] as const
export type PathwayFinish = (typeof pathwayFinishes)[number]
export const naturalStoneFinishes = ['grassFlagstones', 'riverStones', 'steppingStones'] as const
export type NaturalStoneFinish = (typeof naturalStoneFinishes)[number]
export const isNaturalStoneFinish = (finish: PathwayFinish): finish is NaturalStoneFinish =>
  (naturalStoneFinishes as readonly string[]).includes(finish)
export const pathwayBorderStyles = ['none', 'stone', 'smooth'] as const
export type PathwayBorderStyle = (typeof pathwayBorderStyles)[number]
export const pathwayEdgeProfiles = ['sharp', 'soft', 'rounded'] as const
export type PathwayEdgeProfile = (typeof pathwayEdgeProfiles)[number]
export type PathwayCorner = 'round' | 'square'
export const STONE_LAYOUT_DEFAULTS = { length: 0.29, joint: 0.03, variation: 0.25 } as const
const point = z.tuple([z.number().finite(), z.number().finite()])
export type Point = z.infer<typeof point>
const vertex = z.object({ id: z.string(), point, elevationOffset: z.number().finite().min(-100).max(100).optional(), curveMode: z.enum(['smooth', 'corner']).optional() })
const edge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  controls: z.tuple([point, point]).optional(),
  shape: z.enum(['straight', 'spline']).optional(),
  width: z.number().finite().min(0.3).max(10),
})
export type PathVertex = z.infer<typeof vertex>
export type PathEdge = z.infer<typeof edge>
export type PathGraph = { vertices: PathVertex[]; edges: PathEdge[] }

export const PathwayNode = BaseNode.extend({
  id: objectId('pathway'),
  type: nodeType(PATHWAY_KIND),
  vertices: z.array(vertex).default([]),
  edges: z.array(edge).default([]),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#c2b7a3'),
  defaultWidth: z.number().finite().min(0.3).max(10).default(1.2),
  thickness: z.number().finite().min(0.02).max(0.5).default(0.08),
  elevation: z.number().finite().min(-100).max(100).default(0),
  finish: z.preprocess((value) => value === 'curvedCobbles' ? 'riverStones' : value,
    z.enum(pathwayFinishes).default('concrete')),
  borderStyle: z.enum(pathwayBorderStyles).default('stone'),
  stoneEdge: z.enum(pathwayEdgeProfiles).default('soft'),
  borderEdge: z.enum(pathwayEdgeProfiles).default('soft'),
  stoneLength: z.number().finite().min(0.18).max(0.6).default(STONE_LAYOUT_DEFAULTS.length),
  stoneJoint: z.number().finite().min(0.015).max(0.06).default(STONE_LAYOUT_DEFAULTS.joint),
  stoneVariation: z.number().finite().min(0).max(1).default(STONE_LAYOUT_DEFAULTS.variation),
  naturalStoneSize: z.number().finite().min(0.15).max(1.5).optional(),
  naturalStoneGap: z.number().finite().min(0.015).max(0.5).optional(),
  naturalStoneIrregularity: z.number().finite().min(0).max(1).default(0.45),
  naturalStoneShade: z.number().finite().min(0).max(1).default(0.4),
  naturalStoneSeed: z.number().int().min(0).max(9999).default(1),
  cornerStyle: z.enum(['round', 'square']).default('square'),
  showAllEditPoints: z.boolean().default(false),
  paintedMaterials: z.record(z.string(), z.object({
    material: MaterialSchema.optional(),
    materialPreset: z.string().optional(),
  })).default({}),
}).superRefine((node, ctx) => {
  const ids = new Set(node.vertices.map((v) => v.id))
  if (
    ids.size !== node.vertices.length ||
    new Set(node.edges.map((e) => e.id)).size !== node.edges.length
  )
    ctx.addIssue({ code: 'custom', message: 'Pathway IDs must be unique' })
  if (node.edges.some((e) => !ids.has(e.from) || !ids.has(e.to)))
    ctx.addIssue({
      code: 'custom',
      message: 'Every pathway edge must reference existing junctions',
    })
})
export type PathwayNode = z.infer<typeof PathwayNode>

/** Saved paths from the retired curved-cobble finish remain editable. */
export function currentPathway(node: PathwayNode): PathwayNode {
  return (node.finish as string) === 'curvedCobbles'
    ? PathwayNode.parse({ ...node, finish: 'riverStones', borderStyle: 'none' }) : node
}
