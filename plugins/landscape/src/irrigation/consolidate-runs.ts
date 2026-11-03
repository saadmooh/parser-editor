import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { IrrigationFittingNode } from './fitting'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { distance, unit, type Point } from './ports'
import { cleanPath, movedEquipmentPlan, type IrrigationPlan } from './network'

/** Replace degree-two elbow/coupling chains with a continuous editable route. */
export function consolidateIrrigationRuns(original: Readonly<Record<string, unknown>>, parentId: string): IrrigationPlan {
  const nodes = { ...original }, removed = new Set<string>(), changed = new Set<string>()
  const identical = new Map<string, string>()
  for (const raw of Object.values(nodes)) {
    const p = IrrigationRunNode.safeParse(raw)
    if (!p.success || p.data.parentId !== parentId || p.data.routingLocked || !p.data.startConnection || !p.data.endConnection) continue
    const r = p.data
    const forwards = JSON.stringify([cleanPath(r.path), r.startConnection, r.endConnection])
    const backwards = JSON.stringify([cleanPath([...r.path].reverse()), r.endConnection, r.startConnection])
    const key = JSON.stringify([r.diameter, r.zone, r.zoneId, r.routeRole, r.internalDiameterMm, r.roughnessC, r.minorLossK, r.visible, r.metadata, [forwards, backwards].sort()[0]])
    const retained = identical.get(key)
    if (!retained) { identical.set(key, r.id); continue }
    if (Object.values(nodes).some(n => { const other = IrrigationRunNode.safeParse(n); return other.success && [other.data.startConnection, other.data.endConnection].some(c => c?.nodeId === r.id) })) continue
    delete nodes[r.id]; removed.add(r.id)
  }
  // Generated tees with only two used sockets have no branch to render.
  for (const raw of Object.values(nodes)) {
    const parsed = IrrigationFittingNode.safeParse(raw)
    if (!parsed.success || parsed.data.parentId !== parentId || parsed.data.fittingType !== 'tee' || !['Drip header tee', 'Zone tee'].includes(parsed.data.name ?? '')) continue
    const fitting = parsed.data
    const attached = Object.values(nodes).flatMap(value => { const p = IrrigationRunNode.safeParse(value); return p.success ? [p.data] : [] }).filter(r => [r.startConnection, r.endConnection].some(c => c?.nodeId === fitting.id))
    const used = [...new Set(attached.flatMap(r => [r.startConnection, r.endConnection].filter(c => c?.nodeId === fitting.id).map(c => c!.portId)))].sort()
    if (used.length !== 2 || attached.length !== 2 || attached.some(r => r.routingLocked)) continue
    const indices = used.map(id => Number(id.replace('socket-', '')))
    if (indices.some(i => !Number.isInteger(i) || !fitting.directions[i])) continue
    nodes[fitting.id] = { ...fitting, fittingType: 'elbow', directions: indices.map(i => fitting.directions[i]), diameters: indices.map(i => fitting.diameters[i]) }; changed.add(fitting.id)
    for (const r of attached) {
      const n = { ...r }
      for (const end of ['startConnection', 'endConnection'] as const) if (n[end]?.nodeId === fitting.id) n[end] = { nodeId: fitting.id, portId: `socket-${used.indexOf(n[end]!.portId)}` }
      nodes[n.id] = n; changed.add(n.id)
    }
  }
  // Repair stale equipment endpoints only when their authored bindings are unambiguous.
  for (const raw of Object.values(nodes)) {
    const parsed = IrrigationRunNode.safeParse(raw)
    if (!parsed.success || parsed.data.parentId !== parentId || parsed.data.routingLocked) continue
    const run = parsed.data, issues = irrigationRunIssues(run, nodes)
    if (!issues.some(i => i.includes('centerline no longer') || i.includes('approaches against'))) continue
    if (issues.some(i => !i.includes('centerline no longer') && !i.includes('approaches against') && !i.endsWith('no outlet connection.') && !i.endsWith('connected valve is closed.') && !i.endsWith('water supply is disabled.'))) continue
    const ref = run.startConnection ?? run.endConnection
    if (!ref || IrrigationRunNode.safeParse(nodes[ref.nodeId]).success) continue
    const patch = movedEquipmentPlan({ id: ref.nodeId, parentId }, nodes[ref.nodeId], nodes).find(u => String(u.id) === run.id)
    if (!patch) continue
    const candidate = { ...run, ...patch.data }, snapshot = { ...nodes, [run.id]: candidate }
    const remaining = irrigationRunIssues(candidate as IrrigationRunNode, snapshot)
    if (remaining.some(i => !i.endsWith('no outlet connection.') && !i.endsWith('connected valve is closed.') && !i.endsWith('water supply is disabled.'))) continue
    nodes[run.id] = candidate; changed.add(run.id)
  }
  for (;;) {
    let merged = false
    for (const raw of Object.values(nodes)) {
      const parsed = IrrigationFittingNode.safeParse(raw)
      if (!parsed.success) continue
      const fitting = parsed.data
      if (fitting.parentId !== parentId || !['elbow', 'coupling'].includes(fitting.fittingType) || fitting.directions.length !== 2) continue
      const attached = Object.values(nodes).flatMap(n => {
        const p = IrrigationRunNode.safeParse(n)
        if (!p.success) return []
        return (['startConnection', 'endConnection'] as const).flatMap(end => p.data[end]?.nodeId === fitting.id ? [{ run: p.data, end }] : [])
      })
      if (attached.length !== 2 || attached[0]!.run.id === attached[1]!.run.id) continue
      const a = attached[0]!, b = attached[1]!
      if (a.run.routingLocked || b.run.routingLocked || a.run.parentId !== parentId || b.run.parentId !== parentId ||
        a.run.diameter !== b.run.diameter || a.run.zone !== b.run.zone || a.run.zoneId !== b.run.zoneId ||
        a.run.routeRole !== b.run.routeRole || a.run.internalDiameterMm !== b.run.internalDiameterMm || a.run.roughnessC !== b.run.roughnessC) continue
      if (a.run[a.end]!.portId === b.run[b.end]!.portId) continue
      if ([a.run, b.run].some(run => irrigationRunIssues(run, nodes).some(issue => !issue.endsWith('no outlet connection.') && !issue.endsWith('connected valve is closed.') && !issue.endsWith('water supply is disabled.')))) continue
      const first = a.end === 'endConnection' ? a.run.path : [...a.run.path].reverse()
      const second = b.end === 'startConnection' ? b.run.path : [...b.run.path].reverse()
      const startConnection = a.end === 'endConnection' ? a.run.startConnection : a.run.endConnection
      const endConnection = b.end === 'startConnection' ? b.run.endConnection : b.run.startConnection
      const path = cleanPath([...first, fitting.position as Point, ...second])
      const result = IrrigationRunNode.safeParse({ ...a.run, path, startConnection, endConnection, minorLossK: a.run.minorLossK + b.run.minorLossK })
      if (!result.success) continue
      // Rewire every neighbor that references either retained/replaced endpoint.
      const rewired = { ...nodes, [a.run.id]: result.data }
      const oldStart = a.end === 'endConnection' ? 'start' : 'end', oldEnd = b.end === 'startConnection' ? 'end' : 'start'
      for (const value of Object.values(nodes)) {
        const p = IrrigationRunNode.safeParse(value)
        if (!p.success || [a.run.id, b.run.id].includes(p.data.id)) continue
        let touched = false
        const n = { ...p.data }
        for (const end of ['startConnection', 'endConnection'] as const) {
          const ref = n[end]
          if (ref?.nodeId === a.run.id && ref.portId === oldStart) { n[end] = { nodeId: a.run.id, portId: 'start' }; touched = true }
          if (ref?.nodeId === b.run.id && ref.portId === oldEnd) { n[end] = { nodeId: a.run.id, portId: 'end' }; touched = true }
        }
        if (touched) { rewired[n.id] = n; changed.add(n.id) }
      }
      delete rewired[b.run.id]; delete rewired[fitting.id]
      if (irrigationRunIssues(result.data, rewired).some(i => !i.endsWith('no outlet connection.') && !i.endsWith('connected valve is closed.') && !i.endsWith('water supply is disabled.'))) continue
      Object.assign(nodes, rewired); delete nodes[b.run.id]; delete nodes[fitting.id]
      changed.add(a.run.id); removed.add(b.run.id); removed.add(fitting.id); merged = true; break
    }
    if (!merged) break
  }
  // Direct endpoint joins on a straight route also need only one item.
  for (;;) {
    let merged = false
    for (const raw of Object.values(nodes)) {
      const parsed = IrrigationRunNode.safeParse(raw)
      if (!parsed.success || parsed.data.parentId !== parentId || parsed.data.routingLocked) continue
      const a = parsed.data
      for (const end of ['startConnection', 'endConnection'] as const) {
        const ref = a[end], target = ref ? IrrigationRunNode.safeParse(nodes[ref.nodeId]) : null
        if (!target?.success || target.data.id === a.id) continue
        const b = target.data, otherEnd = ref!.portId === 'start' ? 'startConnection' : 'endConnection'
        if (!['start', 'end'].includes(ref!.portId) || b.routingLocked || b.parentId !== parentId || b.diameter !== a.diameter || b.zone !== a.zone || b.zoneId !== a.zoneId || b.routeRole !== a.routeRole || b.internalDiameterMm !== a.internalDiameterMm || b.roughnessC !== a.roughnessC) continue
        if (b[otherEnd]?.nodeId !== a.id || b[otherEnd]?.portId !== (end === 'startConnection' ? 'start' : 'end')) continue
        const first = end === 'endConnection' ? a.path : [...a.path].reverse()
        const second = otherEnd === 'startConnection' ? b.path : [...b.path].reverse()
        if (distance(first.at(-1)!, second[0]!) > .001) continue
        const u = unit(first.at(-1)!, first.at(-2)!), v = unit(second[1]!, second[0]!)
        if (u.reduce((n, x, i) => n + x * v[i]!, 0) < .999999) continue
        const startConnection = end === 'endConnection' ? a.startConnection : a.endConnection
        const endConnection = otherEnd === 'startConnection' ? b.endConnection : b.startConnection
        const result = IrrigationRunNode.safeParse({ ...a, path: cleanPath([...first, ...second]), startConnection, endConnection, minorLossK: a.minorLossK + b.minorLossK })
        if (!result.success) continue
        // Never merge through an occupied/shared or malformed connection.
        if ([a, b].some(r => irrigationRunIssues(r, nodes).some(i => !i.endsWith('no outlet connection.') && !i.endsWith('connected valve is closed.') && !i.endsWith('water supply is disabled.')))) continue
        nodes[a.id] = result.data; delete nodes[b.id]; changed.add(a.id); removed.add(b.id)
        for (const value of Object.values(nodes)) {
          const p = IrrigationRunNode.safeParse(value)
          if (!p.success || p.data.id === a.id) continue
          const n = { ...p.data }; let touched = false
          for (const key of ['startConnection', 'endConnection'] as const) {
            const c = n[key]
            if (c?.nodeId === a.id) { n[key] = { nodeId: a.id, portId: 'start' }; touched = true }
            if (c?.nodeId === b.id) { n[key] = { nodeId: a.id, portId: 'end' }; touched = true }
          }
          if (touched) { nodes[n.id] = n; changed.add(n.id) }
        }
        merged = true; break
      }
      if (merged) break
    }
    if (!merged) break
  }
  return { create: [], update: [...changed].filter(id => !removed.has(id)).map(id => ({ id: id as AnyNodeId, data: nodes[id] as Partial<AnyNode> })), delete: [...removed] as AnyNodeId[] }
}
