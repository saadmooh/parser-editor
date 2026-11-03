import { BufferGeometry, Group, Line, LineDashedMaterial, Vector3 } from 'three'
import type { IrrigationControllerNode } from './controller'
import { IrrigationValveNode } from './valve'
import type { FloorplanGeometry } from '@pascal-app/core'
import type { Point } from './ports'

export function controllerLinks(node: IrrigationControllerNode, resolve: (id: string) => unknown) {
  return node.stations.flatMap((station, index) => {
    if (!station.valveId) return []
    const valve = IrrigationValveNode.safeParse(resolve(station.valveId))
    if (!valve.success || valve.data.parentId !== node.parentId) return []
    const start: Point = [node.position[0], node.position[1] + .58, node.position[2]]
    const end: Point = [valve.data.position[0], valve.data.position[1] + .12, valve.data.position[2]]
    const y = Math.max(node.position[1], valve.data.position[1]) + .04
    const path: Point[] = [start, [start[0], y, start[2]], [end[0], y, start[2]], [end[0], y, end[2]], end]
    return [{ station: index + 1, valve: valve.data, path, active: node.enabled && node.seasonalPercent > 0 && station.enabled && station.runMinutes > 0 && node.wateringDays.length > 0 }]
  })
}
export function controllerLinksFloorplan(node: IrrigationControllerNode, resolve: (id: string) => unknown): FloorplanGeometry[] {
  return controllerLinks(node, resolve).flatMap(link => {
    const start = link.path[0]!, end = link.path.at(-1)!, color = link.active ? '#a78bfa' : '#777777'
    return [
      { kind: 'polyline', points: [[start[0], start[2]], [end[0], start[2]], [end[0], end[2]]], stroke: color, strokeWidth: .028, strokeDasharray: '.10 .07', pointerEvents: 'none' },
      { kind: 'text', x: (start[0] + end[0]) / 2, y: start[2] - .12, text: `S${link.station} control`, upright: true, textAnchor: 'middle', fontSize: .13, fill: color, stroke: '#ffffff', strokeWidth: .025, paintOrder: 'stroke', pointerEvents: 'none' },
    ] as FloorplanGeometry[]
  })
}
export function controllerLinksGeometry(node: IrrigationControllerNode, resolve: (id: string) => unknown) {
  const group = new Group(); group.name = 'Controller signal connections'
  for (const link of controllerLinks(node, resolve)) {
    const points = link.path.map(p => new Vector3(...p).sub(new Vector3(...node.position)).applyAxisAngle(new Vector3(0, 1, 0), -node.rotation[1]))
    const geometry = new BufferGeometry().setFromPoints(points)
    const material = new LineDashedMaterial({ color: link.active ? '#a78bfa' : '#777777', dashSize: .10, gapSize: .07, transparent: true, opacity: .85 })
    const line = new Line(geometry, material); line.name = `Station ${link.station} control connection`; line.computeLineDistances(); line.raycast = () => {}; group.add(line)
  }
  return group
}
