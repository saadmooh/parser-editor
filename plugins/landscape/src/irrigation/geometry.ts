import { landscapeToolColors } from '../shared/tool-colors'
import { createSprinklerModel } from './sprinkler-model'
import { zoneColor } from './zone-model'
import type { FloorplanGeometry } from '@pascal-app/core'
import { BufferGeometry, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import type { IrrigationHeadNode } from './schema'

/** Authored reach, not a hydraulic or obstruction-adjusted simulation. */
export function coverageOutline(node: IrrigationHeadNode): [number, number][] {
  const [x, , z] = node.position
  const angle = node.arc * Math.PI / 180
  const rotation = node.rotation[1]
  const steps = Math.max(2, Math.ceil(node.arc / 5))
  const points: [number, number][] = node.arc < 360 ? [[x, z]] : []
  for (let i = 0; i <= steps; i++) {
    const a = rotation + angle * i / steps
    points.push([x + Math.sin(a) * node.radius, z + Math.cos(a) * node.radius])
  }
  return points
}

export function irrigationHeadFloorplan(node: IrrigationHeadNode, ctx?: { viewState?: { selected?: boolean } }): FloorplanGeometry {
  const [x, , z] = node.position
  const children: FloorplanGeometry[] = []
  if (node.showCoverage) children.push({ kind: 'polygon', points: coverageOutline(node),
    fill: landscapeToolColors.coverage, fillOpacity: 0.1, stroke: landscapeToolColors.coverage, strokeWidth: 0.025,
    strokeDasharray: '0.12 0.08', pointerEvents: 'none' })
  children.push({ kind: 'circle', cx: x, cy: z, r: 0.12, fill: '#26354a', stroke: zoneColor(node.zoneId || node.zone), strokeWidth: 0.025 })
  children.push({ kind: 'text', x, y: z + 0.3, text: node.zone || 'Unassigned', fontSize: 0.16,
    textAnchor: 'middle', upright: true, fill: '#25354a', stroke: '#ffffff', strokeWidth: 0.04, paintOrder: 'stroke' })
  if (ctx?.viewState?.selected) {
    for (const [kind, angle, radius] of [['radius', node.rotation[1] + Math.PI / 2, node.radius], ['arc', node.rotation[1] + node.arc * Math.PI / 180, node.radius], ['direction', node.rotation[1], node.radius + .5]] as const)
      children.push({ kind: 'endpoint-handle', screenSized: true, point: [x + Math.sin(angle) * radius, z + Math.cos(angle) * radius], state: 'idle', affordance: 'irrigation-handle', payload: { kind } })
  }
  return { kind: 'group', children }
}

export function irrigationHeadGeometry(node: IrrigationHeadNode) {
  const group = new Group()
  group.add(createSprinklerModel(zoneColor(node.zoneId || node.zone), node.arc))
  if (node.showCoverage) {
    // The host supplies the node transform and floor support. Keep the reach
    // local so position and yaw are applied exactly once in either view.
    const outline = coverageOutline({ ...node, position: [0, 0, 0], rotation: [0, 0, 0] })
    const shape = new Shape(outline.map(([x, z]) => new Vector2(x, z)))
    const reach = new Mesh(new ShapeGeometry(shape).rotateX(Math.PI / 2),
      new MeshBasicMaterial({ color: landscapeToolColors.coverage, transparent: true, opacity: 0.1, side: DoubleSide, depthWrite: false }))
    reach.name = 'Authored irrigation reach'
    reach.position.y = 0.012
    reach.raycast = () => {}
    const rim = new Line(new BufferGeometry().setFromPoints([...outline, outline[0]!].map(([x, z]) => new Vector3(x, 0.015, z))),
      new LineBasicMaterial({ color: landscapeToolColors.coverage, transparent: true, opacity: 0.65, depthWrite: false }))
    rim.name = 'Authored irrigation reach outline'
    rim.raycast = () => {}
    group.add(reach, rim)
  }
  return group
}
