import type { IrrigationPort } from './ports'
export type WateringMethod = 'sprinkler' | 'drip'

export function deviceMethod(raw: unknown): WateringMethod | undefined {
  const node = raw as { type?: string; method?: WateringMethod } | undefined
  return node?.type === 'landscape:irrigation-head' ? 'sprinkler' : node?.type === 'landscape:dripline' || node?.type === 'landscape:irrigation-fitting' && (raw as { fittingType?: string }).fittingType === 'filter-regulator' ? 'drip' : node?.method
}
export function zoneMethod(zone: string, parentId: string | null, nodes: Readonly<Record<string, unknown>>): WateringMethod | 'mixed' | undefined {
  if (!zone) return undefined
  const methods = new Set<WateringMethod>()
  for (const raw of Object.values(nodes)) {
    const n = raw as { zone?: string; name?: string; type?: string; parentId?: string }
    if (n.parentId !== parentId || (n.type === 'landscape:irrigation-zone' ? n.name : n.zone) !== zone) continue
    const method = deviceMethod(raw)
    if (method) methods.add(method)
  }
  return methods.size > 1 ? 'mixed' : [...methods][0]
}
export function portMethod(port: IrrigationPort, nodes: Readonly<Record<string, unknown>>) {
  if (!port.zone) return undefined // Source mains and valve inlets serve all zone types.
  return deviceMethod(nodes[port.nodeId]) ?? zoneMethod(port.zone, port.parentId, nodes)
}
export function methodConnectionProblem(source: IrrigationPort, target: IrrigationPort, nodes: Readonly<Record<string, unknown>>) {
  const a = portMethod(source, nodes), b = portMethod(target, nodes)
  if (a === 'mixed' || b === 'mixed') return 'This zone mixes sprinklers and drip. Separate them into different zones.'
  if (a && b && a !== b) return 'Sprinklers and drip need separate zone valves.'
  return null
}
export function assertZoneMethod(method: WateringMethod, zone: string, parentId: string | null, nodes: Readonly<Record<string, unknown>>) {
  const existing = zoneMethod(zone, parentId, nodes)
  if (existing && existing !== method) throw new Error(`Use a separate ${method === 'drip' ? 'drip' : 'sprinkler'} zone.`)
}
