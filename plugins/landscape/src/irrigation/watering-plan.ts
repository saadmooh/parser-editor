import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import type { GroundAreaNode } from '../ground-areas/domain/schema'
import { IrrigationZoneNode } from './zone-model'
import { IrrigationValveNode } from './valve'
import { IrrigationControllerNode } from './controller'
import { IrrigationHeadNode } from './schema'
import { DriplineNode, driplineMetrics } from './dripline'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { IrrigationSourceNode } from './source'
import { irrigationPorts } from './ports'
import { layoutWateringArea, type LayoutOptions, type AreaLayout } from './area-layout'
import { mergePlan, planConnectZone } from './connect-zone'
import { reviewZoneHydraulics, selectPipeDiameter, type HydraulicReview } from './hydraulics'
import type { IrrigationPlan } from './network'

export type WateringProposal = { plan: IrrigationPlan; zones: IrrigationZoneNode[]; layout: AreaLayout; reviews: HydraulicReview[]; notes: string[]; snapshot: Readonly<Record<string, unknown>>; areaId: string; supply?: IrrigationSourceNode }
export const MP1000_PROFILE = { radius: 4.1, fullCircleFlow: 3.18, pressureBar: 2.8, source: 'https://www.hunterirrigation.com/en-metric/irrigation-product/mp-rotator/standard-mp-rotator-nozzle' }
/** Group adjacent devices by the measured design budget. Large single devices remain review items. */
export function splitWateringDemand(devices: readonly (IrrigationHeadNode | DriplineNode)[], budget: number) {
  if (!(budget > 0)) return [devices.slice()]
  const groups: (IrrigationHeadNode | DriplineNode)[][] = []
  let group: (IrrigationHeadNode | DriplineNode)[] = [], demand = 0
  const sorted = devices.slice().sort((a, b) => {
    const p = 'position' in a ? a.position : a.path[0]!, q = 'position' in b ? b.position : b.path[0]!
    return p[2] - q[2] || p[0] - q[0]
  })
  for (const device of sorted) {
    const flow = device.type === 'landscape:irrigation-head' ? device.flow : driplineMetrics(device).flow
    if (group.length && demand + flow > budget + 1e-6) { groups.push(group); group = []; demand = 0 }
    group.push(device); demand += flow
  }
  if (group.length) groups.push(group)
  return groups
}
/** Build one reviewable scene transaction. Existing watering layouts are never replaced. */
export function proposeAreaWatering(area: GroundAreaNode, options: LayoutOptions, source: IrrigationSourceNode | undefined, original: Readonly<Record<string, unknown>>): WateringProposal {
  if (source && source.parentId !== area.parentId) throw new Error('Choose a supply on the area’s level.')
  const existingZones = Object.values(original).flatMap(raw => { const z = IrrigationZoneNode.safeParse(raw); return z.success && z.data.parentId === area.parentId && z.data.areaIds.includes(area.id) ? [z.data] : [] })
  if (existingZones.length && !source) throw new Error('This area already has watering zones. Choose a supply to connect them.')
  if (existingZones.some(z => z.method !== options.method)) throw new Error('Choose the area’s existing watering method to preserve its devices.')
  const existingGroups = existingZones.map(zone => Object.values(original).flatMap(raw => {
    const head = IrrigationHeadNode.safeParse(raw), drip = DriplineNode.safeParse(raw)
    const device = head.success ? head.data : drip.success ? drip.data : null
    return device && device.parentId === area.parentId && device.zone === zone.name ? [device] : []
  }))
  if (existingGroups.some(group => !group.length)) throw new Error('An existing area zone has no devices. Review it before automatic connection.')
  const layout = existingZones.length ? { devices: existingGroups.flat(), coveragePercent: 0, uncovered: [], sampleSpacing: .3, notes: ['Existing device positions and manual routes are preserved. Coverage was not regenerated.'] } : layoutWateringArea(area, options)
  const budget = source ? source.availableFlow * source.designFlowFraction : Infinity
  const groups = existingZones.length ? existingGroups : splitWateringDemand(layout.devices, budget)
  if (groups.length > 32) throw new Error('This layout needs more than 32 zones. Use smaller areas or review supply capacity.')
  const usedNames = new Set(Object.values(original).flatMap(raw => { const n = raw as { zone?: string; name?: string; type?: string }; return [n.zone, n.type === 'landscape:irrigation-zone' ? n.name : undefined].filter((v): v is string => !!v) }))
  const zones: IrrigationZoneNode[] = [], notes = [...layout.notes], reviews: HydraulicReview[] = []
  let nodes = { ...original }
  const updateIds = new Set<string>()
  const apply = (plan: IrrigationPlan) => { nodes = mergePlan(nodes, plan); plan.update.forEach(u => updateIds.add(u.id)) }
  if (!existingZones.length) for (const device of layout.devices) nodes[device.id] = device
  const generatedValves: IrrigationValveNode[] = []
  for (const [index, group] of groups.entries()) {
    const base = (area.name || (options.method === 'sprinkler' ? 'Lawn' : 'Bed')).slice(0, 65)
    let number = index + 1, name = groups.length === 1 ? base : `${base} ${number}`
    while (!existingZones.length && usedNames.has(name)) name = `${base} ${++number}`
    usedNames.add(name)
    const zone = existingZones[index] ?? IrrigationZoneNode.parse({ parentId: area.parentId, name, method: options.method, areaIds: [area.id] })
    name = zone.name
    zones.push(zone)
    const devices = group.map(raw => raw.type === 'landscape:irrigation-head' ? IrrigationHeadNode.parse({ ...raw, zone: name, zoneId: zone.id }) : DriplineNode.parse({ ...raw, zone: name, zoneId: zone.id }))
    if (!existingZones.length) apply({ create: [zone, ...devices] as unknown as AnyNode[], update: [] })
    if (!source) continue
    const demand = devices.reduce((sum, device) => sum + (device.type === 'landscape:irrigation-head' ? device.flow : driplineMetrics(device).flow), 0)
    const diameter = Math.max(.75, selectPipeDiameter(demand))
    const existingValve = Object.values(nodes).flatMap(raw => { const p = IrrigationValveNode.safeParse(raw); return p.success && p.data.parentId === area.parentId && p.data.zone === zone.name ? [p.data] : [] })
    if (existingValve.length > 1) throw new Error('This zone has multiple valves. Choose its connections in the advanced controls.')
    const valvePosition: [number, number, number] = [source.position[0] + 2, source.position[1], source.position[2] + 1.2]
    // Each new area must reserve its own valve location, including earlier layouts.
    while (Object.values(nodes).some(raw => { const p = IrrigationValveNode.safeParse(raw); return p.success && p.data.parentId === area.parentId && Math.hypot(p.data.position[0] - valvePosition[0], p.data.position[2] - valvePosition[2]) < 1 })) valvePosition[2] += 1.2
    const valve = existingValve[0] ?? IrrigationValveNode.parse({ parentId: area.parentId, name: `${name} valve`, zone: name, zoneId: zone.id, method: options.method, diameter,
      position: valvePosition })
    generatedValves.push(valve)
    if (!existingValve.length) { apply({ create: [valve as unknown as AnyNode], update: [] }) }
    const routingNodes = { ...nodes }
    if (!existingZones.length) for (let future = index + 1; future < groups.length; future++) {
      const reserved = IrrigationValveNode.parse({ parentId: area.parentId, name: 'Reserved valve position', position: [valve.position[0], valve.position[1], valve.position[2] + (future - index) * 1.2] })
      routingNodes[reserved.id] = reserved
    }
    const route = planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, devices.flatMap(irrigationPorts), .4, routingNodes)
    // Mark shared pipes separately from the short final device connections.
    route.create = route.create.map(raw => {
      const pipe = IrrigationRunNode.safeParse(raw)
      if (!pipe.success) return raw
      const refs = [pipe.data.startConnection, pipe.data.endConnection]
      const isDeviceConnection = refs.some(ref => ref && devices.some(d => d.id === ref.nodeId))
      return { ...raw, routeRole: !pipe.data.zone ? 'main' : isDeviceConnection ? 'connection' : 'lateral' } as unknown as AnyNode
    })
    apply(route)
  }
  if (!source) notes.push('Supply data needed. This preview places devices and zones; choose a supply to generate their feed pipes.')
  else {
    if (existingZones.length) notes.push('Existing zone sizes are preserved. Any capacity warning needs a zone split in the advanced controls.')
    for (const zone of zones) reviews.push(reviewZoneHydraulics(source, zone.name, nodes))
    // Use free controller slots first. Preserve every existing schedule value.
    const controllers = Object.values(nodes).flatMap(raw => { const p = IrrigationControllerNode.safeParse(raw); return p.success && p.data.parentId === area.parentId ? [p.data] : [] })
    const assigned = new Set(controllers.flatMap(c => c.stations.flatMap(s => s.valveId ? [s.valveId] : [])))
    let pending = generatedValves.filter(v => !assigned.has(v.id)), controllerNumber = controllers.length
    for (const controller of controllers) {
      const stations = controller.stations.map(station => station.valveId || !pending.length ? station : { ...station, valveId: pending.shift()!.id, enabled: true, runMinutes: 20 })
      if (stations.some((station, i) => station !== controller.stations[i])) apply({ create: [], update: [{ id: controller.id as AnyNodeId, data: { stations } as Partial<AnyNode> }] })
    }
    while (pending.length) {
      const valves = pending.splice(0, 8)
      const controller = IrrigationControllerNode.parse({ parentId: area.parentId, name: `Watering controller ${++controllerNumber}`, position: [source.position[0] - .7, source.position[1], source.position[2] + controllerNumber * .5], wateringDays: [1, 3, 5], stations: Array.from({ length: 8 }, (_, i) => ({ valveId: valves[i]?.id, enabled: true, runMinutes: 20 })) })
      apply({ create: [controller as unknown as AnyNode], update: [] })
    }
    notes.push('Suggested schedule is 20 min on Mon/Wed/Fri. Review soil, plant needs and local watering rules before using it.')
    if (groups.length > 1) notes.push(`Split into ${groups.length} zones to stay within the ${budget.toFixed(1)} L/min design budget.`)
  }
  // Never present a broken route as an installable proposal.
  for (const raw of Object.values(nodes)) {
    const pipe = IrrigationRunNode.safeParse(raw)
    if (pipe.success && !original[pipe.data.id]) {
      const issues = irrigationRunIssues(pipe.data, nodes).filter(i => !i.endsWith('water supply is disabled.') && !i.endsWith('connected valve is closed.'))
      if (issues.length) throw new Error(`Generated route needs review: ${issues[0]}`)
    }
  }
  return { plan: { create: Object.entries(nodes).flatMap(([id, n]) => !original[id] ? [n as AnyNode] : []), update: [...updateIds].flatMap(id => original[id] ? [{ id: id as AnyNodeId, data: nodes[id] as Partial<AnyNode> }] : []) }, zones, layout, reviews, notes, snapshot: original, areaId: area.id, supply: source }
}

