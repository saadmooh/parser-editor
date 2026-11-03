import { expect, test } from 'bun:test'
import { materialTakeoff, type QuantityRow } from './quantities'
const row = (id: string, material: string, area: number | null, netArea?: number | null): QuantityRow => ({ id, label: id, material, area, netArea, count: 1, length: null })
test('material takeoff groups net surfaces before applying waste and excludes unmeasured assets', () => {
  expect(materialTakeoff([row('a', 'cedar', 10, 8), row('b', 'cedar', 5, 4), row('c', 'stone', 3, 3), row('asset', '', null)], 10)).toEqual([
    { material: 'cedar', count: 2, grossArea: 15, netArea: 12, orderingArea: 13.200000000000001 },
    { material: 'stone', count: 1, grossArea: 3, netArea: 3, orderingArea: 3.3000000000000003 },
  ])
})
test('one unknown net area prevents an invented grouped ordering area', () => {
  const group = materialTakeoff([row('a', 'stone', 10, 8), row('b', 'stone', 5)], 10)[0]!
  expect(group.grossArea).toBe(15)
  expect(group.netArea).toBeNull()
  expect(group.orderingArea).toBeNull()
})

import { materialTakeoffCsv } from './quantities'
test('material CSV escapes formula names and leaves unknown ordering fields blank', () => {
  const csv = materialTakeoffCsv([row('a', '=unsafe,"finish"', 5, 4), row('b', 'unknown', 2)], 10)
  expect(csv).toContain('"\'=unsafe,""finish""","1","5.00","4.00","10","4.40"')
  expect(csv).toContain('"unknown","1","2.00","","",""')
  expect(csv.split('\r\n')).toHaveLength(3)
})
