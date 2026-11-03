'use client'
import { irrigationPlanPreview } from './preview'
import { emitter, type GridEvent, type AnyNodeId, useScene } from '@pascal-app/core'
import { type FloorplanToolContext, getGridEventScreenProjection, isGridSnapActive, isAngleSnapActive, isMagneticSnapActive, useEditor, useInteractionScope, usePlacementPreview } from '@pascal-app/editor'
import { findScreenPort, projectRunToAngleLock, snapRunLength, type RunConnection } from '@pascal-app/editor/distribution'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { commitDrawing, planDrawing } from './drawing'
import { distance, irrigationPorts, portIsOccupied, type Point } from './ports'
import { IrrigationRunNode } from './run'

export default function PipeFloorplanTool(context: FloorplanToolContext) {
  const view = useEditor(s => s.viewMode)
  return view === '2d' ? <PlanDrawing {...context} /> : null
}
function PlanDrawing({ activeLevelId, sceneApi, finishTool, toolDefaults }: FloorplanToolContext) {
  const [status, setStatus] = useState('Click a socket or pipe to start')
  const [length, setLength] = useState('')
  const typed = useRef('')
  const latest = useRef<{ point: Point; connection: RunConnection } | null>(null)
  const source = useRef<{ point: Point; connection: RunConnection } | null>(null)
  const depth = typeof toolDefaults?.depth === 'number' ? toolDefaults.depth : .3
  useEffect(() => {
    if (!activeLevelId) return
    const seed = toolDefaults?.continuation as { nodeId: string; portId: string } | undefined
    const port = seed ? irrigationPorts(sceneApi.get(seed.nodeId as AnyNodeId)).find(p => p.id === seed.portId) : undefined
    source.current = port ? { point: port.position, connection: { port: { ...port, nodeId: port.nodeId as AnyNodeId }, body: null } } : null
    useInteractionScope.getState().begin({ kind: 'drafting', tool: 'landscape:irrigation-run' })
    function resolve(event: GridEvent) {
      const projection = getGridEventScreenProjection(event)
      let point = [...event.localPosition] as Point, connection: RunConnection = { port: null, body: null }
      const bypass = event.nativeEvent?.altKey === true
      if (!bypass && source.current && (isGridSnapActive() || isAngleSnapActive())) point = projectRunToAngleLock(source.current.point, point)
      if (!bypass && isGridSnapActive() && source.current) point = snapRunLength(source.current.point, point, useEditor.getState().gridSnapStep)
      if (!bypass && projection && (isGridSnapActive() || isAngleSnapActive() || isMagneticSnapActive())) {
        const [a, b, c, d, e, f] = projection.localToScreen
        const project = (p: readonly number[]) => ({ x: a * p[0]! + c * p[2]! + e, y: b * p[0]! + d * p[2]! + f, depth: 0 })
        const nodes = sceneApi.nodes()
        const ports = Object.values(nodes).flatMap(n => n.parentId === activeLevelId && n.visible !== false ? irrigationPorts(n).filter(p => !portIsOccupied(p, nodes)).map(p => ({ ...p, nodeId: p.nodeId as AnyNodeId })) : [])
        const hit = findScreenPort(ports, projection.pointer, project, source.current?.connection.port ?? null)
        if (hit) { point = [...hit.port.position]; connection = { port: hit.port, body: null } }
        else {
          let best = 12
          for (const raw of Object.values(nodes)) {
            const run = IrrigationRunNode.safeParse(raw)
            if (!run.success || raw.parentId !== activeLevelId || raw.visible === false) continue
            for (let i = 0; i < run.data.path.length - 1; i++) {
              const p = run.data.path[i]!, q = run.data.path[i + 1]!, dx = q[0] - p[0], dz = q[2] - p[2], l = dx * dx + dz * dz
              if (l < 1e-8) continue
              const t = Math.max(0, Math.min(1, ((point[0] - p[0]) * dx + (point[2] - p[2]) * dz) / l))
              const candidate: Point = [p[0] + t * dx, p[1] + t * (q[1] - p[1]), p[2] + t * dz]
              const screen = project(candidate), score = Math.hypot(screen.x - projection.pointer[0], screen.y - projection.pointer[1])
              if (score < best) { best = score; connection = { port: null, body: { nodeId: raw.id, segmentIndex: i, point: candidate } } }
            }
          }
          if (connection.body) point = connection.body.point
        }
      }
      if (source.current && typed.current) {
        const metres = Number(typed.current), delta = point.map((v, i) => v - source.current!.point[i]!), actual = Math.hypot(...delta)
        if (metres > 0 && actual > 1e-6) { point = source.current.point.map((v, i) => v + delta[i]! / actual * metres) as Point; connection = { port: null, body: null } }
      }
      return { point, connection }
    }
    function preview(event: GridEvent) {
      latest.current = resolve(event)
      if (!source.current) { setStatus(latest.current.connection.port ? `Start at ${latest.current.connection.port.id}` : latest.current.connection.body ? 'Start a branch here' : 'Click a socket or pipe to start'); return }
      try {
        const plan = planDrawing(source.current.point, latest.current.point, source.current.connection, latest.current.connection, depth, sceneApi.nodes())
        usePlacementPreview.getState().set(irrigationPlanPreview(plan, sceneApi.nodes(), activeLevelId!))
        setStatus(`${distance(source.current.point, latest.current.point).toFixed(2)} m · depth ${depth.toFixed(2)} m${latest.current.connection.port ? ` · ${latest.current.connection.port.id}` : ''}`)
      } catch (error) { usePlacementPreview.getState().clear(); setStatus((error as Error).message) }
    }
    function commit(next: NonNullable<typeof latest.current>) {
      if (useScene.getState().readOnly) return
      if (!source.current) {
        if (!next.connection.port && !next.connection.body) return
        source.current = next; return
      }
      try {
        const plan = planDrawing(source.current.point, next.point, source.current.connection, next.connection, depth, sceneApi.nodes())
        const result = commitDrawing(sceneApi, plan, activeLevelId!)
        usePlacementPreview.getState().clear(); typed.current = ''; setLength('')
        source.current = { point: result.nextStart, connection: result.nextConnection }
        if (next.connection.port || next.connection.body) finishTool()
      } catch (error) { setStatus((error as Error).message) }
    }
    function click(event: GridEvent) {
      if (event.nativeEvent?.button !== undefined && event.nativeEvent.button !== 0) return
      commit(resolve(event)); event.nativeEvent?.stopPropagation()
    }
    const cancel = () => { usePlacementPreview.getState().clear(); finishTool() }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancel() }
      if (event.key === 'Enter' && latest.current && source.current) {
        event.preventDefault()
        let next = latest.current
        if (typed.current) {
          const metres = Number(typed.current), delta = next.point.map((v, i) => v - source.current!.point[i]!), actual = Math.hypot(...delta)
          if (!Number.isFinite(metres) || metres < .05 || actual < 1e-6) { setStatus('Enter a pipe length of at least 0.05 m.'); return }
          next = { point: source.current.point.map((v, i) => v + delta[i]! / actual * metres) as Point, connection: { port: null, body: null } }
        }
        commit(next)
      }
    }
    emitter.on('grid:move', preview); emitter.on('grid:click', click); emitter.on('tool:cancel', cancel)
    window.addEventListener('keydown', key)
    return () => { emitter.off('grid:move', preview); emitter.off('grid:click', click); emitter.off('tool:cancel', cancel); window.removeEventListener('keydown', key); usePlacementPreview.getState().clear(); useInteractionScope.getState().endIf(s => s.kind === 'drafting' && s.tool === 'landscape:irrigation-run') }
  }, [activeLevelId, sceneApi, finishTool, depth, toolDefaults?.continuation])
  function changeLength(value: string) {
    typed.current = value; setLength(value)
    const from = source.current, next = latest.current, metres = Number(value)
    if (!from || !next || !value) return
    const delta = next.point.map((v, i) => v - from.point[i]!), actual = Math.hypot(...delta)
    if (!Number.isFinite(metres) || metres < .05 || actual < 1e-6) { setStatus('Enter a pipe length of at least 0.05 m.'); return }
    latest.current = { point: from.point.map((v, i) => v + delta[i]! / actual * metres) as Point, connection: { port: null, body: null } }
    try { const plan = planDrawing(from.point, latest.current.point, from.connection, latest.current.connection, depth, sceneApi.nodes()); usePlacementPreview.getState().set(irrigationPlanPreview(plan, sceneApi.nodes(), activeLevelId!)); setStatus(`${metres.toFixed(2)} m · depth ${depth.toFixed(2)} m`) }
    catch (error) { usePlacementPreview.getState().clear(); setStatus((error as Error).message) }
  }
  const host = document.querySelector('[data-floorplan-scene]')?.parentElement?.parentElement
  return host ? createPortal(<div className="absolute left-4 top-28 z-50 space-y-2 rounded-md border border-border bg-background p-3 text-xs text-foreground" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <p role="status">{status}</p><label className="flex items-center gap-2">Exact length (m)<input aria-label="Exact pipe length in metres" type="number" min="0.05" step="0.1" value={length} onChange={e => changeLength(e.target.value)} className="w-20 rounded border border-border bg-background px-2 py-1" /></label>
    <button type="button" onClick={finishTool}>Finish drawing</button>
  </div>, host) : null
}
