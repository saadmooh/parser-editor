import { landscapeToolColors } from '../shared/tool-colors'
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import type { PlantNode } from '../plant/domain/schema'
import { PLANT_PRESET_BY_KEY } from '../plant/domain/catalog'
import type { TreeNode } from '../tree/domain/schema'
import { TREE_SPECIES_BY_KEY } from '../tree/domain/species'
import { plantingCode } from './planting-codes'
import { plantPlanRadius, treePlanRadius } from './planting-footprint'

function plantSymbol(position: [number, number, number], radius: number, color: string, ctx: GeometryContext, label?: string): FloorplanGeometry {
  const [x, , z] = position
  const selected = ctx.viewState?.selected || ctx.viewState?.highlighted
  const stroke = selected ? ctx.viewState?.palette?.selectedStroke ?? landscapeToolColors.selected
    : ctx.viewState?.hovered ? ctx.viewState?.palette?.wallHoverStroke ?? landscapeToolColors.selected : color
  const children: FloorplanGeometry[] = [
    { kind: 'circle', cx: x, cy: z, r: radius, fill: color, fillOpacity: 0.12, stroke, strokeWidth: 0.03,
      strokeDasharray: '0.18 0.12', pointerEvents: 'stroke' },
    { kind: 'circle', cx: x, cy: z, r: Math.min(0.15, radius / 3), fill: stroke, stroke, strokeWidth: 0.02 },
  ]
  if (label) children.push({ kind: 'text', x, y: z + radius + 0.22, text: label,
    fontSize: 0.18, textAnchor: 'middle', dominantBaseline: 'middle', upright: true,
    fill: '#253222', stroke: '#ffffff', strokeWidth: 0.06, paintOrder: 'stroke' })
  if (selected) children.push({ kind: 'move-handle', point: [x, z] })
  return { kind: 'group', children }
}

function strokeFootprints(metadata: PlantNode['metadata']): FloorplanGeometry | null {
  // Placement-only metadata is published to the host ghost, never to scene nodes.
  const stroke = metadata?.landscapeStrokePreview
  if (Array.isArray(stroke)) return { kind: 'group', children: stroke.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length !== 4 || !entry.slice(0, 3).every((value) => typeof value === 'number' && Number.isFinite(value)) || entry[2] <= 0) return []
    return [{ kind: 'circle' as const, cx: entry[0], cy: entry[1], r: entry[2],
      fill: entry[3] === 'erase' ? '#e87979' : landscapeToolColors.draft, fillOpacity: 0.15,
      stroke: entry[3] === 'erase' ? '#e87979' : landscapeToolColors.draft, strokeWidth: 0.035, pointerEvents: 'none' as const }]
  }) }
  return null
}

export function buildPlantFloorplan(node: PlantNode, ctx: GeometryContext): FloorplanGeometry {
  const stroke = strokeFootprints(node.metadata)
  if (stroke) return stroke
  const preset = PLANT_PRESET_BY_KEY[node.preset]
  return plantSymbol(node.position, plantPlanRadius(node), node.tint ?? preset?.foliage ?? '#628b50', ctx,
    node.metadata?.landscapePlanLabel === true ? node.metadata.landscapePlanLabelStyle === 'code'
      ? plantingCode(node) : preset?.name ?? node.name ?? 'Plant' : undefined)
}

export function buildTreeFloorplan(node: TreeNode, ctx: GeometryContext): FloorplanGeometry {
  const stroke = strokeFootprints(node.metadata)
  if (stroke) return stroke
  return plantSymbol(node.position, treePlanRadius(node), '#628b50', ctx,
    node.metadata?.landscapePlanLabel === true ? node.metadata.landscapePlanLabelStyle === 'code'
      ? plantingCode(node) : TREE_SPECIES_BY_KEY[node.species]?.name ?? node.name ?? 'Tree' : undefined)
}
