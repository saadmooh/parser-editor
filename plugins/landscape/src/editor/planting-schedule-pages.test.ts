import { expect, test } from 'bun:test'
import type { FloorplanSchedule } from '@pascal-app/editor'
import { plantingSchedulePages } from './planting-schedule-pages'

test('planting schedule pages paginate without losing or duplicating species', () => {
  const schedule: FloorplanSchedule = { id: 'plants', title: 'Plant schedule', columns: [],
    rows: Array.from({ length: 63 }, (_, index) => ({ id: String(index), cells: {
      code: `P-${index}`, name: `Plant ${index}`, botanical: '—', count: String(index + 1),
    } })) }
  const pages = plantingSchedulePages([schedule], 'Ground floor')
  expect(pages).toHaveLength(3)
  const labels = pages.flatMap(page => page.overlay.flatMap(item => item.kind === 'text' ? [item.text] : []))
  for (let index = 0; index < 63; index++) expect(labels.filter(label => label === `P-${index}`)).toHaveLength(1)
  expect(pages.map(page => page.number)).toEqual(['LPS-1', 'LPS-2', 'LPS-3'])
  for (const page of pages) expect(page.overlay.every(item => item.kind !== 'text' || item.y < page.heightIn)).toBe(true)
})

test('planting schedule wraps long names and separates plant and tree sections', () => {
  const name = 'A deliberately long botanical species name with additional words'
  const schedule: FloorplanSchedule = { id: 'trees', title: 'Tree schedule', columns: [],
    rows: [{ id: 'tree', cells: { code: 'T-ONE', name: 'White oak', botanical: name, count: '2' } }] }
  const pages = plantingSchedulePages([schedule, { ...schedule, id: 'plants', title: 'Plant schedule' }], 'Ground floor')
  expect(pages.map(page => page.title)).toEqual(['Tree schedule', 'Plant schedule'])
  const lines = pages[0]!.overlay.flatMap(item => item.kind === 'text' && item.x === 4.3 && item.y >= 1.95 ? [item.text] : [])
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.join(' ')).toBe(name)
  expect(plantingSchedulePages([], 'Ground floor')).toEqual([])
})
