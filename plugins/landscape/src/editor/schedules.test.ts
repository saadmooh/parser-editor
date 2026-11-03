import { expect, test } from 'bun:test'
import { hardscapeSchedule, plantingSchedule } from './schedules'
import type { AnyNode } from '@pascal-app/core'

test('plant schedule groups placed species and keeps different presets separate', () => {
  const schedule = plantingSchedule({ siblings: [
    { id: 'a', type: 'landscape:plant', preset: 'fab:oak' },
    { id: 'b', type: 'landscape:plant', preset: 'fab:oak' },
    { id: 'c', type: 'landscape:plant', preset: 'fab:maple' },
  ], unit: 'metric' })!
  expect(schedule.rows).toHaveLength(2)
  expect(schedule.rows.find((row) => row.id === 'fab:oak')?.cells.count).toBe('2')
  expect(plantingSchedule({ siblings: [], unit: 'metric' })).toBeNull()
})

test('imperial schedule converts areas without changing stored dimensions', () => {
  const patio = { id: 'a', type: 'landscape:patio', width: 4, depth: 3, shape: 'rectangle' }
  const schedule = hardscapeSchedule({ siblings: [patio], unit: 'imperial' })!
  expect(schedule.rows[0]?.cells.area).toBe('129.17')
  expect(patio.width).toBe(4)
  expect(schedule.rows[0]?.cells.net).toBe('—')
  expect(schedule.rows[0]?.cells.ordering).toBe('—')
})

test('hardscape schedule deducts pool openings and uses saved ordering allowance', () => {
  const patio = { id: 'patio', type: 'landscape:patio', parentId: 'level', position: [0, 0, 0], rotation: 0,
    width: 4, depth: 3, shape: 'rectangle' }
  const pool = { id: 'pool', type: 'pool:pool', parentId: 'level', position: [0, 0, 0], rotation: 0,
    length: 1, width: 1, visible: true }
  const nodes = { patio, pool, level: { id: 'level', type: 'level', metadata: { landscapeWastePercent: 10 } } } as unknown as Record<string, AnyNode>
  const input = { siblings: [patio], nodes, levelId: 'level', unit: 'metric' as const }
  const schedule = hardscapeSchedule(input)!
  const row = schedule.rows[0]!.cells
  expect(row.area).toBe('12.00')
  expect(Number(row.net)).toBeLessThan(11)
  expect(Number(row.net)).toBeGreaterThan(10)
  expect(Number(row.ordering)).toBeCloseTo(Number(row.net) * 1.1, 1)
  expect(schedule.columns.find(column => column.key === 'ordering')?.label).toContain('+10%')
  nodes.pool = { ...nodes.pool, visible: false } as AnyNode
  expect(hardscapeSchedule(input)!.rows[0]!.cells.net).toBe('12.00')
  expect(hardscapeSchedule(input)!.rows[0]!.cells.ordering).toBe('13.20')
  nodes.level = { ...nodes.level, metadata: { landscapeWastePercent: Number.NaN } } as AnyNode
  expect(hardscapeSchedule(input)!.rows[0]!.cells.ordering).toBe('12.00')
})
