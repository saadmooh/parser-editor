import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { routeSourceToValve, routeValveToDripline, IrrigationRunNode, irrigationRunDefinition, irrigationRunIssues, irrigationRunLength, routeBetweenHeads, routeValveToHead } from './run'
import { IrrigationValveNode, irrigationValvePorts } from './valve'

test('irrigation route preserves outlet positions and compatible typed ports', () => {
  const a = IrrigationHeadNode.parse({ parentId: 'level_test', position: [1, 0.2, 3], inletDiameter: 0.75 })
  const b = IrrigationHeadNode.parse({ parentId: 'level_test', position: [5, 0.5, 7], inletDiameter: 0.75 })
  const run = routeBetweenHeads(a, b, 0.3)!
  expect(run.path[0]).toEqual(a.position)
  expect(run.path.at(-1)).toEqual(b.position)
  expect(run.path[1]![1]).toBeCloseTo(-0.1)
  expect(irrigationRunLength(run)).toBeCloseTo(8.9)
  expect(run.startConnection).toEqual({ nodeId: a.id, portId: 'inlet' })
  expect(run.endConnection).toEqual({ nodeId: b.id, portId: 'inlet' })
  const ports = irrigationRunDefinition.ports!(run)
  expect(ports.map(p => p.system)).toEqual(['irrigation', 'irrigation'])
  expect(ports.map(p => p.direction)).toEqual([[0, 1, 0], [0, 1, 0]])
  expect(ports[0]!.diameter).toBe(0.75)
})

test('valve route mates physical outlet with opposed run direction and retains closed connection', () => {
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [3, 0, 0], rotation: [0, Math.PI / 2, 0], diameter: 0.5 })
  const head = IrrigationHeadNode.parse({ parentId: 'level_test' })
  const run = routeValveToHead(valve, head, 0.3)!
  const outlet = irrigationValvePorts(valve)[1]!
  expect(run.path[0]).toEqual([...outlet.position] as [number, number, number])
  expect(run.startConnection).toEqual({ nodeId: valve.id, portId: 'outlet' })
  expect(run.path.at(-1)).toEqual(head.position)
  const start = irrigationRunDefinition.ports!(run)[0]!
  expect(start.direction[2]).toBeCloseTo(-outlet.direction[2])
  expect(irrigationRunIssues(run, { [valve.id]: valve, [head.id]: head })).toEqual([])
  expect(irrigationRunIssues(run, { [valve.id]: { ...valve, isOpen: false }, [head.id]: head })).toEqual(['Start: connected valve is closed.'])
  expect(routeValveToHead({ ...valve, diameter: 0.75 }, head, 0.3)).toBeNull()
  expect(routeValveToHead({ ...valve, parentId: 'level_other' }, head, 0.3)).toBeNull()
})

test('connection checks detect stale outlet pose, size, zone and missing references', () => {
  const a = IrrigationHeadNode.parse({ parentId: 'level_test' })
  const b = IrrigationHeadNode.parse({ parentId: 'level_test', position: [2, 0, 0] })
  const run = routeBetweenHeads(a, b, 0.3)!
  expect(irrigationRunIssues(run, { [a.id]: a, [b.id]: b })).toEqual([])
  const changed = { ...b, inletDiameter: 0.75, zone: 'Zone 2', position: [3, 0, 0] }
  expect(irrigationRunIssues(run, { [a.id]: a, [b.id]: changed })).toEqual([
    'End: centerline no longer meets the outlet.',
    'End: nominal diameter differs; a reducer is required.',
    'End: zone differs from the outlet.',
  ])
  expect(irrigationRunIssues(run, { [a.id]: a })).toEqual(['End: connected outlet is missing.'])
  expect(irrigationRunIssues({ ...run, startConnection: undefined }, { [b.id]: b })).toEqual(['Start: no outlet connection.'])
})
test('route rejects incompatible parents, zones, diameters and coincident heads', () => {
  const a = IrrigationHeadNode.parse({ parentId: 'level_test' })
  const b = IrrigationHeadNode.parse({ parentId: 'level_test', position: [2, 0, 0] })
  expect(routeBetweenHeads(a, b, 0.3)).not.toBeNull()
  for (const patch of [{ parentId: 'level_other' }, { zone: 'Zone 2' }, { inletDiameter: 1 }, { position: [0, 0, 0] as [number, number, number] }]) expect(routeBetweenHeads(a, { ...b, ...patch }, 0.3)).toBeNull()
  expect(routeBetweenHeads(a, b, NaN)).toBeNull()
})

