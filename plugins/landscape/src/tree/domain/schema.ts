import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { isTreeSpecies } from './species'

export const TREE_KIND = 'landscape:tree'

export const DEFAULT_TREE_LOD = {
  mobileTarget: true,
  cardRes: 256,
  cardVariants: 2,
  billboardRes: 256,
} as const

export function resolveTreeLod(lod: Record<string, number | boolean>) {
  const { mobileTarget: _mobileTarget, cardRes: _cardRes, cardVariants: _cardVariants,
    billboardRes: _billboardRes, ...settings } = lod
  return { ...DEFAULT_TREE_LOD, ...settings }
}

export const TreeNode = BaseNode.extend({
  id: objectId('tree'),
  type: nodeType(TREE_KIND),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).default([0, 0, 0]),
  rotation: z.tuple([z.literal(0), z.number().finite(), z.literal(0)]).default([0, 0, 0]),
  species: z.string().refine(isTreeSpecies, 'Unknown SeedThree species').default('whiteOak'),
  controls: z.record(z.string(), z.unknown()).default({}),
  lod: z.record(z.string(), z.union([z.number().finite(), z.boolean()])).default(DEFAULT_TREE_LOD),
})

export type TreeNode = z.infer<typeof TreeNode>
