'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup } from '@pascal-app/editor'
import { SceneMetricControl, SceneToggleControl } from '../editor/scene-property-controls'
import { WateringSelect, WateringDetails } from './watering-controls'
import { useState } from 'react'
import { IrrigationControllerNode, controllerSchedule, controllerAssignmentIssues } from './controller'
import { IrrigationValveNode } from './valve'
import { zoneColor } from './zone-model'
export function WateringTimeline({ node }: { node: IrrigationControllerNode }) {
  const nodes = useScene(s => s.nodes), readOnly = useScene(s => s.readOnly), [day, setDay] = useState(1)
  const valves = Object.values(nodes).flatMap(raw => { const p = IrrigationValveNode.safeParse(raw); return p.success && p.data.parentId === node.parentId ? [p.data] : [] })
  const controllers = Object.values(nodes).flatMap(raw => { const p = IrrigationControllerNode.safeParse(raw); return p.success ? [p.data] : [] })
  const update = (patch: Partial<IrrigationControllerNode>) => {
    if (!useScene.getState().readOnly) useScene.getState().updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
  }
  const stationUpdate = (index: number, patch: Partial<IrrigationControllerNode['stations'][number]>) => {
    const current = IrrigationControllerNode.safeParse(useScene.getState().nodes[node.id as AnyNodeId])
    if (!current.success || useScene.getState().readOnly) return
    if (patch.valveId && controllers.some(c => c.stations.some((s, i) => s.valveId === patch.valveId && (c.id !== node.id || i !== index)))) return
    update({ stations: current.data.stations.map((s, i) => i === index ? { ...s, ...patch } : s) })
  }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], rows = controllerSchedule(node, day)
  const total = Math.max(1, rows.reduce((n, r) => n + (r.active ? r.adjustedMinutes : 0), 0))
  return <section aria-label={`Watering times for ${node.name || 'controller'}`} className="space-y-3">
    <p className="text-xs font-medium">{node.name || 'Watering controller'}</p>
    <SceneToggleControl label="Program enabled" checked={node.enabled} onChange={enabled => update({ enabled })} />
    <label className="flex items-center gap-2 text-xs">Start time<input type="time" aria-label="Watering start time" value={node.startTime} disabled={readOnly} onChange={e => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)) update({ startTime: e.target.value }) }} className="h-9 min-w-0 flex-1 rounded-lg border border-border/50 bg-secondary px-2 text-xs text-foreground" /></label>
    <div aria-label="Watering days"><ActionGroup className="grid grid-cols-7 gap-1">{days.map((d, i) => <ActionButton key={d} label={d} aria-label={`Water on ${d}`} disabled={readOnly} aria-pressed={node.wateringDays.includes(i)} onClick={() => update({ wateringDays: node.wateringDays.includes(i) ? node.wateringDays.filter(v => v !== i) : [...node.wateringDays, i].sort() })} className={`px-0 ${node.wateringDays.includes(i) ? 'bg-primary/15 border-primary/50' : ''}`} />)}</ActionGroup></div>
    <WateringSelect label="Preview day" value={String(day)} onChange={value => setDay(Number(value))} options={days.map((d, i) => ({ value: String(i), label: d }))} />
    <div className="flex min-h-8 overflow-hidden rounded bg-secondary" aria-label="Sequential watering timeline">{rows.filter(r => r.active).map(row => {
      const valve = valves.find(v => v.id === row.valveId)
      return <div key={row.station} style={{ width: `${row.adjustedMinutes / total * 100}%`, background: zoneColor(valve?.zoneId || valve?.zone || '') }} className="min-w-0 border-r border-background p-1 text-center text-xs text-slate-950" aria-label={`${valve?.zone || 'Zone'}: ${row.start} to ${row.end}`}>{valve?.zone || `Slot ${row.station}`}</div>
    })}</div>
    <p className="text-xs text-muted-foreground">{days[day]} · {rows.some(r => r.active) ? `${node.startTime} · ${total.toFixed(0)} min total` : 'No watering configured for this day'}</p>
    <div className="space-y-2">{node.stations.map((s, i) => {
      if (!s.valveId) return null
      const valve = valves.find(v => v.id === s.valveId)
      return <div key={i} className="space-y-1 border-t border-border/50 pt-2">
        <p className="text-xs font-medium">{valve?.zone || 'Missing valve'}</p>
        <SceneMetricControl label="Duration" value={s.runMinutes} min={0} max={180} step={1} precision={0} unit="min" onChange={runMinutes => stationUpdate(i, { runMinutes: Math.round(runMinutes) })} />
        <SceneToggleControl label="Zone enabled" checked={s.enabled} onChange={enabled => stationUpdate(i, { enabled })} />
        <p className="text-xs tabular-nums text-muted-foreground">{rows[i]?.start ? `${rows[i]!.start} to ${rows[i]!.end}` : 'Off on this day'}</p>
      </div>
    })}</div>
    <WateringDetails title="Controller options">
      <SceneMetricControl label="Seasonal adjustment" value={node.seasonalPercent} min={0} max={200} step={5} precision={0} unit="%" onChange={seasonalPercent => update({ seasonalPercent: Math.round(seasonalPercent) })} />
      {node.stations.map((s, i) => <WateringSelect key={i} label={`Station ${i + 1}`} value={s.valveId ?? ''} disabled={readOnly} onChange={value => stationUpdate(i, { valveId: value || undefined })} options={[{ value: '', label: 'Unused' }, ...(s.valveId && !valves.some(v => v.id === s.valveId) ? [{ value: s.valveId, label: 'Missing valve' }] : []), ...valves.map(v => ({ value: v.id, label: v.zone || v.name || 'Valve', disabled: controllers.some(c => c.stations.some((station, j) => station.valveId === v.id && (c.id !== node.id || i !== j))) }))]} />)}
    </WateringDetails>
    {controllerAssignmentIssues(node, valves, controllers).map(issue => <p key={issue} className="text-xs text-destructive">{issue}</p>)}
    <p className="text-xs text-muted-foreground">Adjust times for your plants and soil.</p>
  </section>
}
