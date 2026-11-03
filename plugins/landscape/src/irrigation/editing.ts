import { type AnyNode, type AnyNodeId, type FloorplanAffordance, type FloorplanMoveTarget, type FloorplanMoveTargetSession, createSceneApi, useScene, useLiveNodeOverrides } from '@pascal-app/core'
import { isGridSnapActive, useEditor } from '@pascal-app/editor'
import { planDriplineDrop, planFeedEquipmentDrop } from './dripline-connection'
import { applyIrrigationPlan, movedEquipmentPlan } from './network'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { IrrigationHeadNode } from './schema'
import { DriplineNode } from './dripline'
import { irrigationMovementIds, irrigationMoveOrigin, planIrrigationTranslation, planSocketMove } from './movement'
import { resolveIrrigationPort, type Point } from './ports'
export type HandlePayload = { kind: 'point' | 'insert'; index: number; axis?: 'x' | 'y' | 'z' } | { kind: 'radius' | 'arc' | 'direction' } | { kind: 'move'; axis?: 'x' | 'z' }
export type EditBatch = { id: AnyNodeId; data: Partial<AnyNode> }[]
export function planHandleEdit(raw: unknown, payload: HandlePayload, point: Point, detach: boolean, nodes: Readonly<Record<string, unknown>>): EditBatch {
  if (payload.kind === 'move') return planIrrigationTranslation(raw, point, detach, nodes)
  const head = IrrigationHeadNode.safeParse(raw)
  if (head.success && payload.kind !== 'point' && payload.kind !== 'insert') {
    const n = head.data, angle = Math.atan2(point[0] - n.position[0], point[2] - n.position[2])
    const patch = payload.kind === 'radius' ? { radius: Math.min(30, Math.max(.1, Math.hypot(point[0] - n.position[0], point[2] - n.position[2]))) }
      : payload.kind === 'direction' ? { rotation: [0, angle, 0] as Point }
      : { arc: Math.min(360, Math.max(1, ((angle - n.rotation[1] + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI || 360)) }
    return [{ id: n.id as AnyNodeId, data: patch as Partial<AnyNode> }]
  }
  const parsed = IrrigationRunNode.safeParse(raw), drip = DriplineNode.safeParse(raw)
  if ((!parsed.success && !drip.success) || payload.kind !== 'point' && payload.kind !== 'insert') return []
  const node = parsed.success ? parsed.data : drip.data!
  if (!node.path[payload.index]) return []
  const path = node.path.map(p => [...p] as Point)
  if (payload.kind === 'insert') path.splice(payload.index + 1, 0, [point[0], path[payload.index]![1], point[2]])
  else path[payload.index] = [point[0], payload.axis === 'y' ? point[1] : path[payload.index]![1], point[2]]
  const patch: Record<string, unknown> = { path }
  if (parsed.success) {
    const isStart = payload.kind === 'point' && payload.index === 0, isEnd = payload.kind === 'point' && payload.index === path.length - 1
    const key = isStart ? 'startConnection' : 'endConnection'
    if ((isStart || isEnd) && parsed.data[key] && !detach) {
      const socket = resolveIrrigationPort(parsed.data[key]!, nodes)
      if (socket) return planSocketMove(parsed.data[key]!, path[payload.index]!.map((v, i) => v - socket.position[i]!) as Point, nodes)
    }
    if (detach && (isStart || isEnd)) patch[key] = undefined
    for (const end of ['start', 'end'] as const) {
      const connection = (patch as Partial<IrrigationRunNode>)[`${end}Connection`] ?? parsed.data[`${end}Connection`]
      if (!connection || detach && (end === 'start' ? isStart : isEnd)) continue
      const port = resolveIrrigationPort(connection, nodes)
      if (!port) continue
      const index = end === 'start' ? 0 : path.length - 1, adjacent = path[end === 'start' ? 1 : path.length - 2]!
      const delta = adjacent.map((v, i) => v - path[index]![i]!), length = Math.hypot(...delta)
      if (length < 1e-6 || delta.reduce((n, v, i) => n + v / length * port.direction[i]!, 0) < .999) {
        const lead = port.position.map((v, i) => v + port.direction[i]! * .2) as Point
        path.splice(end === 'start' ? 1 : path.length - 1, 0, lead)
      }
    }
  }
  const schema = parsed.success ? IrrigationRunNode : DriplineNode
  if (!schema.safeParse({ ...node, ...patch }).success) return []
  const batch: EditBatch = [{ id: node.id as AnyNodeId, data: patch as Partial<AnyNode> }]
  if (drip.success && detach && payload.kind === 'point' && payload.index === 0) batch.push(...planIrrigationTranslation(node, [point[0] - node.path[0]![0], 0, point[2] - node.path[0]![2]], true, nodes).filter(u => String(u.id) !== String(node.id)))
  else if (drip.success) batch.push(...movedEquipmentPlan(node, { ...node, ...patch }, nodes))
  if (parsed.success && detach && payload.kind === 'point') {
    const connection = payload.index === 0 ? parsed.data.startConnection : payload.index === node.path.length - 1 ? parsed.data.endConnection : undefined
    const neighbor = connection ? IrrigationRunNode.safeParse(nodes[connection.nodeId]) : null
    if (neighbor?.success) {
      const key = connection!.portId === 'start' ? 'startConnection' : 'endConnection'
      if (neighbor.data[key]?.nodeId === node.id) batch.push({ id: neighbor.data.id as AnyNodeId, data: { [key]: undefined } as Partial<AnyNode> })
    }
  }
  return batch
}
export function irrigationEditIds(node: unknown, nodes: Readonly<Record<string, unknown>>): AnyNodeId[] {
  const raw = node as { id: string }
  const run = IrrigationRunNode.safeParse(node)
  return [...new Set([...irrigationMovementIds(node, nodes), raw.id, ...movedEquipmentPlan(raw as never, node, nodes).map(u => u.id), ...(run.success ? [run.data.startConnection?.nodeId, run.data.endConnection?.nodeId].filter(id => id && IrrigationRunNode.safeParse(nodes[id]).success) : [])])] as AnyNodeId[]
}
function publish(batch: EditBatch) {
  useLiveNodeOverrides.getState().setMany(batch.map(u => [u.id, u.data as Record<string, unknown>] as const))
  for (const u of batch) useScene.getState().markDirty(u.id)
}
export function clearEditPreview(ids: readonly AnyNodeId[]) {
  for (const id of ids) { useLiveNodeOverrides.getState().clear(id); if (useScene.getState().nodes[id]) useScene.getState().markDirty(id) }
}
export function createIrrigationHandleAffordance(): FloorplanAffordance<unknown> { return {
  start({ node, payload, nodes, initialPlanPoint }) {
    const ids = irrigationEditIds(node, nodes)
    let batch: EditBatch = [], detach = false
    return { affectedIds: ids,
      apply({ planPoint, modifiers }) {
        detach = modifiers.altKey
        const step = !modifiers.altKey && isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
        const x = step ? Math.round(planPoint[0] / step) * step : planPoint[0], z = step ? Math.round(planPoint[1] / step) * step : planPoint[1]
        const handle = payload as HandlePayload
        const snapDelta = (v: number) => step ? Math.round(v / step) * step : v
        const point: Point = handle.kind === 'move' ? [handle.axis === 'z' ? 0 : snapDelta(planPoint[0] - initialPlanPoint[0]), 0, handle.axis === 'x' ? 0 : snapDelta(planPoint[1] - initialPlanPoint[1])] : [x, 0, z]
        batch = planHandleEdit(node, handle, point, modifiers.altKey, nodes); clearEditPreview(ids); publish(batch)
      },
      canCommit: () => batch.length > 0 && !useScene.getState().readOnly,
      commit() {
        if (!useScene.getState().readOnly && batch.length) commitIrrigationEdit(node, batch, detach)
        clearEditPreview(ids)
      },
    }
  },
}
}
export function irrigationEquipmentMove({ node: raw, nodes }: Parameters<FloorplanMoveTarget<unknown>>[0]): FloorplanMoveTargetSession {
  const node = raw as { id: AnyNodeId; parentId: string | null; position?: Point; path?: Point[] }
  const origin = irrigationMoveOrigin(node), ids = irrigationMovementIds(node, nodes)
  let batch: EditBatch = [], detach = false
  return { affectedIds: ids,
    apply({ planPoint, modifiers }) {
      detach = modifiers.altKey
      const step = !modifiers.altKey && isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const x = step ? Math.round(planPoint[0] / step) * step : planPoint[0], z = step ? Math.round(planPoint[1] / step) * step : planPoint[1]
      batch = planIrrigationTranslation(node, [x - origin[0], 0, z - origin[2]], detach, nodes); clearEditPreview(ids); publish(batch)
    },
    canCommit: () => batch.length > 0 && !useScene.getState().readOnly,
    commit() { if (!useScene.getState().readOnly && batch.length) commitIrrigationEdit(node, batch, detach); clearEditPreview(ids) },
  }
}
export function detachedRunPatch(node: IrrigationRunNode, end: 'start' | 'end') {
  return { [end === 'start' ? 'startConnection' : 'endConnection']: undefined }
}
export function pathEditProblems(raw: unknown, patch: Partial<AnyNode>, nodes: Readonly<Record<string, unknown>>) {
  const parsed = IrrigationRunNode.safeParse({ ...(raw as object), ...patch })
  return parsed.success ? irrigationRunIssues(parsed.data, nodes) : []
}

/** Keep movement and any generated feed fittings in one scene transaction. */
export function commitIrrigationEdit(node: unknown, batch: EditBatch, detach = false) {
  const state = useScene.getState()
  if (state.readOnly || !batch.length) return
  const drip = DriplineNode.safeParse(node)
  const parentId = (node as { parentId?: string }).parentId
  if (detach || !parentId) { state.updateNodes(batch); return }
  let plan
  try { plan = drip.success ? planDriplineDrop(node, batch, state.nodes) : planFeedEquipmentDrop(node, batch, state.nodes) }
  catch { state.updateNodes(batch); return } // A cramped route still permits editing the line.
  applyIrrigationPlan(createSceneApi(useScene), plan, parentId as AnyNodeId)
}
