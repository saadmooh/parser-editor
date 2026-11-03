'use client'
import { useEffect } from 'react'
import { type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, useEditor } from '@pascal-app/editor'
import { reviewZoneHydraulics } from './hydraulics'
import type { IrrigationSourceNode } from './source'
import { getWateringPlayback, setWateringPlayback, useWateringPlayback } from './playback'
import { WateringDetails } from './watering-controls'
import { selectLandscapeObjects } from '../editor/objects-panel'

export function HydraulicReviewPanel({ source, zone }: { source: IrrigationSourceNode; zone: string }) {
  const nodes = useScene(s => s.nodes), playback = useWateringPlayback()
  const review = reviewZoneHydraulics(source, zone, nodes)
  useEffect(() => {
    if (getWateringPlayback()?.zone === zone) setWateringPlayback(null)
    return () => { if (getWateringPlayback()?.zone === zone) setWateringPlayback(null) }
  }, [nodes, zone])
  return <div className="space-y-2 text-xs">
    <p className="font-medium">{review.status === 'draft' ? 'Enter supply measurements' : review.status === 'ready' ? 'Estimates pass' : 'Check this zone'}</p>
    <div className="h-2 overflow-hidden rounded bg-secondary" aria-label="Zone demand versus design budget"><div className={`h-full ${review.demand > review.budget ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, review.budget ? review.demand / review.budget * 100 : 100)}%` }} /></div>
    <p>{review.demand.toFixed(1)} / {review.budget.toFixed(1)} L/min available · {review.outlets.length} connected</p>
    {!!review.outlets.length && <p>{Math.min(...review.outlets.map(o => o.pressureBar)).toFixed(2)} bar lowest estimated outlet pressure</p>}
    <ActionGroup><ActionButton label={playback?.zone === zone ? 'Stop zone preview' : 'Play zone preview'} disabled={!source.enabled || !review.outlets.length} onClick={() => {
      if (playback?.zone === zone) setWateringPlayback(null)
      else { setWateringPlayback({ zone, deviceIds: review.outlets.filter(o => o.pressureBar > 0).map(o => o.id) }); useEditor.getState().setViewMode('3d'); selectLandscapeObjects(review.outlets.flatMap(o => nodes[o.id as AnyNodeId] ? [nodes[o.id as AnyNodeId]!] : [])) }
    }} /></ActionGroup>
    <WateringDetails title="Design checks"><div className="space-y-1">{review.issues.map(issue => <p key={issue} className="leading-5 text-muted-foreground">{issue}</p>)}<p className="leading-5 text-muted-foreground">Animation shows connected sprinklers, not water distribution.</p>{review.runs.map(r => <p key={r.id}>{nodes[r.id as AnyNodeId]?.name || 'Pipe'} · {r.flow.toFixed(1)} L/min · {r.velocity.toFixed(2)} m/s · {r.lossBar.toFixed(3)} bar loss</p>)}{review.assumptions.map(note => <p key={note} className="text-muted-foreground">{note}</p>)}</div></WateringDetails>
  </div>
}
