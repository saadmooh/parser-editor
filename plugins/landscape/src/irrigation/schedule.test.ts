import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { irrigationScheduleCsv } from './schedule'
test('schedule quotes authored fields safely and includes zone demand totals', () => {
  const csv = irrigationScheduleCsv([IrrigationHeadNode.parse({ name: '=formula,"head"', zone: '+zone', flow: 2.5 }), IrrigationHeadNode.parse({ zone: '+zone', flow: 4, visible: false })])
  expect(csv).toContain('"\'=formula,""head"""')
  expect(csv).toContain('"\'+zone"')
  expect(csv).toContain('"Zone total","\'+zone","","","6.5","","","","2"')
  expect(csv.split('\r\n')).toHaveLength(4)
})
test('schedule retains nominal inlet size precision and explicit units', () => {
  const csv = irrigationScheduleCsv([IrrigationHeadNode.parse({ inletDiameter: 0.75 })])
  expect(csv.split('\r\n')[0]).toContain('"Nominal diameter (in)"')
  expect(csv.split('\r\n')[1]).toContain('"0.75","1"')
  expect(csv.split('\r\n')[2]).toContain('"","1"')
})

import { DriplineNode } from './dripline'
import { IrrigationValveNode } from './valve'
import { IrrigationControllerNode } from './controller'
import { IrrigationRunNode } from './run'
test('complete inventory export includes drip-only zones and controller station configuration', () => {
  const valve = IrrigationValveNode.parse({ zone: 'Courtyard', isOpen: false })
  const controller = IrrigationControllerNode.parse({ seasonalPercent: 150, wateringDays: [1, 3], stations: Array.from({ length: 8 }, (_, index) => ({ valveId: index === 0 ? valve.id : undefined, runMinutes: 20 })) })
  const csv = irrigationScheduleCsv([], { driplines: [DriplineNode.parse({ zone: 'Courtyard', emitterSpacing: 0.5 })], valves: [valve], controllers: [controller], runs: [IrrigationRunNode.parse({})] })
  expect(csv).toContain('"Dripline","Courtyard"')
  expect(csv).toContain('"7"')
  expect(csv).toContain('"Closed"')
  expect(csv).toContain('"Run","Zone 1"')
  expect(csv).toContain('"Configured","1"')
  expect(csv).toContain('"20","30","06:00","06:30","1;3","150"')
  expect(csv.split('\r\n').filter(row => row.startsWith('"Controller station"'))).toHaveLength(8)
})

test('run export retains endpoint review failures', () => {
  const csv = irrigationScheduleCsv([], { runs: [IrrigationRunNode.parse({})] })
  expect(csv).toContain('"Connection review"')
  expect(csv).toContain('Start: no outlet connection')
  expect(csv).toContain('End: no outlet connection')
})

import { IrrigationSourceNode } from './source'
test('supply export retains authored inputs and readiness evidence', () => {
  const csv = irrigationScheduleCsv([], { sources: [IrrigationSourceNode.parse({ enabled: false, pressureBar: 2.5, availableFlow: 3 })] })
  expect(csv).toContain('"Connected installed demand (L/min)"')
  expect(csv).toContain('"Available flow margin (L/min)"')
  expect(csv).toContain('"2.5","3","0","0","3","Supply is disabled.; No head or dripline is connected through matching sockets."')
})