/** Default area action: reuse the nearest supply, or propose a corner supply as part of the transaction. */
export function proposeAutomaticAreaWatering(area: GroundAreaNode, options: LayoutOptions, original: Readonly<Record<string, unknown>>, supplyChoice = 'auto'): WateringProposal {
  if (supplyChoice === 'draft') return proposeAreaWatering(area, options, undefined, original)
  const supplies = Object.values(original).flatMap(raw => { const p = IrrigationSourceNode.safeParse(raw); return p.success && p.data.parentId === area.parentId ? [p.data] : [] })
  const center = area.outline.reduce((sum, p) => [sum[0]! + p[0] / area.outline.length, sum[1]! + p[1] / area.outline.length], [0, 0])
  supplies.sort((a, b) => Number(b.enabled) - Number(a.enabled) || Math.hypot(a.position[0] - center[0]!, a.position[2] - center[1]!) - Math.hypot(b.position[0] - center[0]!, b.position[2] - center[1]!))
  if (supplyChoice !== 'auto' || supplies.length) {
    const source = supplyChoice === 'auto' ? supplies[0] : supplies.find(s => s.id === supplyChoice)
    if (!source) throw new Error('This supply is no longer available. Choose another water connection.')
    const result = proposeAreaWatering(area, options, source, original)
    result.notes.unshift(`Connected to ${source.name || 'existing water supply'}. Zone valves and feed pipes are included.`)
    return result
  }
  if (!area.outline.length) throw new Error('Choose a completed lawn or bed.')
  const xs = area.outline.map(p => p[0]), zs = area.outline.map(p => p[1])
  const corners = [[Math.min(...xs) - 3, Math.min(...zs) - 3], [Math.max(...xs) + 3, Math.min(...zs) - 3], [Math.min(...xs) - 3, Math.max(...zs) + 3], [Math.max(...xs) + 3, Math.max(...zs) + 3]]
  let failure: unknown
  for (const [x, z] of corners) {
    const source = IrrigationSourceNode.parse({ parentId: area.parentId, name: 'Water pipeline connection', position: [x, area.elevation, z], measurementStatus: 'assumed' })
    try {
      const result = proposeAreaWatering(area, options, source, { ...original, [source.id]: source })
      result.plan.create.unshift(source as unknown as AnyNode)
      result.snapshot = original
      result.notes.unshift('A water pipeline connection and zone valves are included beside the area. Move the supply to your actual tap or water main and enter its measured pressure and flow.')
      return result
    } catch (error) { failure = error }
  }
  throw failure instanceof Error ? failure : new Error('No corner has a clear water connection route. Place a supply on the plan and retry.')
}
