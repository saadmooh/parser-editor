import { expect, test } from 'bun:test'
import { IrrigationControllerNode, controllerSchedule, controllerAssignmentIssues } from './controller'
test('controller sequence skips unassigned and disabled stations and carries across midnight', () => {
  const node = IrrigationControllerNode.parse({ startTime: '23:50' })
  node.stations[0] = { valveId: 'irrigation-valve_one', runMinutes: 20, enabled: true }
  node.stations[2] = { valveId: 'irrigation-valve_two', runMinutes: 10, enabled: false }
  node.stations[3] = { valveId: 'irrigation-valve_three', runMinutes: 30, enabled: true }
  const rows = controllerSchedule(node)
  expect(rows[0]!.start).toBe('23:50')
  expect(rows[0]!.end).toBe('00:10 (+1 day)')
  expect(rows[1]!.start).toBeNull()
  expect(rows[2]!.start).toBeNull()
  expect(rows[3]!.start).toBe('00:10 (+1 day)')
  expect(rows[3]!.end).toBe('00:40 (+1 day)')
  expect(controllerSchedule({ ...node, enabled: false }).every(row => !row.active)).toBe(true)
  expect(IrrigationControllerNode.safeParse({ startTime: '24:00' }).success).toBe(false)
  expect(IrrigationControllerNode.safeParse({ stations: [{ runMinutes: Infinity }] }).success).toBe(false)
})

test('watering days and seasonal adjustment preserve base durations and day offsets', () => {
  const node = IrrigationControllerNode.parse({ wateringDays: [1, 3, 5], seasonalPercent: 150 })
  node.stations[0] = { valveId: 'irrigation-valve_one', runMinutes: 20, enabled: true }
  expect(controllerSchedule(node, 1)[0]!.end).toBe('06:30')
  expect(controllerSchedule(node, 1)[0]!.adjustedMinutes).toBe(30)
  expect(node.stations[0]!.runMinutes).toBe(20)
  expect(controllerSchedule(node, 2)[0]!.active).toBe(false)
  expect(controllerSchedule({ ...node, wateringDays: [] })[0]!.active).toBe(false)
  expect(controllerSchedule({ ...node, seasonalPercent: 0 })[0]!.active).toBe(false)
  expect(IrrigationControllerNode.safeParse({ wateringDays: [1, 1] }).success).toBe(false)
  const long = IrrigationControllerNode.parse({ startTime: '23:50', seasonalPercent: 200 })
  long.stations = long.stations.map((station, index) => ({ ...station, valveId: `irrigation-valve_${index}`, runMinutes: 180 }))
  expect(controllerSchedule(long).at(-1)!.end).toBe('23:50 (+2 days)')
})

test('assignment audit catches missing, foreign, closed and duplicated valve references', () => {
  const controller = IrrigationControllerNode.parse({})
  controller.stations[0]!.valveId = 'valve-one'
  controller.stations[1]!.valveId = 'missing'
  const duplicate = IrrigationControllerNode.parse({ stations: controller.stations })
  const issues = controllerAssignmentIssues(controller, [{ id: 'valve-one', parentId: 'another-parent', isOpen: false }], [controller, duplicate])
  expect(issues).toContain('Station 1: assigned valve is on another parent.')
  expect(issues).toContain('Station 1: valve is authored closed; actuation is not simulated.')
  expect(issues).toContain('Station 1: valve is assigned to 2 stations; review duplicate control.')
  expect(issues).toContain('Station 2: assigned valve is missing.')
  expect(controllerSchedule(controller)[0]!.start).toBe('06:00')
})
