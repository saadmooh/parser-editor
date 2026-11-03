import { BaseNode, nodeType, objectId, type AnyNode, type AnyNodeId, type NodeDefinition, type FloorplanGeometry } from '@pascal-app/core'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { z } from 'zod'
export const IrrigationZoneNode = BaseNode.extend({
  id: objectId('irrigation-zone'), type: nodeType('landscape:irrigation-zone'),
  name: z.string().trim().min(1).max(80).default('Zone 1'),
  areaIds: z.array(z.string()).max(256).default([]),
  method: z.enum(['sprinkler', 'drip']).default('sprinkler'),
})
export type IrrigationZoneNode = z.infer<typeof IrrigationZoneNode>
export const irrigationZoneDefinition: NodeDefinition<typeof IrrigationZoneNode> = {
  kind: 'landscape:irrigation-zone', schemaVersion: 1, schema: IrrigationZoneNode, category: 'utility', dirtyTracking: false,
  defaults: () => { const { id: _id, type: _type, ...n } = IrrigationZoneNode.parse({}); return n },
  capabilities: { deletable: true, refs: [{ path: 'areaIds[]', namespace: 'node', role: 'connection', onDelete: 'drop', onPreset: 'strip', targetKinds: ['landscape:ground-area'] }] },
  floorplan: (node, ctx) => ({ kind: 'group', children: node.areaIds.flatMap(id => {
    const area = GroundAreaNode.safeParse(ctx.resolve(id as AnyNodeId))
    if (!area.success || area.data.parentId !== node.parentId || area.data.outline.length < 3) return []
    return [{ kind: 'polygon', points: area.data.outline, fill: zoneColor(node.id), fillOpacity: .06, stroke: zoneColor(node.id), strokeWidth: .025, strokeDasharray: '.25 .15', pointerEvents: 'none' }] as FloorplanGeometry[]
  }) }),
  presentation: { label: 'Watering zone', icon: { kind: 'iconify', name: 'lucide:droplets' }, hidden: true },
}
export function zoneColor(identity: string) {
  const colors = ['#60a5fa', '#fbbf24', '#a78bfa', '#34d399', '#fb7185', '#22d3ee']
  let hash = 0
  for (const c of identity) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]!
}
export function zoneCatalog(nodes: readonly unknown[]): { id?: string; name: string; areaIds: string[]; method: 'sprinkler' | 'drip' }[] {
  const zones = new Map<string, { id?: string; name: string; areaIds: string[]; method: 'sprinkler' | 'drip' }>()
  for (const raw of nodes) {
    const zone = IrrigationZoneNode.safeParse(raw)
    if (zone.success) zones.set(zone.data.name, zone.data)
  }
  for (const raw of nodes) {
    const n = raw as { zone?: string; type?: string }
    if (n.zone && !zones.has(n.zone)) zones.set(n.zone, { name: n.zone, areaIds: [], method: n.type === 'landscape:dripline' ? 'drip' : 'sprinkler' })
  }
  return [...zones.values()].sort((a, b) => a.name.localeCompare(b.name))
}
export function renameZoneUpdates(nodes: readonly AnyNode[], zone: { id?: string; name: string }, name: string) {
  const next = name.trim().slice(0, 80)
  if (!next || nodes.some(n => (n as unknown as { zone?: string }).zone === next && next !== zone.name || IrrigationZoneNode.safeParse(n).data?.name === next && n.id !== zone.id)) throw new Error('Choose a unique zone name.')
  return nodes.flatMap(n => {
    const member = n as unknown as { zone?: string; zoneId?: string }
    if (n.id === zone.id) return [{ id: n.id as AnyNodeId, data: { name: next } as Partial<AnyNode> }]
    return member.zoneId === zone.id && !!zone.id || member.zone === zone.name ? [{ id: n.id as AnyNodeId, data: { zone: next, ...(zone.id ? { zoneId: zone.id } : {}) } as Partial<AnyNode> }] : []
  })
}
