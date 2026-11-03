import type { IrrigationFittingNode } from './fitting'
import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import type { IrrigationHeadNode } from './schema'
import type { IrrigationSourceNode } from './source'
import type { IrrigationValveNode } from './valve'
import { controllerSchedule, controllerAssignmentIssues, type IrrigationControllerNode } from './controller'
import { irrigationRunIssues, irrigationRunLength, type IrrigationRunNode } from './run'
import { driplineMetrics, type DriplineNode } from './dripline'
import { sourceReadiness } from './readiness'
import { irrigationZones } from './zones'

type Equipment = { fittings?: readonly IrrigationFittingNode[]; sources?: readonly IrrigationSourceNode[]; driplines?: readonly DriplineNode[]; valves?: readonly IrrigationValveNode[]; controllers?: readonly IrrigationControllerNode[]; runs?: readonly IrrigationRunNode[] }
/** Authored inventory and configured controller program; no hydraulic simulation. */
export function irrigationScheduleCsv(heads: readonly IrrigationHeadNode[], equipment: Equipment = {}): string {
  const cell = (value: string | number) => {
    const text = String(value)
    return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`
  }
  const columns = ['Record', 'Zone', 'Node ID', 'Name', 'Authored flow (L/min)', 'Reach radius (m)', 'Arc (degrees)', 'Nominal diameter (in)', 'Head count', 'Length (m)', 'Emitter spacing (m)', 'Emitter flow (L/h)', 'Emitter count', 'State', 'Station', 'Valve ID', 'Base duration (min)', 'Adjusted duration (min)', 'Start', 'End', 'Watering weekdays (Sun=0)', 'Seasonal adjustment (%)', 'Start connection', 'End connection', 'Connection review', 'Controller assignment review', 'Authored supply pressure (bar)', 'Authored available flow (L/min)', 'Connected installed demand (L/min)', 'Connected outlets', 'Available flow margin (L/min)', 'Supply readiness review']
  const rows: (string | number)[][] = [columns]
  const add = (values: (string | number)[]) => rows.push([...values, ...Array(Math.max(0, columns.length - values.length)).fill('')])
  const nodes = Object.fromEntries([...heads, ...(equipment.sources ?? []), ...(equipment.driplines ?? []), ...(equipment.valves ?? []), ...(equipment.runs ?? []), ...(equipment.fittings ?? [])].map(node => [node.id, node])) as unknown as Record<AnyNodeId, AnyNode>
  for (const zone of irrigationZones(heads, equipment.driplines)) {
    for (const head of zone.heads) add(['Head', zone.name, head.id, head.name || 'Irrigation head', head.flow, head.radius, head.arc, head.inletDiameter, 1])
    for (const drip of zone.driplines) {
      const metrics = driplineMetrics(drip)
      add(['Dripline', zone.name, drip.id, drip.name || 'Dripline', metrics.flow, '', '', drip.diameter, '', metrics.length, drip.emitterSpacing, drip.emitterFlow, metrics.emitters])
    }
    add(['Zone total', zone.name, '', '', zone.flow, '', '', '', zone.heads.length])
  }
  for (const source of equipment.sources ?? []) {
    const review = sourceReadiness(source, nodes)
    add(['Supply', '', source.id, source.name || 'Water supply', '', '', '', source.diameter, '', '', '', '', '', source.enabled ? 'Enabled' : 'Off', '', '', '', '', '', '', '', '', '', '', '', '', source.pressureBar, source.availableFlow, review.demand, review.outlets, review.margin, review.issues.join('; ')])
  }
  for (const valve of equipment.valves ?? []) add(['Valve', valve.zone, valve.id, valve.name || 'Zone valve', '', '', '', valve.diameter, '', '', '', '', '', valve.isOpen ? 'Open' : 'Closed'])

  for (const fitting of equipment.fittings ?? []) add(['Fitting', fitting.zone, fitting.id, fitting.name || fitting.fittingType, '', '', '', fitting.diameters.join(' / ')])
  for (const run of equipment.runs ?? []) add(['Run', run.zone, run.id, run.name || 'Irrigation run', '', '', '', run.diameter, '', irrigationRunLength(run), '', '', '', '', '', '', '', '', '', '', '', '', run.startConnection ? `${run.startConnection.nodeId}:${run.startConnection.portId}` : '', run.endConnection ? `${run.endConnection.nodeId}:${run.endConnection.portId}` : '', irrigationRunIssues(run, nodes).join('; ') || 'Endpoints match; supply and hydraulics unchecked'])
  for (const controller of equipment.controllers ?? []) {
    add(['Controller', '', controller.id, controller.name || 'Irrigation controller', '', '', '', '', '', '', '', '', '', controller.enabled ? 'Enabled' : 'Off', '', '', '', '', controller.startTime, '', controller.wateringDays.join(';'), controller.seasonalPercent, '', '', '', controllerAssignmentIssues(controller, equipment.valves ?? [], equipment.controllers ?? []).join('; ')])
    for (const station of controllerSchedule(controller)) {
      const valve = equipment.valves?.find(valve => valve.id === station.valveId)
      add(['Controller station', valve?.zone ?? '', controller.id, controller.name || 'Irrigation controller', '', '', '', '', '', '', '', '', '', station.active ? 'Configured' : 'Off', station.station, station.valveId ?? '', station.runMinutes, station.adjustedMinutes, station.start ?? '', station.end ?? '', controller.wateringDays.join(';'), controller.seasonalPercent, '', '', '', controllerAssignmentIssues(controller, equipment.valves ?? [], equipment.controllers ?? []).join('; ')])
    }
  }
  return rows.map(row => row.map(cell).join(',')).join('\r\n')
}
