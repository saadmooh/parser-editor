import type { AnyNode, GeometryContext } from '@pascal-app/core'
import { PondNode } from '../pond/schema'
import { pondCapacity } from '../pond/terrain'
import { poolCutoutsFor, subtractPoolCutouts, type PoolCutoutSurface } from '../shared/pool-cutouts'
import { surfaceOutline, type DrawnSurface } from '../ground-access/shared/outline'
import { isNaturalStoneFinish, PathwayNode } from '../pathways/domain/schema'
import { distance, edgeCurve, sample } from '../pathways/domain/curves'
import { buildOutline } from '../pathways/rendering/outline'
import { pathwayStoneFootprints } from '../pathways/rendering/stone-footprints'
import { PLANT_PRESET_BY_KEY } from '../plant/domain/catalog'
import { TREE_SPECIES_BY_KEY } from '../tree/domain/species'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { EdgingNode } from '../ground-access/edging/domain/schema'
import { edgingRenderPoints } from '../ground-access/edging/domain/sampling'
import { visibleGrassFootprint } from '../ground-areas/rendering/footprint'

export type QuantityRow = { costKey?: string; volume?: number | null; bagLitres?: number; id: string; label: string; material: string; count: number; area: number | null; length: number | null; slopePercent?: number | null; netArea?: number | null }

export function polygonArea(points: ReadonlyArray<readonly [number, number]>): number {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0)) / 2
}

export function landscapeQuantity(raw: AnyNode, context?: GeometryContext): QuantityRow {
  const node = raw as unknown as { id: string; type: string; name?: string; species?: string; preset?: string;
    slopePercent?: number; surface?: string; material?: string; finish?: string; shape?: string; width?: number; depth?: number; outline?: [number, number][] }
  const label = node.name || (node.type === 'landscape:plant' ? PLANT_PRESET_BY_KEY[node.preset ?? '']?.name
    : node.type === 'landscape:tree' ? TREE_SPECIES_BY_KEY[node.species ?? '']?.name : undefined)
    || node.type.replace('landscape:', '').replaceAll('-', ' ')
  const row: QuantityRow = { id: node.id, label, material: node.material ?? node.finish ?? node.surface ?? '', count: 1, area: null, length: null }
  row.costKey = [node.type, node.preset ?? node.species ?? row.material].join(':')
  if (node.type === 'landscape:patio' && typeof node.slopePercent === 'number' && Number.isFinite(node.slopePercent)) row.slopePercent = node.slopePercent
  if (node.type === 'landscape:pathway') {
    const parsed = PathwayNode.safeParse(raw)
    if (!parsed.success) return row
    const path = parsed.data
    row.length = path.edges.reduce((total, edge) => {
      const points = sample(edgeCurve(path, edge)).map((entry) => entry.point)
      return total + points.slice(1).reduce((sum, point, index) => sum + distance(points[index]!, point), 0)
    }, 0)
    const outline = buildOutline(path)
    row.area = outline.reduce((sum, polygon) => sum + polygonArea(polygon[0]!)
      - polygon.slice(1).reduce((holes, ring) => holes + polygonArea(ring), 0), 0)
    if (context) {
      row.netArea = path.finish === 'laidStone' || isNaturalStoneFinish(path.finish)
        ? pathwayStoneFootprints(path, context).reduce((sum, tile) => sum + polygonArea(tile.ring)
          - (tile.holes ?? []).reduce((holes, ring) => holes + polygonArea(ring), 0), 0)
        : subtractPoolCutouts(outline, path as unknown as PoolCutoutSurface, context)
          .reduce((sum, polygon) => sum + polygonArea(polygon[0]!)
            - polygon.slice(1).reduce((holes, ring) => holes + polygonArea(ring), 0), 0)
    }
  } else if (node.type === 'landscape:ground-area') {
    row.area = polygonArea(node.outline ?? [])
  } else if (node.type === 'landscape:pond') {
    const parsed = PondNode.safeParse(raw)
    if (parsed.success) { row.area = pondCapacity(parsed.data).area; row.netArea = row.area }
  } else if (['landscape:patio', 'landscape:deck', 'landscape:landing', 'landscape:concrete-slab'].includes(node.type)
    && node.width !== undefined && node.depth !== undefined) {
    row.area = node.shape === 'circle' ? Math.PI * (node.width / 2) ** 2
      : node.shape === 'oval' ? Math.PI * node.width * node.depth / 4
      : node.shape !== 'rectangle' && (node.outline?.length ?? 0) >= 3
        ? polygonArea(node.outline!) * node.width * node.depth : node.width * node.depth
  }
  if (context && row.area !== null && ['landscape:patio', 'landscape:deck', 'landscape:landing', 'landscape:concrete-slab'].includes(node.type)) {
    const surface = raw as unknown as DrawnSurface & PoolCutoutSurface
    const cutouts = poolCutoutsFor(surface, context)
    row.netArea = cutouts.length ? subtractPoolCutouts([[surfaceOutline(surface)]], surface, context).reduce((sum, polygon) =>
      sum + polygonArea(polygon[0]!) - polygon.slice(1).reduce((holes, ring) => holes + polygonArea(ring), 0), 0) : row.area
  }
  if (context && node.type === 'landscape:ground-area') {
    const parsed = GroundAreaNode.safeParse(raw)
    if (parsed.success) {
      const area = parsed.data
      const footprint = area.surface === 'grass' || area.surface === 'grass2' ? visibleGrassFootprint(area, context) : [[area.outline]]
      row.netArea = subtractPoolCutouts(footprint, area, context).reduce((sum, polygon) =>
        sum + polygonArea(polygon[0]!) - polygon.slice(1).reduce((holes, ring) => holes + polygonArea(ring), 0), 0)
    }
  }
  if (node.type === 'landscape:ground-area' && node.surface === 'mulch') {
    const parsed = GroundAreaNode.safeParse(raw)
    if (parsed.success) { row.volume = row.netArea == null ? null : row.netArea * parsed.data.mulchDepth; row.bagLitres = parsed.data.mulchBagLitres; row.costKey += `:${row.bagLitres}L` }
  }
  if (node.type === 'landscape:edging') {
    const parsed = EdgingNode.safeParse(raw)
    if (parsed.success) {
      const points = edgingRenderPoints(parsed.data)
      const route = parsed.data.closed && points.length > 2 ? [...points, points[0]!] : points
      row.length = route.slice(1).reduce((sum, point, index) => sum + distance(route[index]!, point), 0)
    }
  } else if (node.type === 'landscape:retaining-wall') row.length = node.width ?? null
  if (['landscape:irrigation-run', 'landscape:dripline'].includes(node.type)) {
    const run = raw as unknown as { path: number[][]; diameter: number }
    row.length = run.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(...point.map((value, axis) => value - run.path[index]![axis]!)), 0)
    row.costKey += `:${run.diameter}`
    row.label = `${row.label} (${run.diameter} in)`
  }
  return row
}

