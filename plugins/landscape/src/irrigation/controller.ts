import { createIrrigationHandleAffordance } from './editing'
import { irrigationMoveArrows } from './movement'
import { irrigationPlanSchedule } from '../editor/schedules'
import { BaseNode, nodeType, objectId, type AnyNode, type AnyNodeId, type FloorplanGeometry, type NodeDefinition } from '@pascal-app/core'
import { irrigationEquipmentMove } from './editing'
import { controllerLinksFloorplan } from './controller-links'
import { irrigationControllerGeometry } from './controller-model'
import { z } from 'zod'

const station = z.object({ valveId: z.string().min(1).optional(), runMinutes: z.number().finite().int().min(0).max(180).default(20), enabled: z.boolean().default(true) })
export const IRRIGATION_CONTROLLER_KIND = 'landscape:irrigation-controller'
export const IrrigationControllerNode = BaseNode.extend({
  id: objectId('irrigation-controller'), type: nodeType(IRRIGATION_CONTROLLER_KIND),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).default([0, 0, 0]),
  rotation: z.tuple([z.literal(0), z.number().finite(), z.literal(0)]).default([0, 0, 0]),
  enabled: z.boolean().default(true),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('06:00'),
  wateringDays: z.array(z.number().int().min(0).max(6)).max(7).refine(days => new Set(days).size === days.length, 'Watering days must be unique').default([0, 1, 2, 3, 4, 5, 6]),
  seasonalPercent: z.number().finite().int().min(0).max(200).default(100),
  stations: z.array(station).length(8).default(() => Array.from({ length: 8 }, () => ({ runMinutes: 20, enabled: true }))),
})
export type IrrigationControllerNode = z.infer<typeof IrrigationControllerNode>

export function controllerSchedule(node: IrrigationControllerNode, weekday?: number) {
  let seconds = (Number(node.startTime.slice(0, 2)) * 60 + Number(node.startTime.slice(3))) * 60
  const format = (value: number) => {
    const time = `${String(Math.floor(value % 86400 / 3600)).padStart(2, '0')}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}${value % 60 ? `:${String(value % 60).padStart(2, '0')}` : ''}`
    const days = Math.floor(value / 86400)
    return `${time}${days ? ` (+${days} ${days === 1 ? 'day' : 'days'})` : ''}`
  }
  return node.stations.map((station, index) => {
    const adjustedSeconds = Math.round(station.runMinutes * 60 * node.seasonalPercent / 100)
    const active = node.enabled && node.wateringDays.length > 0 && (weekday === undefined || node.wateringDays.includes(weekday)) && station.enabled && !!station.valveId && adjustedSeconds > 0
    const start = active ? format(seconds) : null
    if (active) seconds += adjustedSeconds
    return { station: index + 1, valveId: station.valveId, runMinutes: station.runMinutes, adjustedMinutes: adjustedSeconds / 60, active, start, end: active ? format(seconds) : null }
  })
}

/** Audit imported/duplicated assignments without mutating configured timing. */
export function controllerAssignmentIssues(node: IrrigationControllerNode, valves: readonly { id: string; parentId?: string | null; isOpen: boolean }[], controllers: readonly IrrigationControllerNode[]) {
  return node.stations.flatMap((station, index) => {
    if (!station.valveId) return []
    const issues: string[] = []
    const valve = valves.find(valve => valve.id === station.valveId)
    if (!valve) issues.push(`Station ${index + 1}: assigned valve is missing.`)
    else {
      if (valve.parentId !== node.parentId) issues.push(`Station ${index + 1}: assigned valve is on another parent.`)
      if (!valve.isOpen) issues.push(`Station ${index + 1}: valve is authored closed; actuation is not simulated.`)
    }
    const assignments = controllers.reduce((count, controller) => count + controller.stations.filter(other => other.valveId === station.valveId).length, 0)
    if (assignments > 1) issues.push(`Station ${index + 1}: valve is assigned to ${assignments} stations; review duplicate control.`)
    return issues
  })
}

/** Public deletion companion: clear signal links, retaining station settings. */
export function clearDeletedValveAssignments(nodes: Record<AnyNodeId, AnyNode>, deleted: ReadonlySet<AnyNodeId>) {
  return Object.values(nodes).flatMap(raw => {
    const parsed = IrrigationControllerNode.safeParse(raw)
    if (!parsed.success || !parsed.data.stations.some(station => station.valveId && deleted.has(station.valveId as AnyNodeId))) return []
    const stations = parsed.data.stations.map(station => {
      if (!station.valveId || !deleted.has(station.valveId as AnyNodeId)) return station
      const { valveId: _id, ...settings } = station
      return settings
    })
    return [{ id: raw.id as AnyNodeId, data: { stations } as Partial<AnyNode> }]
  })
}
function floorplan(node: IrrigationControllerNode, ctx: { resolve: (id: AnyNodeId) => unknown; viewState?: { selected?: boolean } }): FloorplanGeometry {
  const [x, , z] = node.position
  return { kind: 'group', children: [
    ...(ctx.viewState?.selected ? irrigationMoveArrows(node) : []),
    ...controllerLinksFloorplan(node, id => ctx.resolve(id as AnyNodeId)),
    { kind: 'polygon', points: [[x - .18, z - .07], [x + .18, z - .07], [x + .18, z + .07], [x - .18, z + .07]], fill: '#dddcd3', stroke: '#272d31', strokeWidth: .025 },
    { kind: 'polyline', points: [[x - .13, z + .085], [x + .13, z + .085]], stroke: node.enabled ? '#16a34a' : '#586064', strokeWidth: .025, pointerEvents: 'none' },
    { kind: 'text', x, y: z + 0.3, text: `Controller · ${node.enabled ? node.startTime : 'Off'}`, upright: true, textAnchor: 'middle', fontSize: 0.16, fill: '#25354a', stroke: '#ffffff', strokeWidth: 0.04, paintOrder: 'stroke' },
  ] }
}
export const irrigationControllerDefinition: NodeDefinition<typeof IrrigationControllerNode> = {
  kind: IRRIGATION_CONTROLLER_KIND, schemaVersion: 1, schema: IrrigationControllerNode, category: 'utility', snapProfile: 'item',
  floorplanMoveTarget: irrigationEquipmentMove,
  affordanceTools: { selection: () => import('./selection') },
  renderer: { kind: 'parametric', module: () => import('./controller-renderer') },
  tool: () => import('./equipment-tool'),
  extensions: { 'pascal:editor/floorplan': { schedule: irrigationPlanSchedule, directDrag: true, tool: () => import('./equipment-floorplan-tool') } },
  floorplanAffordances: { 'irrigation-handle': createIrrigationHandleAffordance() },
  defaults: () => { const { id: _id, type: _type, ...defaults } = IrrigationControllerNode.parse({}); return defaults },
  capabilities: {
    floorPlaced: { collides: false, footprint: raw => ({ dimensions: [0.4, 1.01, 0.25], rotation: (raw as unknown as IrrigationControllerNode).rotation }) },
    selectable: { hitVolume: 'mesh' }, movable: { axes: ['x', 'z'], gridSnap: true }, rotatable: { axes: ['y'] }, duplicable: true, deletable: true,
    refs: [{ path: 'stations[].valveId', namespace: 'node', role: 'control', onDelete: 'drop', onPreset: 'strip', targetKinds: ['landscape:irrigation-valve'] }],
  },
  geometry: irrigationControllerGeometry, floorplan, parametrics: { groups: [] },
  presentation: { label: 'Irrigation controller', icon: { kind: 'iconify', name: 'lucide:calendar-clock' }, hidden: true },
}
