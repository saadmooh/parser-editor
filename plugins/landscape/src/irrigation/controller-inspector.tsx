'use client'
import { SceneMetricControl, SceneToggleControl } from '../editor/scene-property-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { IrrigationControllerNode, controllerSchedule, controllerAssignmentIssues } from './controller'
import { IrrigationValveNode } from './valve'
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function IrrigationControllerInspector({ node: raw }: { node?: AnyNode } = {}) {
  const selectedId = useViewer(state => state.selection.selectedIds[0])
  const nodes = useScene(state => state.nodes)
  const readOnly = useScene(state => state.readOnly)
  const [slot, setSlot] = useState(0)
  const [previewDay, setPreviewDay] = useState(1)
  const parsed = IrrigationControllerNode.safeParse(raw ?? (selectedId ? nodes[selectedId as AnyNodeId] : undefined))
  if (!parsed.success) return null
  const node = parsed.data
  const station = node.stations[slot]!
  const valves = Object.values(nodes).flatMap(raw => { const parsed = IrrigationValveNode.safeParse(raw); return parsed.success && parsed.data.parentId === node.parentId ? [parsed.data] : [] })
  const occupied = new Set(Object.values(nodes).flatMap(raw => {
    const parsed = IrrigationControllerNode.safeParse(raw)
    return parsed.success ? parsed.data.stations.flatMap((station, index) => parsed.data.id !== node.id || index !== slot ? station.valveId ? [station.valveId] : [] : []) : []
  }))
  const update = (patch: Partial<IrrigationControllerNode>) => {
    const state = useScene.getState()
    if (!state.readOnly && IrrigationControllerNode.safeParse(state.nodes[node.id as AnyNodeId]).success) state.updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
  }
  const updateStation = (patch: Partial<IrrigationControllerNode['stations'][number]>) => {
    const state = useScene.getState()
    const current = IrrigationControllerNode.safeParse(state.nodes[node.id as AnyNodeId])
    if (state.readOnly || !current.success) return
    if (patch.valveId) {
      const valve = IrrigationValveNode.safeParse(state.nodes[patch.valveId as AnyNodeId])
      if (!valve.success || valve.data.parentId !== current.data.parentId) return
      for (const raw of Object.values(state.nodes)) {
        const controller = IrrigationControllerNode.safeParse(raw)
        if (controller.success && controller.data.stations.some((station, index) => station.valveId === patch.valveId && (controller.data.id !== node.id || index !== slot))) return
      }
    }
    const stations = current.data.stations.map((station, index) => index === slot ? { ...station, ...patch } : station)
    update({ stations })
  }
  return <div onWheelCapture={event => event.stopPropagation()}><PanelSection title="Controller schedule">
    <p className="text-xs leading-5 text-muted-foreground">Authored weekly sequence of eight stations in project wall-clock time. Signal assignments are separate from water pipes. This schedule does not simulate valve actuation, weather, supply pressure or watering.</p>
    <SceneToggleControl label="Controller enabled" checked={node.enabled} onChange={enabled => update({ enabled })} />
    <ActionGroup className="grid grid-cols-4" >{[1, 2, 3, 4, 5, 6, 0].map(day => <ActionButton key={day} label={weekdays[day]!.slice(0, 3)} aria-label={`Water on ${weekdays[day]}`} aria-pressed={node.wateringDays.includes(day)} disabled={readOnly}
      className={node.wateringDays.includes(day) ? 'border-primary/50 bg-primary/15' : ''} onClick={() => {
        const current = IrrigationControllerNode.safeParse(useScene.getState().nodes[node.id as AnyNodeId])
        if (!current.success) return
        const wateringDays = current.data.wateringDays.includes(day) ? current.data.wateringDays.filter(value => value !== day) : [...current.data.wateringDays, day].sort((a, b) => a - b)
        update({ wateringDays })
      }} />)}</ActionGroup>
    <p className="text-xs text-muted-foreground">Watering days: {node.wateringDays.length ? node.wateringDays.map(day => weekdays[day]!.slice(0, 3)).join(', ') : 'None — program will not run'}.</p>
    <SceneMetricControl label="Seasonal duration" value={node.seasonalPercent} unit="%" precision={0} min={0} max={200} step={5} onChange={seasonalPercent => update({ seasonalPercent })} />
    <label className="flex items-center gap-2 text-xs text-muted-foreground">Daily start
      <input key={`${node.id}:${node.startTime}`} aria-label="Controller start time" type="time" defaultValue={node.startTime} disabled={readOnly}
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-foreground" onBlur={event => { const value = event.target.value; if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) && value !== node.startTime) update({ startTime: value }) }} />
    </label>
    <label className="flex items-center gap-2 text-xs text-muted-foreground">Station
      <select aria-label="Controller station" value={slot} onChange={event => setSlot(Number(event.target.value))} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-foreground">
        {node.stations.map((_, index) => <option key={index} value={index}>Station {index + 1}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-xs text-muted-foreground">Valve
      <select aria-label="Station valve" value={station.valveId ?? ''} disabled={readOnly} onChange={event => updateStation({ valveId: event.target.value || undefined })} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-foreground">
        <option value="">Unassigned</option>
        {station.valveId && !valves.some(valve => valve.id === station.valveId) && <option value={station.valveId}>Missing valve</option>}
        {valves.map(valve => <option key={valve.id} value={valve.id} disabled={occupied.has(valve.id)}>{valve.name || 'Zone valve'} · {valve.zone}{occupied.has(valve.id) ? ' · Assigned' : ''}</option>)}
      </select>
    </label>
    <SceneToggleControl label="Station enabled" checked={station.enabled} onChange={enabled => updateStation({ enabled })} />
    <SceneMetricControl label="Station run duration" value={station.runMinutes} unit="min" precision={0} min={0} max={180} step={1} onChange={runMinutes => updateStation({ runMinutes })} />
    <p className="text-xs text-muted-foreground">Adjusted station duration: {controllerSchedule(node)[slot]!.adjustedMinutes.toFixed(2)} min. Seasonal adjustment preserves the authored base duration.</p>
    <label className="flex items-center gap-2 text-xs text-muted-foreground">Preview day
      <select aria-label="Controller preview day" value={previewDay} onChange={event => setPreviewDay(Number(event.target.value))} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-foreground">
        {weekdays.map((name, day) => <option key={day} value={day}>{name}</option>)}
      </select>
    </label>
    <table aria-label="Controller station schedule" className="w-full text-left text-xs tabular-nums">
      <caption className="py-2 text-left text-muted-foreground">{weekdays[previewDay]} sequence · {node.seasonalPercent}% duration</caption>
      <thead className="border-b border-border text-muted-foreground"><tr><th scope="col">Station</th><th scope="col">Valve</th><th scope="col">Time</th></tr></thead>
      <tbody>{controllerSchedule(node, previewDay).map(row => <tr key={row.station} className="border-b border-border">
        <th scope="row" className="py-2 font-normal">{row.station}</th><td>{valves.find(valve => valve.id === row.valveId)?.name ?? (row.valveId ? 'Missing valve' : 'Unassigned')}</td><td>{row.start ? `${row.start}–${row.end}` : 'Off'}</td>
      </tr>)}</tbody>
    </table>
    <div aria-label="Controller assignment review" className="space-y-1">
      {controllerAssignmentIssues(node,
        Object.values(nodes).flatMap(raw => { const parsed = IrrigationValveNode.safeParse(raw); return parsed.success ? [parsed.data] : [] }),
        Object.values(nodes).flatMap(raw => { const parsed = IrrigationControllerNode.safeParse(raw); return parsed.success ? [parsed.data] : [] })
      ).map(issue => <p key={issue} className="text-xs text-muted-foreground">{issue}</p>)}
    </div>
  </PanelSection></div>
}
