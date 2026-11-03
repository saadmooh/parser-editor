import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

export const IRRIGATION_HEAD_KIND = 'landscape:irrigation-head'
export const IrrigationHeadNode = BaseNode.extend({
  id: objectId('irrigation-head'),
  type: nodeType(IRRIGATION_HEAD_KIND),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).default([0, 0, 0]),
  rotation: z.tuple([z.literal(0), z.number().finite(), z.literal(0)]).default([0, 0, 0]),
  profile: z.enum(['custom', 'hunter-mp1000']).default('custom'),
  requiredPressureBar: z.number().finite().min(.1).max(10).default(2.1),
  inletDiameter: z.number().finite().min(0.25).max(4).default(0.5),
  radius: z.number().finite().min(0.1).max(30).default(3),
  arc: z.number().finite().min(1).max(360).default(360),
  flow: z.number().finite().min(0).max(100).default(4),
  zone: z.string().trim().max(80).default('Zone 1'),
  zoneId: z.string().optional(),
  showSpray: z.boolean().default(true),
  showCoverage: z.boolean().default(true),
})
export type IrrigationHeadNode = z.infer<typeof IrrigationHeadNode>
