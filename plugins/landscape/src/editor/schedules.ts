import type { AnyNode, GeometryContext } from '@pascal-app/core'
import type { FloorplanSchedule } from '@pascal-app/editor'
import { PLANT_PRESET_BY_KEY } from '../plant/domain/catalog'
import { TREE_SPECIES_BY_KEY } from '../tree/domain/species'
import { landscapeQuantity, mulchOrder, orderingArea } from './quantities'
import { plantingCode } from './planting-codes'

type ScheduleNode = { id: string; type: string; species?: string; preset?: string; name?: string }
type ScheduleInput = { siblings: readonly ScheduleNode[]; unit: 'metric' | 'imperial'; nodes?: Readonly<Record<string, AnyNode>>; levelId?: string }

export function plantingSchedule({ siblings }: ScheduleInput): FloorplanSchedule | null {
  if (!siblings.length) return null
  const groups = new Map<string, { code: string; name: string; botanical: string; count: number }>()
  for (const node of siblings) {
    const key = node.species ?? node.preset ?? node.id
    const species = TREE_SPECIES_BY_KEY[node.species ?? '']
    const preset = PLANT_PRESET_BY_KEY[node.preset ?? '']
    const row = groups.get(key) ?? { code: plantingCode(node), name: species?.name ?? preset?.name ?? node.name ?? 'Plant', botanical: species?.latin ?? '', count: 0 }
    row.count++
    groups.set(key, row)
  }
  return { id: `${siblings[0]!.type}:schedule`, title: siblings[0]!.type === 'landscape:tree' ? 'Tree schedule' : 'Plant schedule',
    columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Plant', weight: 2 }, { key: 'botanical', label: 'Botanical name', weight: 2 }, { key: 'count', label: 'Quantity' }],
    rows: [...groups].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, row]) => ({ id, cells: { code: row.code, name: row.name, botanical: row.botanical || '—', count: String(row.count) } })) }
}

export function hardscapeSchedule({ siblings, unit, nodes, levelId }: ScheduleInput): FloorplanSchedule | null {
  if (!siblings.length) return null
  const imperial = unit === 'imperial'
  const savedWaste = levelId && nodes?.[levelId]?.metadata?.landscapeWastePercent
  const waste = typeof savedWaste === 'number' && Number.isFinite(savedWaste) && savedWaste >= 0 && savedWaste <= 100 ? savedWaste : 0
  const area = (value: number | null | undefined) => value == null ? '—' : (value * (imperial ? 10.76391041671 : 1)).toFixed(2)
  return { id: `${siblings[0]!.type}:quantities`, title: `${siblings[0]!.type.replace('landscape:', '').replaceAll('-', ' ')} quantities`,
    columns: [{ key: 'name', label: 'Item', weight: 2 }, { key: 'material', label: 'Material' },
      { key: 'area', label: `Gross area (${imperial ? 'ft²' : 'm²'})` },
      { key: 'net', label: `Net area (${imperial ? 'ft²' : 'm²'})` },
      { key: 'ordering', label: `Order +${waste}% (${imperial ? 'ft²' : 'm²'})` },
      { key: 'length', label: `Length (${imperial ? 'ft' : 'm'})` },
      ...(siblings.some(node => (node as unknown as { surface?: string }).surface === 'mulch') ? [{ key: 'volume', label: 'Order mulch (m³)' }, { key: 'bags', label: 'Bags' }] : [])],
    rows: siblings.map((node) => {
      const raw = node as unknown as AnyNode
      const context: GeometryContext | undefined = nodes ? {
        sceneNodes: nodes, parent: raw.parentId ? nodes[raw.parentId] ?? null : null,
        children: [], siblings: [], resolve: ((id) => nodes[id]) as GeometryContext['resolve'],
      } : undefined
      const row = landscapeQuantity(raw, context)
      return { id: row.id, cells: { name: row.label, material: row.material || '—',
        volume: mulchOrder(row, waste)?.volume.toFixed(3) ?? '—', bags: mulchOrder(row, waste) ? `${mulchOrder(row, waste)!.bags} × ${row.bagLitres} L` : '—',
        area: area(row.area), net: area(row.netArea), ordering: area(orderingArea(row, waste)),
        length: row.length === null ? '—' : (row.length * (imperial ? 3.280839895 : 1)).toFixed(2) } }
    }), issues: ['Net plan areas use the same supported pool openings, grass footprints and stone gaps as Review. Other overlaps require review. Ordering uses the saved level allowance; path lengths follow centerlines.'] }
}

/** Irrigation equipment appears in the same project PDF as its plan geometry. */
export function irrigationPlanSchedule({ siblings, unit }: ScheduleInput): FloorplanSchedule | null {
  if (!siblings.length) return null
  return { id: `${siblings[0]!.type}:equipment`, title: `${siblings[0]!.type.replace('landscape:', '').replaceAll('-', ' ')} schedule`,
    columns: [{key:'name',label:'Item',weight:2},{key:'zone',label:'Zone'}, {key:'count',label:'Qty'}, {key:'length',label:`Length (${unit === 'imperial' ? 'ft' : 'm'})`}, {key:'flow',label:'Flow (L/min)'}],
    rows: siblings.map(node => {
      const equipment = node as unknown as {zone?:string; flow?:number; emitterSpacing?:number; emitterFlow?:number}
      const row = landscapeQuantity(node as unknown as AnyNode)
      const flow = equipment.flow ?? (row.length != null && equipment.emitterSpacing && equipment.emitterFlow ? (Math.floor(row.length / equipment.emitterSpacing + 1e-9)+1)*equipment.emitterFlow/60 : undefined)
      return {id:node.id,cells:{name:row.label,zone:equipment.zone || '—',count:String(row.count),length:row.length == null ? '—' : (row.length*(unit === 'imperial' ? 3.280839895 : 1)).toFixed(2),flow:flow?.toFixed(2) ?? '—'}}
    }) }
}
