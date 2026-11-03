import { landscapeToolColors } from '../../shared/tool-colors'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import {
  pergolaDimensions,
  pergolaLayout,
  pergolaRoofLayout,
} from '../domain/layout'
import type { PergolaNode } from '../domain/schema'

export function buildPergolaFloorplan(
  node: PergolaNode,
  ctx: GeometryContext,
): FloorplanGeometry {
  const [width, , depth] = pergolaDimensions(node)
  const angle = node.rotation[1]
  const point = (x: number, z: number): [number, number] => [
    node.position[0] + x * Math.cos(angle) + z * Math.sin(angle),
    node.position[2] - x * Math.sin(angle) + z * Math.cos(angle),
  ]
  const rectangle = (x: number, z: number, w: number, d: number) => [
    point(x - w / 2, z - d / 2),
    point(x + w / 2, z - d / 2),
    point(x + w / 2, z + d / 2),
    point(x - w / 2, z + d / 2),
  ]
  const selected = ctx.viewState?.selected || ctx.viewState?.highlighted
  const stroke = selected
    ? (ctx.viewState?.palette?.selectedStroke ?? landscapeToolColors.selected)
    : '#765536'
  const children: FloorplanGeometry[] = [
    {
      kind: 'polygon',
      points: rectangle(0, 0, width, depth),
      fill: 'transparent',
      stroke,
      strokeWidth: 0.025,
      strokeDasharray: '0.12 0.08',
    },
  ]
  // Roof beams are overhead in plan; solid post symbols retain a readable footprint.
  const showGrid = pergolaRoofLayout(node) === 'grid'
  for (const member of pergolaLayout(node).filter((m) =>
    ['beams', 'rafters', 'posts', 'screens'].includes(m.role) || (showGrid && m.role === 'slats'),
  )) {
    children.push({
      kind: 'polygon',
      points: rectangle(
        member.position[0],
        member.position[2],
        member.rotation?.[2]
          ? member.size[0] * Math.cos(member.rotation[2]) +
            member.size[1] * Math.abs(Math.sin(member.rotation[2]))
          : member.size[0],
        member.rotation?.[0]
          ? member.size[2] * Math.abs(Math.cos(member.rotation[0])) +
            member.size[1] * Math.abs(Math.sin(member.rotation[0]))
          : member.size[2],
      ),
      fill: member.role === 'posts' ? node.postColor : member.role === 'screens' ? node.beamColor : member.role === 'slats' ? node.roofColor : '#d4b99a',
      stroke,
      strokeWidth: 0.012,
      opacity: member.role === 'posts' || member.role === 'screens' ? 1 : member.role === 'slats' ? 0.5 : 0.65,
      pointerEvents: 'none',
    })
  }
  if (ctx.viewState?.selected)
    children.push({ kind: 'move-handle', point: point(0, 0) })
  return { kind: 'group', children }
}
