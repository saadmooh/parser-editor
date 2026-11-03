import { expect, test } from 'bun:test'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { IrrigationSourceNode } from './source'
import { IrrigationHeadNode } from './schema'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { IrrigationControllerNode } from './controller'
import { IrrigationFittingNode } from './fitting'
import { proposeAreaWatering, proposeAutomaticAreaWatering, splitWateringDemand } from './watering-plan'
import { mergePlan } from './connect-zone'
const options = { method: 'sprinkler' as const, zone: 'Lawn', radius: 4.1, fullCircleFlow: 3.18, rowSpacing: .5, emitterSpacing: .3, emitterFlow: 2, profile: 'hunter-mp1000' as const }
const area = GroundAreaNode.parse({ parentId: 'level_test', name: 'Front lawn', outline: [[0, 0], [8, 0], [8, 6], [0, 6]] })

test('full lawn proposal creates routes, valves and schedule without changing the scene', () => {
  const source = IrrigationSourceNode.parse({ parentId: area.parentId, position: [-4, 0, -4], pressureBar: 4, availableFlow: 30, measurementStatus: 'measured', backflowProvided: true })
  const original = { [area.id]: area, [source.id]: source }
  const proposal = proposeAreaWatering(area, options, source, original)
  const nodes = mergePlan(original, proposal.plan)
  expect(proposal.reviews[0]!.outlets.length).toBe(proposal.layout.devices.length)
  expect(proposal.reviews[0]!.status).toBe('ready')
  expect(proposal.plan.create.some(raw => IrrigationControllerNode.safeParse(raw).success)).toBe(true)
  for (const raw of proposal.plan.create) { const pipe = IrrigationRunNode.safeParse(raw); if (pipe.success) expect(irrigationRunIssues(pipe.data, nodes)).toEqual([]) }
  expect(Object.keys(original)).toHaveLength(2)
  expect(proposeAreaWatering(area, options, source, nodes).plan.create).toHaveLength(0)
})
test('drip proposal clips rows, adds filtration, and has no sprinkler devices', () => {
  const bed = { ...area, name: 'Bed', outline: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][] }
  const source = IrrigationSourceNode.parse({ parentId: area.parentId, position: [-4, 0, -4], pressureBar: 4 })
  const proposal = proposeAreaWatering(bed, { ...options, method: 'drip' }, source, { [bed.id]: bed, [source.id]: source })
  expect(proposal.plan.create.some(raw => IrrigationHeadNode.safeParse(raw).success)).toBe(false)
  expect(proposal.plan.create.filter(raw => IrrigationFittingNode.safeParse(raw).data?.fittingType === 'filter-regulator')).toHaveLength(proposal.zones.length)
  expect(proposal.reviews[0]!.outlets.length).toBe(proposal.layout.devices.length)
})
test('low capacity splits zones and unknown supply stays a draft', () => {
  const source = IrrigationSourceNode.parse({ parentId: area.parentId, position: [-4, 0, -4], availableFlow: 5, pressureBar: 4 })
  const proposal = proposeAreaWatering(area, options, source, { [area.id]: area, [source.id]: source })
  expect(proposal.zones.length).toBeGreaterThan(1)
  expect(proposal.reviews.every(r => r.demand <= r.budget)).toBe(true)
  const draft = proposeAreaWatering(area, options, undefined, { [area.id]: area })
  expect(draft.reviews).toHaveLength(0)
  expect(draft.plan.create.some(raw => IrrigationRunNode.safeParse(raw).success)).toBe(false)
  expect(splitWateringDemand([IrrigationHeadNode.parse({ flow: 10 })], 2)).toHaveLength(1)
})

test('draft can be connected later without replacing devices and zero capacity stays in review', () => {
  const draft = proposeAreaWatering(area, options, undefined, { [area.id]: area })
  const source = IrrigationSourceNode.parse({ parentId: area.parentId, position: [-4, 0, -4], availableFlow: 0, pressureBar: 4, measurementStatus: 'measured', backflowProvided: true })
  const nodes = mergePlan({ [area.id]: area, [source.id]: source }, draft.plan)
  const connected = proposeAreaWatering(area, options, source, nodes)
  expect(connected.plan.create.some(raw => IrrigationHeadNode.safeParse(raw).success)).toBe(false)
  expect(connected.reviews[0]!.outlets).toHaveLength(draft.layout.devices.length)
  expect(connected.reviews[0]!.status).toBe('review')
  expect(connected.reviews[0]!.issues.join(' ')).toContain('flow budget')
})

