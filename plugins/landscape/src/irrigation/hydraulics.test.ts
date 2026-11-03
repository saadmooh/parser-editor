import { expect, test } from 'bun:test'
import { pipeLossBar, selectPipeDiameter, reviewZoneHydraulics } from './hydraulics'
import { IrrigationHeadNode } from './schema'
import { IrrigationSourceNode } from './source'
import { IrrigationValveNode } from './valve'
import { planConnectZone, mergePlan } from './connect-zone'
import { irrigationPorts } from './ports'

test('Hazen-Williams uses SI units and scales correctly with flow, length and diameter', () => {
  // Independent reference: 100 m, 1 L/s, 25 mm bore, C=150 gives ~17.6 m head.
  const reference = pipeLossBar(100, 60, 25)
  expect(reference.lossBar).toBeGreaterThan(1.7)
  expect(reference.lossBar).toBeLessThan(1.75)
  expect(pipeLossBar(200, 60, 25).lossBar).toBeCloseTo(reference.lossBar * 2)
  expect(pipeLossBar(100, 120, 25).lossBar / reference.lossBar).toBeCloseTo(2 ** 1.852)
  expect(pipeLossBar(100, 60, 50).lossBar).toBeLessThan(reference.lossBar / 20)
  expect(pipeLossBar(100, 0, 25).lossBar).toBe(0)
  expect(() => pipeLossBar(10, 5, 0)).toThrow()
  expect(selectPipeDiameter(30)).toBe(1)
})
test('zone review counts downstream demand once and separates inactive valves', () => {
  const source = IrrigationSourceNode.parse({ parentId: 'level_test', pressureBar: 4, availableFlow: 30, measurementStatus: 'measured', backflowProvided: true })
  const valve = IrrigationValveNode.parse({ parentId: source.parentId, position: [2, 0, 1], zone: 'Lawn', diameter: .75 })
  const heads = [[5, 0, 3], [8, 0, 5]].map(position => IrrigationHeadNode.parse({ parentId: source.parentId, zone: valve.zone, position, flow: 4 }))
  const original = Object.fromEntries([source, valve, ...heads].map(n => [n.id, n]))
  const plan = planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, heads.flatMap(irrigationPorts), .4, original)
  const nodes = mergePlan(original, plan)
  const review = reviewZoneHydraulics(source, valve.zone, nodes)
  expect(review.demand).toBe(8)
  expect(Math.max(...review.runs.map(r => r.flow))).toBe(8)
  expect(review.outlets).toHaveLength(2)
  expect(review.outlets.every(o => o.pressureBar > 2.1)).toBe(true)
  expect(review.status).toBe('ready')
  const weak = reviewZoneHydraulics({ ...source, availableFlow: 5, pressureBar: 1 }, valve.zone, nodes)
  expect(weak.issues.join(' ')).toContain('Split')
  expect(weak.issues.join(' ')).toContain('insufficient')
  expect(reviewZoneHydraulics({ ...source, measurementStatus: 'assumed' }, valve.zone, nodes).status).toBe('draft')
  expect(reviewZoneHydraulics(source, valve.zone, { ...nodes, [valve.id]: { ...valve, isOpen: false } }).outlets).toHaveLength(0)
})
