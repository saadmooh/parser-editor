import { z } from 'zod'
import { curvePointsSchema, type CurvePoint } from '../../ground-areas/domain/freehand-curve'

export const dimensions = {
  children: z.array(z.string()).default([]),
  width: z.number().finite().min(0.2).max(30).default(4),
  depth: z.number().finite().min(0.2).max(30).default(3),
  thickness: z.number().finite().min(0.03).max(2).default(0.15),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).default([0, 0, 0]),
  rotation: z.tuple([z.literal(0), z.number().finite(), z.literal(0)]).default([0, 0, 0]),
}

export const drawnOutline = {
  curvePoints: curvePointsSchema,
  shape: z.enum(['rectangle', 'custom', 'freehand', 'circle', 'oval']).default('rectangle'),
  outline: z.array(z.tuple([z.number().finite(), z.number().finite()])).default([]),
}

export type AccessShape = {
  curvePoints?: CurvePoint[]
  width: number
  depth: number
  thickness: number
  position: [number, number, number]
  rotation: [0, number, 0]
  shape?: 'rectangle' | 'custom' | 'freehand' | 'circle' | 'oval'
  outline?: [number, number][]
}
