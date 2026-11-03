import type { AnyNode, AnyNodeId, FloorplanGeometry } from '@pascal-app/core'
import { IrrigationRunNode } from './run'
import { movedEquipmentPlan } from './network'
import { resolveIrrigationPort, type Point } from './ports'
import type { EditBatch } from './editing'

export function irrigationMoveOrigin(raw: unknown): Point {
  const node = raw as { position?: Point; path?: Point[] }
  if (node.position) return [...node.position]
  const path = node.path || []
  return path.length ? [path.reduce((n, p) => n + p[0], 0) / path.length, path[0]![1], path.reduce((n, p) => n + p[2], 0) / path.length] : [0, 0, 0]
}
const shifted = (p: Point, delta: Point): Point => p.map((v, i) => v + delta[i]!) as Point
/** Move a connected socket's owner, not just the visible endpoint. */
export function planSocketMove(connection: { nodeId: string; portId: string }, delta: Point, nodes: Readonly<Record<string, unknown>>): EditBatch {
  if (!delta.every(Number.isFinite) || Math.hypot(...delta) < 1e-9) return []
  const target = nodes[connection.nodeId] as { id: string; parentId: string | null; position?: Point; path?: Point[] } | undefined
  if (!target) return []
  const run = IrrigationRunNode.safeParse(target)
  if (!run.success) return planIrrigationTranslation(target, delta, false, nodes)
  const port = resolveIrrigationPort(connection, nodes)
  if (!port) return []
  const path = run.data.path.map(p => [...p] as Point), atStart = connection.portId === 'start'
  const index = atStart ? 0 : path.length - 1
  path[index] = shifted(path[index]!, delta)
  const lead = path[index]!.map((v, i) => v - port.direction[i]! * .2) as Point
  path.splice(atStart ? 1 : path.length - 1, 0, lead)
  const preview = { ...run.data, path }
  return [{ id: target.id as AnyNodeId, data: { path } as Partial<AnyNode> }, ...movedEquipmentPlan(target, preview, { ...nodes, [target.id]: preview })]
}
export function planIrrigationTranslation(raw: unknown, delta: Point, detach: boolean, nodes: Readonly<Record<string, unknown>>): EditBatch {
  const node = raw as { id: string; parentId: string | null; position?: Point; path?: Point[] }
  if (!delta.every(Number.isFinite) || Math.hypot(...delta) < 1e-9) return []
  const patch = node.position ? { position: shifted(node.position, delta) } : node.path ? { path: node.path.map(p => shifted(p, delta)) } : null
  if (!patch) return []
  const updates = new Map<string, Record<string, unknown>>([[node.id, patch]])
  const apply = (batch: EditBatch) => { for (const u of batch) updates.set(u.id, { ...updates.get(u.id), ...u.data }) }
  const run = IrrigationRunNode.safeParse(node)
  if (detach) {
    if (run.success) updates.set(node.id, { ...patch, startConnection: undefined, endConnection: undefined })
    for (const value of Object.values(nodes)) {
      const p = IrrigationRunNode.safeParse(value)
      if (!p.success || p.data.id === node.id) continue
      const data: Record<string, unknown> = {}
      for (const end of ['startConnection', 'endConnection'] as const) if (p.data[end]?.nodeId === node.id) data[end] = undefined
      if (Object.keys(data).length) updates.set(p.data.id, data)
    }
  } else {
    // A translated run carries its two immediate socket owners. Remaining trunks stay fixed.
    if (run.success) for (const ref of [run.data.startConnection, run.data.endConnection]) {
      if (!ref || updates.has(ref.nodeId)) continue
      apply(planSocketMove(ref, delta, nodes))
    }
    let snapshot = { ...nodes }
    for (const [id, data] of updates) snapshot[id] = { ...(snapshot[id] as object), ...data }
    const seeds = [...updates.keys()]
    for (const id of seeds) {
      const old = nodes[id] as { id: string; parentId: string | null }
      if (!old) continue
      const followers = movedEquipmentPlan(old, snapshot[id], snapshot)
      // The selected path already translates both ends and must keep that shape.
      apply(followers.filter(u => u.id !== node.id))
    }
    updates.set(node.id, patch)
  }
  return [...updates].map(([id, data]) => ({ id: id as AnyNodeId, data: data as Partial<AnyNode> }))
}
export function irrigationMovementIds(raw: unknown, nodes: Readonly<Record<string, unknown>>): AnyNodeId[] {
  const node = raw as { id: string }, run = IrrigationRunNode.safeParse(raw)
  const owners = new Set([node.id, ...(run.success ? [run.data.startConnection?.nodeId, run.data.endConnection?.nodeId].filter((id): id is string => !!id) : [])])
  const ids = new Set(owners)
  for (const value of Object.values(nodes)) {
    const p = IrrigationRunNode.safeParse(value)
    if (p.success && [p.data.startConnection, p.data.endConnection].some(ref => ref && owners.has(ref.nodeId))) ids.add(p.data.id)
  }
  return [...ids] as AnyNodeId[]
}
export function irrigationMoveArrows(raw: unknown): FloorplanGeometry[] {
  const p = irrigationMoveOrigin(raw)
  return [
    { kind: 'move-arrow', point: [p[0] + .4, p[2]], angle: 0, affordance: 'irrigation-handle', payload: { kind: 'move', axis: 'x' } },
    { kind: 'move-arrow', point: [p[0], p[2] + .4], angle: Math.PI / 2, affordance: 'irrigation-handle', payload: { kind: 'move', axis: 'z' } },
  ]
}