test('existing controller programs are preserved while free stations receive the new valve', () => {
  const source = IrrigationSourceNode.parse({ parentId: area.parentId, position: [-4, 0, -4], pressureBar: 4 })
  const controller = IrrigationControllerNode.parse({ parentId: area.parentId, wateringDays: [2, 6], startTime: '05:33', stations: [{ valveId: 'irrigation-valve_existing', runMinutes: 7, enabled: false }, { runMinutes: 12, enabled: false }, ...Array.from({ length: 6 }, () => ({ runMinutes: 20, enabled: true }))] })
  const proposal = proposeAreaWatering(area, options, source, { [area.id]: area, [source.id]: source, [controller.id]: controller })
  const updated = IrrigationControllerNode.parse(mergePlan({ [controller.id]: controller }, proposal.plan)[controller.id])
  expect(updated.wateringDays).toEqual([2, 6])
  expect(updated.startTime).toBe('05:33')
  expect(updated.stations[0]).toEqual(controller.stations[0])
  expect(updated.stations[1]!.valveId).toBeDefined()
  expect(proposal.plan.create.some(raw => IrrigationControllerNode.safeParse(raw).success)).toBe(false)
})

test('automatic watering includes a corner supply, valve and connected pipes for either method', () => {
  for (const method of ['sprinkler', 'drip'] as const) {
    const original = { [area.id]: area }
    const proposal = proposeAutomaticAreaWatering(area, { ...options, method }, original)
    expect(proposal.snapshot).toBe(original)
    expect(proposal.supply?.measurementStatus).toBe('assumed')
    expect(proposal.plan.create.filter(raw => IrrigationSourceNode.safeParse(raw).success)).toHaveLength(1)
    expect(proposal.reviews.every(r => r.outlets.length > 0 && r.status === 'draft')).toBe(true)
    expect(proposal.reviews.reduce((n, r) => n + r.outlets.length, 0)).toBe(proposal.layout.devices.length)
    const merged = mergePlan(original, proposal.plan)
    expect(proposeAutomaticAreaWatering(area, { ...options, method }, merged).plan.create).toHaveLength(0)
    expect(Object.keys(original)).toHaveLength(1)
  }
})
test('automatic supply selection reuses the nearest enabled supply and connects a later area through its main', () => {
  const near = IrrigationSourceNode.parse({ parentId: area.parentId, position: [-4, 0, -4], name: 'Garden tap' })
  const far = IrrigationSourceNode.parse({ parentId: area.parentId, position: [-40, 0, -40] })
  const disabled = IrrigationSourceNode.parse({ parentId: area.parentId, position: [1, 0, 1], enabled: false })
  const original = { [area.id]: area, [near.id]: near, [far.id]: far, [disabled.id]: disabled }
  const first = proposeAutomaticAreaWatering(area, options, original)
  expect(first.supply?.id).toBe(near.id)
  expect(first.plan.create.some(raw => IrrigationSourceNode.safeParse(raw).success)).toBe(false)
  const bed = GroundAreaNode.parse({ parentId: area.parentId, name: 'Side bed', outline: [[12, 0], [16, 0], [16, 2], [12, 2]] })
  const nodes = { ...mergePlan(original, first.plan), [bed.id]: bed }
  const second = proposeAutomaticAreaWatering(bed, { ...options, method: 'drip' }, nodes)
  expect(second.supply?.id).toBe(near.id)
  expect(second.reviews.reduce((n, r) => n + r.outlets.length, 0)).toBe(second.layout.devices.length)
  expect(second.plan.update.length).toBeGreaterThan(0)
  expect(second.plan.create.some(raw => IrrigationSourceNode.safeParse(raw).success)).toBe(false)
  expect(proposeAutomaticAreaWatering(bed, { ...options, method: 'drip' }, nodes, 'draft').supply).toBeUndefined()
})