import { DriplineNode } from './dripline'
test('run checks recognize dripline inlet and track edited start vertex', () => {
  const drip = DriplineNode.parse({ path: [[0, 0, 0], [3, 0, 0]] })
  const run = IrrigationRunNode.parse({ path: [[-1, 0, 0], [0, 0, 0]], endConnection: { nodeId: drip.id, portId: 'inlet' } })
  expect(irrigationRunIssues(run, { [drip.id]: drip })).toEqual(['Start: no outlet connection.'])
  expect(irrigationRunIssues(run, { [drip.id]: { ...drip, path: [[0, 0, 1], [3, 0, 0]] } })).toContain('End: centerline no longer meets the outlet.')
})

test('valve-to-dripline route connects typed inlet and rejects incompatible size', () => {
  const drip = DriplineNode.parse({ parentId: 'level_test' })
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [3, 0, 0], diameter: 0.5 })
  const run = routeValveToDripline(valve, drip, 0.3)!
  expect(run.endConnection).toEqual({ nodeId: drip.id, portId: 'inlet' })
  expect(irrigationRunIssues(run, { [valve.id]: valve, [drip.id]: drip })).toEqual([])
  expect(routeValveToDripline({ ...valve, diameter: 0.75 }, drip, 0.3)).toBeNull()
})

test('irrigation runs identify their loop for the shared host summary', () => {
  expect(IrrigationRunNode.parse({}).system).toBe('irrigation')
  expect(IrrigationRunNode.safeParse({ system: 'refrigerant' }).success).toBe(false)
})

import { IrrigationSourceNode } from './source'
test('source-to-valve route mates sockets and reports disabled supply', () => {
  const source = IrrigationSourceNode.parse({ parentId: 'level_test' })
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [3, 0, 0] })
  const run = routeSourceToValve(source, valve, 0.3)!
  expect(run.startConnection).toEqual({ nodeId: source.id, portId: 'outlet' })
  expect(run.endConnection).toEqual({ nodeId: valve.id, portId: 'inlet' })
  expect(irrigationRunIssues(run, { [source.id]: source, [valve.id]: valve })).toEqual([])
  expect(irrigationRunIssues(run, { [source.id]: { ...source, enabled: false }, [valve.id]: valve })).toEqual(['Start: water supply is disabled.'])
  expect(routeSourceToValve({ ...source, diameter: 1 }, valve, 0.3)).toBeNull()
})

test('nominal routing sizes tolerate metric input conversion roundoff', () => {
  const source = IrrigationSourceNode.parse({ parentId: 'level_test', diameter: 0.75 })
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [3, 0, 0], diameter: 0.7500000000000001 })
  expect(routeSourceToValve(source, valve, 0.3)).not.toBeNull()
  const head = IrrigationHeadNode.parse({ parentId: 'level_test', position: [6, 0, 0], inletDiameter: 0.75 })
  expect(routeValveToHead(valve, head, 0.3)).not.toBeNull()
})

test('run endpoint edits detect a socket approach that still meets its position', () => {
  const a = IrrigationHeadNode.parse({ parentId: 'level_test' })
  const b = IrrigationHeadNode.parse({ parentId: 'level_test', position: [3, 0, 0] })
  const run = routeBetweenHeads(a, b, 0.3)!
  const bent = { ...run, path: run.path.map((point, index) => index === 1 ? [1, -0.3, 0] as [number, number, number] : point) }
  expect(irrigationRunIssues(bent, { [a.id]: a, [b.id]: b })).toEqual(['Start: centerline approaches against the socket direction; a fitting is required.'])
  expect(irrigationRunIssues(run, { [a.id]: a, [b.id]: b })).toEqual([])
})
