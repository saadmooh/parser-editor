import { IrrigationSourceNode } from './source'
import { IrrigationValveNode } from './valve'
import { IrrigationHeadNode } from './schema'
import { DriplineNode, driplineMetrics } from './dripline'
import { IrrigationRunNode, irrigationRunIssues, irrigationRunLength } from './run'
import { IrrigationFittingNode } from './fitting'
import { irrigationPorts } from './ports'

/** SI Hazen-Williams head loss; water, full pipe, fixed design demand.
 * EPA EPANET 2.2 manual, section 3.1 (converted from US customary units).
 * https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P10113EM.txt
 */
export function pipeLossBar(lengthM: number, flowLpm: number, internalDiameterMm: number, roughnessC = 150, minorLossK = 0) {
  if (![lengthM, flowLpm, internalDiameterMm, roughnessC, minorLossK].every(Number.isFinite) || lengthM < 0 || flowLpm < 0 || internalDiameterMm <= 0 || roughnessC <= 0 || minorLossK < 0) throw new Error('Use finite, positive pipe dimensions and nonnegative flow.')
  const q = flowLpm / 60000, d = internalDiameterMm / 1000
  const velocity = q / (Math.PI * d * d / 4)
  const head = 10.67 * lengthM * Math.pow(q, 1.852) / (Math.pow(roughnessC, 1.852) * Math.pow(d, 4.8704)) + minorLossK * velocity * velocity / (2 * 9.80665)
  return { lossBar: head * .0980665, velocity }
}
export function selectPipeDiameter(flowLpm: number, maxVelocity = 1.5) {
  for (const nominal of [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3, 4]) if (pipeLossBar(0, flowLpm, nominal * 25.4).velocity <= maxVelocity) return nominal
  throw new Error('This flow needs a pipe larger than the supported 4 in range.')
}
type Edge = { to: string; run?: IrrigationRunNode; regulator?: number }
export type HydraulicReview = { demand: number; budget: number; runs: { id: string; flow: number; velocity: number; lossBar: number; suggestedDiameter: number }[]; outlets: { id: string; pressureBar: number; requiredPressureBar: number; maximumPressureBar?: number }[]; issues: string[]; status: 'draft' | 'review' | 'ready'; assumptions: string[] }
/** One valve operates at a time. Loops are reported rather than approximated as trees. */
export function reviewZoneHydraulics(source: IrrigationSourceNode, zone: string, nodes: Readonly<Record<string, unknown>>): HydraulicReview {
  const graph = new Map<string, Edge[]>(), owner = new Map<string, unknown>()
  const key = (id: string, port: string) => `${id}/${port}`
  const link = (a: string, b: string, run?: IrrigationRunNode, regulator?: number) => {
    if (!graph.has(a)) graph.set(a, [])
    if (!graph.has(b)) graph.set(b, [])
    if (!graph.get(a)!.some(e => e.to === b)) { graph.get(a)!.push({ to: b, run, regulator }); graph.get(b)!.push({ to: a, run, regulator }) }
  }
  const issues: string[] = [], assumptions = ['One zone valve operates at a time.', 'Fixed device demand. Hazen-Williams C uses each pipe setting.', 'Unspecified internal diameters use nominal inches as an estimate.', `${source.componentAllowanceBar.toFixed(2)} bar allowance for supply components; confirm actual valve/filter/backflow losses.`]
  for (const raw of Object.values(nodes)) {
    const value = raw as { id?: string; parentId?: string; zone?: string }
    if (value.parentId !== source.parentId || !value.id) continue
    const ports = irrigationPorts(raw)
    for (const p of ports) owner.set(key(p.nodeId, p.id), raw)
    const run = IrrigationRunNode.safeParse(raw)
    const fitting = IrrigationFittingNode.safeParse(raw), valve = IrrigationValveNode.safeParse(raw)
    if (run.success) {
      const problems = irrigationRunIssues(run.data, nodes).filter(i => !i.endsWith('connected valve is closed.') && !i.endsWith('water supply is disabled.'))
      if (problems.length) { if (run.data.zone === zone || run.data.zone === '') issues.push(`${run.data.name || 'Pipe'}: ${problems[0]}`); continue }
      link(key(value.id, 'start'), key(value.id, 'end'), run.data)
      for (const [end, ref] of [['start', run.data.startConnection], ['end', run.data.endConnection]] as const) if (ref) link(key(value.id, end), key(ref.nodeId, ref.portId))
    } else if (fitting.success) {
      for (let i = 1; i < ports.length; i++) link(key(value.id, ports[0]!.id), key(value.id, ports[i]!.id), undefined, fitting.data.fittingType === 'filter-regulator' ? fitting.data.regulatedPressureBar : undefined)
    } else if (valve.success && valve.data.zone === zone) {
      if (!valve.data.isOpen) issues.push(`${valve.data.name || 'Zone valve'} is closed.`)
      else link(key(value.id, 'inlet'), key(value.id, 'outlet'))
    }
  }
  const root = key(source.id, 'outlet'), parent = new Map<string, string>(), via = new Map<string, Edge>(), order: string[] = [root], seen = new Set([root])
  let loop = false
  for (let i = 0; i < order.length; i++) {
    const id = order[i]!
    for (const edge of graph.get(id) || []) {
      if (edge.to === parent.get(id)) continue
      if (seen.has(edge.to)) { loop = true; continue }
      seen.add(edge.to); parent.set(edge.to, id); via.set(edge.to, edge); order.push(edge.to)
    }
  }
  const demand = new Map<string, number>(), targets = new Map<string, { id: string; elevation: number; required: number; max?: number }>()
  for (const raw of Object.values(nodes)) {
    const head = IrrigationHeadNode.safeParse(raw), drip = DriplineNode.safeParse(raw)
    const node = head.success ? head.data : drip.success ? drip.data : null
    if (!node || node.parentId !== source.parentId || node.zone !== zone) continue
    const id = key(node.id, 'inlet')
    if (!seen.has(id)) { issues.push(`${node.name || 'Watering device'} is not connected to this supply.`); continue }
    demand.set(id, head.success ? head.data.flow : driplineMetrics(drip.data!).flow)
    targets.set(id, { id: node.id, elevation: head.success ? head.data.position[1] : drip.data!.path[0]![1], required: node.requiredPressureBar, max: drip.success ? drip.data.maximumPressureBar : undefined })
  }
  const runs: HydraulicReview['runs'] = []
  for (const id of [...order].reverse()) {
    const upstream = parent.get(id), total = demand.get(id) || 0, edge = via.get(id)
    if (edge?.run) {
      const pipe = edge.run, result = pipeLossBar(irrigationRunLength(pipe), total, pipe.internalDiameterMm ?? pipe.diameter * 25.4, pipe.roughnessC, pipe.minorLossK)
      runs.push({ id: pipe.id, flow: total, ...result, suggestedDiameter: selectPipeDiameter(total) })
      if (result.velocity > 1.5) issues.push(`${pipe.name || 'Pipe'} exceeds the 1.5 m/s design velocity.`)
    }
    if (upstream) demand.set(upstream, (demand.get(upstream) || 0) + total)
  }
  const pressures = new Map([[root, source.pressureBar - source.componentAllowanceBar]])
  const byRun = new Map(runs.map(r => [r.id, r]))
  for (const id of order.slice(1)) {
    const edge = via.get(id)!, previous = pressures.get(parent.get(id)!) || 0
    let pressure = previous - (edge.run ? byRun.get(edge.run.id)!.lossBar : 0)
    if (edge.regulator) pressure = Math.min(pressure, edge.regulator)
    pressures.set(id, pressure)
  }
  const outlets = [...targets].map(([id, t]) => ({ id: t.id, pressureBar: (pressures.get(id) || 0) - (t.elevation - source.position[1]) * .0980665, requiredPressureBar: t.required, maximumPressureBar: t.max }))
  if (loop) issues.push('This network contains a loop. Pressure checks need a loop solver; tree estimates are withheld.')
  for (const outlet of outlets) {
    if (outlet.pressureBar < outlet.requiredPressureBar) issues.push('At least one device has insufficient estimated pressure.')
    if (outlet.maximumPressureBar && outlet.pressureBar > outlet.maximumPressureBar) issues.push('Drip pressure exceeds the tubing setting. Check its regulator.')
  }
  const budget = source.availableFlow * source.designFlowFraction, total = demand.get(root) || 0
  if (total > budget + 1e-6) issues.push('Zone demand exceeds the design flow budget. Split the zone.')
  if (!source.enabled) issues.push('Supply is disabled.')
  if (!source.backflowProvided) issues.push('Supply backflow protection has not been confirmed.')
  if (!source.measurementStatus || source.measurementStatus !== 'measured') issues.push('Supply pressure and flow are assumed. Enter measured values.')
  if (!targets.size) issues.push('No watering devices are connected in this zone.')
  const unique = [...new Set(issues)]
  return { demand: total, budget, runs: loop ? [] : runs, outlets: loop ? [] : outlets, issues: unique, status: source.measurementStatus !== 'measured' ? 'draft' : unique.length ? 'review' : 'ready', assumptions }
}
