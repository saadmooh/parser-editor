import { expect, test } from 'bun:test'
import { PLANT_PRESETS } from '../plant/domain/catalog'
import { TREE_SPECIES } from '../tree/domain/species'
import { plantingCode } from './planting-codes'
import { plantingSchedule } from './schedules'

test('all catalog entries have distinct planting codes across trees and plants', () => {
  const entries = [...PLANT_PRESETS.map((plant) => ({ preset: plant.key })), ...TREE_SPECIES.map((tree) => ({ species: tree.key }))]
  const codes = entries.map(plantingCode)
  expect(new Set(codes).size).toBe(entries.length)
  expect(plantingCode({ preset: 'fab:daisy' })).toBe('P-DAI')
  expect(plantingCode({ species: 'whiteOak' })).toBe('T-WO')
})

test('legend schedules use the same code as plan labels and retain grouped counts', () => {
  const schedule = plantingSchedule({ siblings: [
    { id: 'a', type: 'landscape:plant', preset: 'fab:daisy' },
    { id: 'b', type: 'landscape:plant', preset: 'fab:daisy' },
  ], unit: 'metric' })!
  expect(schedule.rows[0]?.cells.code).toBe(plantingCode({ preset: 'fab:daisy' }))
  expect(schedule.rows[0]?.cells.count).toBe('2')
})
