import { z } from 'zod'
import { csvCell, mulchOrder, orderingArea, type QuantityRow } from './quantities'

export const EstimateSettings = z.object({
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD']).default('USD'),
  rates: z.record(z.string(), z.object({
    material: z.number().finite().min(0).max(1e9).nullable(),
    labour: z.number().finite().min(0).max(1e9).nullable(),
    bags: z.boolean().default(false),
  })).default({}),
})
export type EstimateSettings = z.infer<typeof EstimateSettings>
export function estimateSettings(value: unknown): EstimateSettings {
  const parsed = EstimateSettings.safeParse(value)
  return parsed.success ? parsed.data : EstimateSettings.parse({})
}
export function costEstimate(rows: QuantityRow[], waste: number, settings: EstimateSettings) {
  const groups = new Map<string, { key: string; label: string; unit: string; quantity: number | null; materialRate: number | null; labourRate: number | null }>()
  for (const row of rows) {
    const key = row.costKey ?? `${row.material || row.label}:${row.area !== null ? 'area' : row.length !== null ? 'length' : 'each'}`
    const rate = settings.rates[key]
    const mulch = row.bagLitres !== undefined
    const quantity = mulch ? (rate?.bags ? mulchOrder(row, waste)?.bags : mulchOrder(row, waste)?.volume) ?? null
      : row.area !== null ? orderingArea(row, waste) : row.length ?? row.count
    const unit = mulch ? rate?.bags ? 'bag' : 'm³' : row.area !== null ? 'm²' : row.length !== null ? 'm' : 'each'
    const group = groups.get(key) ?? { key, label: row.material || row.label, unit, quantity: 0, materialRate: rate?.material ?? null, labourRate: rate?.labour ?? null }
    group.quantity = group.quantity === null || quantity === null ? null : group.quantity + quantity
    groups.set(key, group)
  }
  const items = [...groups.values()].map(row => ({ ...row,
    materialCost: row.quantity === null || row.materialRate === null ? null : row.quantity * row.materialRate,
    labourCost: row.quantity === null || row.labourRate === null ? null : row.quantity * row.labourRate,
  })).map(row => ({ ...row, total: row.materialCost === null || row.labourCost === null ? null : row.materialCost + row.labourCost }))
  return { items, total: items.reduce((sum, row) => sum + (row.total ?? 0), 0), unpriced: items.filter(row => row.total === null).length }
}
export function estimateCsv(rows: QuantityRow[], waste: number, settings: EstimateSettings) {
  const estimate = costEstimate(rows, waste, settings)
  return [['Item', 'Unit', 'Quantity', 'Material rate', 'Labour rate', 'Material cost', 'Labour cost', `Total (${settings.currency})`],
    ...estimate.items.map(row => [row.label, row.unit, row.quantity?.toFixed(3) ?? 'Unavailable', row.materialRate ?? 'Unpriced', row.labourRate ?? 'Unpriced', row.materialCost?.toFixed(2) ?? '', row.labourCost?.toFixed(2) ?? '', row.total?.toFixed(2) ?? 'Unpriced']),
    ['Priced subtotal', '', '', '', '', '', '', estimate.total.toFixed(2)], ['Unpriced items', estimate.unpriced, '', '', '', '', '', '']]
    .map(row => row.map(csvCell).join(',')).join('\r\n')
}
