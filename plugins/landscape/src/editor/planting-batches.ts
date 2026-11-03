import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { z } from 'zod'
import { PlantNode } from '../plant/domain/schema'
import { PLANT_PRESET_BY_KEY } from '../plant/domain/catalog'

const presetKey = z.string().refine(key => Boolean(PLANT_PRESET_BY_KEY[key]))
const species = z.array(z.object({ preset: presetKey, weight: z.number().finite().min(0).max(100) })).min(1)
  .refine(plants => new Set(plants.map(plant => plant.preset)).size === plants.length, 'Choose each plant once')
  .refine(plants => plants.some(plant => plant.weight > 0), 'Include a plant with a positive share')
const layoutSettings = z.object({
  batchId: z.string().min(1), sourceId: z.string().min(1),
  spacing: z.number().finite().min(0.25).max(50), setback: z.number().finite().min(0).max(50),
  seed: z.number().int().min(0).max(99999), natural: z.boolean(), side: z.enum(['left','right','both']),
})
export const PlantingBatchSettings = z.union([
  layoutSettings.extend({ plants: species }),
  layoutSettings.extend({
    preset: presetKey, mix: z.string().refine(key => !key || Boolean(PLANT_PRESET_BY_KEY[key])),
    primaryShare: z.number().finite().min(0).max(100).default(50),
  }).transform(({ preset, mix, primaryShare, ...settings }) => ({ ...settings,
    plants: mix && mix !== preset
      ? [{ preset, weight: primaryShare }, { preset: mix, weight: 100 - primaryShare }]
      : [{ preset, weight: 100 }],
  })),
])
export type PlantingBatchSettings = z.infer<typeof PlantingBatchSettings>
export function plantingBatch(node: AnyNode | undefined): PlantingBatchSettings | null {
  if (!node || !['landscape:plant', 'landscape:ground-area', 'landscape:pathway'].includes(node.type as string)) return null
  const parsed = PlantingBatchSettings.safeParse(node.metadata?.landscapePlanting)
  return parsed.success ? parsed.data : null
}
export function initialPlantingBatch(nodes: AnyNode[], levelId: string, selectedIds: readonly string[]): PlantingBatchSettings | null {
  const batches = new Map(nodes.filter(node => node.parentId === levelId).flatMap(node => {
    const batch = plantingBatch(node)
    return batch ? [[batch.batchId, batch] as const] : []
  }))
  const selected = new Set(selectedIds)
  const matches = [...batches.values()].filter(batch => selected.has(batch.sourceId)
    || nodes.some(node => selected.has(node.id) && plantingBatch(node)?.batchId === batch.batchId))
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) return null
  return batches.size === 1 ? [...batches.values()][0]! : null
}
export function savePlantingBatch(plants: PlantNode[], existing: AnyNode[], source?: AnyNode, settings?: PlantingBatchSettings) {
  const scene = useScene.getState()
  if (scene.readOnly) return []
  const retained = plants.map((plant, index) => existing[index] ? PlantNode.parse({ ...plant, id: existing[index]!.id,
    metadata: { ...existing[index]!.metadata, ...plant.metadata } }) : plant)
  scene.applyNodeChanges({
    update: [...(source && settings ? [{ id: source.id, data: { metadata: { ...source.metadata, landscapePlanting: settings } } }] : []), ...retained.slice(0, existing.length).map((plant) => ({ id: plant.id as AnyNodeId, data: plant as unknown as Partial<AnyNode> }))],
    create: retained.slice(existing.length).map((plant) => ({ node: plant as unknown as AnyNode, parentId: plant.parentId as AnyNodeId })),
    delete: existing.slice(plants.length).map((plant) => plant.id),
  })
  return retained
}
