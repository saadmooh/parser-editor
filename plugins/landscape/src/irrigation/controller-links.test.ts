import { expect, test } from 'bun:test'
import { IrrigationControllerNode } from './controller'
import { IrrigationValveNode } from './valve'
import { controllerLinks, controllerLinksFloorplan, controllerLinksGeometry } from './controller-links'
test('assigned stations draw control connections and follow valve movement', () => {
 const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [5, 0, 3] })
 const controller = IrrigationControllerNode.parse({ parentId: valve.parentId, stations: Array.from({ length: 8 }, (_, i) => ({ valveId: i === 0 ? valve.id : undefined, enabled: true, runMinutes: 10 })) })
 const links = controllerLinks(controller, () => valve)
 expect(links).toHaveLength(1); expect(links[0]!.station).toBe(1); expect(links[0]!.active).toBe(true)
 expect(links[0]!.path.at(-1)).toEqual([5, .12, 3])
 expect(controllerLinks(controller, () => ({ ...valve, position: [8, 0, 9] }))[0]!.path.at(-1)).toEqual([8, .12, 9])
 expect(controllerLinksFloorplan(controller, () => valve).some(p => p.kind === 'text' && p.text === 'S1 control')).toBe(true)
 const geometry = controllerLinksGeometry(controller, () => valve)
 expect(geometry.children).toHaveLength(1); expect(geometry.children[0]!.name).toBe('Station 1 control connection')
})
test('missing or other-level valves are omitted and disabled stations remain visible as inactive', () => {
 const valve = IrrigationValveNode.parse({ parentId: 'level_test' })
 const controller = IrrigationControllerNode.parse({ parentId: valve.parentId, enabled: false, stations: Array.from({ length: 8 }, (_, i) => ({ valveId: i === 0 ? valve.id : undefined })) })
 expect(controllerLinks(controller, () => undefined)).toEqual([])
 expect(controllerLinks(controller, () => ({ ...valve, parentId: 'level_other' }))).toEqual([])
 expect(controllerLinks(controller, () => valve)[0]!.active).toBe(false)
})