export function orderingArea(row: QuantityRow, wastePercent: number): number | null {
  if (row.netArea === undefined || row.netArea === null || !Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) return null
  return row.netArea * (1 + wastePercent / 100)
}

// A leading apostrophe stops spreadsheet apps interpreting user names as formulas.
export function csvCell(value: string | number) {
  const text = String(value)
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`
}

export function quantitiesCsv(rows: QuantityRow[], wastePercent = 0): string {
  return [['ID', 'Item', 'Material', 'Count', 'Gross plan area (m²)', 'Centerline length (m)', 'Authored patio slope (%)', 'Net modeled surface area (m²)', 'Waste allowance (%)', 'Ordering area (m²)', 'Mulch volume (m³)', 'Ordering volume (m³)', 'Bag size (L)', 'Bags'],
    ...rows.map((row) => [row.id, row.label, row.material, row.count, row.area?.toFixed(2) ?? '', row.length?.toFixed(2) ?? '', row.slopePercent?.toFixed(2) ?? '', row.netArea?.toFixed(2) ?? '', row.netArea != null ? wastePercent : '', orderingArea(row, wastePercent)?.toFixed(2) ?? '', row.volume?.toFixed(3) ?? '', mulchOrder(row, wastePercent)?.volume.toFixed(3) ?? '', row.bagLitres ?? '', mulchOrder(row, wastePercent)?.bags ?? ''])]
    .map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function materialTakeoff(rows: QuantityRow[], wastePercent: number) {
  const groups = new Map<string, { material: string; count: number; grossArea: number; netArea: number | null }>()
  for (const row of rows) {
    const material = row.material.trim()
    if (!material || row.area === null) continue
    const group = groups.get(material) ?? { material, count: 0, grossArea: 0, netArea: 0 }
    group.count += row.count
    group.grossArea += row.area
    group.netArea = group.netArea === null || row.netArea == null ? null : group.netArea + row.netArea
    groups.set(material, group)
  }
  return [...groups.values()].sort((a, b) => a.material.localeCompare(b.material)).map(group => ({ ...group,
    orderingArea: orderingArea({ id: '', label: '', material: group.material, count: group.count,
      area: group.grossArea, length: null, netArea: group.netArea }, wastePercent),
  }))
}

export function materialTakeoffCsv(rows: QuantityRow[], wastePercent = 0): string {
  return [['Material', 'Objects', 'Gross plan area (m²)', 'Net modeled surface area (m²)', 'Waste allowance (%)', 'Ordering area (m²)', 'Ordering mulch (m³)', 'Mulch bags'],
    ...materialTakeoff(rows, wastePercent).map(group => [group.material, group.count, group.grossArea.toFixed(2),
      group.netArea?.toFixed(2) ?? '', group.orderingArea === null ? '' : wastePercent, group.orderingArea?.toFixed(2) ?? '', groupedMulch(rows, group.material, wastePercent)?.volume?.toFixed(3) ?? '', groupedMulch(rows, group.material, wastePercent)?.bags ?? ''])]
    .map(row => row.map(csvCell).join(',')).join('\r\n')
}

export function quantityExport(rows: QuantityRow[], wastePercent: number, material = false) {
  return {
    filename: material ? 'landscape-material-takeoff.csv' : 'landscape-quantities.csv',
    content: '\uFEFF' + (material ? materialTakeoffCsv(rows, wastePercent) : quantitiesCsv(rows, wastePercent)),
  }
}

export function mulchOrder(row: QuantityRow, wastePercent: number): { volume: number; bags: number } | null {
  if (row.volume == null || !Number.isFinite(row.volume) || row.volume < 0 || !row.bagLitres || !Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) return null
  const volume = row.volume * (1 + wastePercent / 100)
  return { volume, bags: Math.ceil((volume * 1000 - 1e-8) / row.bagLitres) }
}

function groupedMulch(rows: QuantityRow[], material: string, waste: number) {
  const mulch = rows.filter(row => row.material.trim() === material && row.bagLitres !== undefined)
  if (!mulch.length) return null
  const orders = mulch.map(row => ({ row, order: mulchOrder(row, waste) }))
  if (orders.some(entry => !entry.order)) return { volume: null, bags: 'Unavailable' }
  const bags = new Map<number, number>()
  for (const { row, order } of orders) bags.set(row.bagLitres!, (bags.get(row.bagLitres!) ?? 0) + order!.bags)
  return { volume: orders.reduce((sum, entry) => sum + entry.order!.volume, 0), bags: [...bags].map(([litres, count]) => `${count} × ${litres} L`).join('; ') }
}
