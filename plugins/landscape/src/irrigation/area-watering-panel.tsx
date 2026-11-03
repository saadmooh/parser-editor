'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createSceneApi, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, SegmentedControl, useEditor, usePlacementPreview, useViewer } from '@pascal-app/editor'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { IrrigationZoneNode } from './zone-model'
import { IrrigationSourceNode } from './source'
import { proposeAutomaticAreaWatering, MP1000_PROFILE, type WateringProposal } from './watering-plan'
import { IrrigationPreviewNode } from './preview'
import { applyIrrigationPlan } from './network'
import { WateringSelect, WateringDetails } from './watering-controls'
import { SceneMetricControl } from '../editor/scene-property-controls'
import { selectLandscapeObjects } from '../editor/objects-panel'

export function AreaWateringPanel({ onApplied }: { onApplied?: (zone: string, sourceId: string) => void }) {
  const nodes = useScene(s => s.nodes), readOnly = useScene(s => s.readOnly), level = useViewer(s => s.selection.levelId)
  const selectedIds = useViewer(s => s.selection.selectedIds)
  const areas = useMemo(() => Object.values(nodes).flatMap(raw => { const p = GroundAreaNode.safeParse(raw); return p.success && p.data.parentId === level && p.data.outline.length >= 3 ? [p.data] : [] }), [nodes, level])
  const supplies = Object.values(nodes).flatMap(raw => { const p = IrrigationSourceNode.safeParse(raw); return p.success && p.data.parentId === level ? [p.data] : [] })
  const [areaId, setAreaId] = useState(''), [sourceId, setSourceId] = useState('auto'), [method, setMethod] = useState<'sprinkler' | 'drip'>('sprinkler')
  const [profile, setProfile] = useState<'custom' | 'hunter-mp1000'>('hunter-mp1000'), [radius, setRadius] = useState(4.1), [flow, setFlow] = useState(3.18), [rowSpacing, setRowSpacing] = useState(.5), [emitterSpacing, setEmitterSpacing] = useState(.3), [emitterFlow, setEmitterFlow] = useState(2)
  const [proposal, setProposal] = useState<WateringProposal | null>(null), [message, setMessage] = useState('')
  const previewId = useRef<string | null>(null)
  const area = areas.find(a => a.id === areaId) ?? areas.find(a => selectedIds.includes(a.id as never)) ?? areas[0]
  useEffect(() => {
    if (!area) return
    const existing = Object.values(nodes).flatMap(raw => { const p = IrrigationZoneNode.safeParse(raw); return p.success && p.data.areaIds.includes(area.id) ? [p.data] : [] })[0]
    setMethod(existing?.method ?? (['grass', 'grass2'].includes(area.surface) ? 'sprinkler' : 'drip'))
  }, [area?.id])
  useEffect(() => {
    setProposal(null); setMessage('')
    if (previewId.current && usePlacementPreview.getState().node?.id === previewId.current) usePlacementPreview.getState().clear()
    previewId.current = null
  }, [nodes, level, area?.id, sourceId, method, profile, radius, flow, rowSpacing, emitterSpacing, emitterFlow])
  useEffect(() => {
    if (!proposal || !level) return
    const preview = IrrigationPreviewNode.parse({ parentId: level, parts: [...proposal.plan.create, ...proposal.plan.update.flatMap(u => { const raw = (nodes as Record<string, unknown>)[u.id]; return raw ? [{ ...(raw as object), ...u.data }] : [] })], uncoveredPoints: proposal.layout.uncovered, sampleSpacing: proposal.layout.sampleSpacing })
    previewId.current = preview.id
    usePlacementPreview.getState().set(preview as never)
    return () => { if (String(usePlacementPreview.getState().node?.id) === preview.id) usePlacementPreview.getState().clear() }
  }, [proposal, level])
  const generate = () => {
    if (!area || !level || readOnly) return
    try {
      const result = proposeAutomaticAreaWatering(area, { method, zone: area.name || 'Watering area', profile, radius: profile === 'hunter-mp1000' ? MP1000_PROFILE.radius : radius, fullCircleFlow: profile === 'hunter-mp1000' ? MP1000_PROFILE.fullCircleFlow : flow, rowSpacing, emitterSpacing, emitterFlow }, nodes, sourceId)
      useEditor.getState().setTool(null); useEditor.getState().setMode('select'); useEditor.getState().setViewMode('2d')
      setProposal(result); setMessage('')
    } catch (error) { setProposal(null); setMessage((error as Error).message) }
  }
  return <section aria-label="Water this area" className="space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Choose a lawn or bed. The layout includes its water connection and pipes.</p>
    {!level && <p role="status" className="text-xs text-muted-foreground">Select a level to begin.</p>}
    <WateringSelect label="Area" value={area?.id ?? ''} disabled={readOnly || !level} options={[...(!areas.length ? [{ value: '', label: 'No areas yet' }] : []), ...areas.map(a => ({ value: a.id, label: a.name || a.surface }))]} onChange={value => {
      setAreaId(value)
      const selected = areas.find(a => a.id === value)
      if (selected) { setMethod(['grass', 'grass2'].includes(selected.surface) ? 'sprinkler' : 'drip'); selectLandscapeObjects([selected as never]) }
    }} />
    {!areas.length && <ActionGroup><ActionButton label="Draw a lawn or bed" disabled={readOnly || !level} onClick={() => { useEditor.getState().setMode('build'); useEditor.getState().setTool('landscape:ground-area') }} /></ActionGroup>}
    <SegmentedControl value={method} disabled={readOnly} onChange={setMethod} options={[{ value: 'sprinkler', label: 'Sprinklers' }, { value: 'drip', label: 'Dripline' }]} />
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <svg viewBox="0 0 66 24" width="66" height="24" aria-hidden="true" className="shrink-0"><path d="M10 12H56" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="12" r="6" fill="currentColor" /><path d="M29 6l7 6-7 6zm14 0l-7 6 7 6z" fill="currentColor" /><circle cx="56" cy="12" r="4" fill="currentColor" /></svg>
      <span>{sourceId === 'draft' ? 'Devices only, no water connection' : sourceId === 'auto' ? 'Supply and valves connect automatically' : 'Connects to your chosen supply'}</span>
    </div>
    <WateringDetails title="Layout options">
      <WateringSelect label="Water connection" value={sourceId} disabled={readOnly} onChange={setSourceId} options={[{ value: 'auto', label: 'Automatic' }, ...supplies.map(s => ({ value: s.id, label: s.name || 'Water supply' })), { value: 'draft', label: 'Devices only' }]} />
      {method === 'sprinkler' ? <>
        <WateringSelect label="Sprinkler" value={profile} disabled={readOnly} onChange={value => setProfile(value as typeof profile)} options={[{ value: 'hunter-mp1000', label: 'Hunter MP1000' }, { value: 'custom', label: 'Custom' }]} />
        {profile === 'hunter-mp1000' ? <p className="text-xs leading-5 text-muted-foreground">4.1 m reach at 2.8 bar. <a className="underline" href={MP1000_PROFILE.source} target="_blank" rel="noreferrer">Product data</a></p> : <>
          <SceneMetricControl label="Reach" value={radius} onChange={setRadius} min={.5} max={30} step={.1} unit="m" />
          <SceneMetricControl label="Full-circle flow" value={flow} onChange={setFlow} min={.1} max={100} step={.1} unit="L/min" />
        </>}
      </> : <>
        <SceneMetricControl label="Row spacing" value={rowSpacing} onChange={setRowSpacing} min={.1} max={5} step={.1} unit="m" />
        <SceneMetricControl label="Emitter spacing" value={emitterSpacing} onChange={setEmitterSpacing} min={.1} max={5} step={.05} unit="m" />
        <SceneMetricControl label="Emitter flow" value={emitterFlow} onChange={setEmitterFlow} min={.1} max={20} step={.1} unit="L/h" />
      </>}
    </WateringDetails>
    {!proposal && <ActionGroup><ActionButton label="Preview layout" disabled={readOnly || !area || !level} onClick={generate} /></ActionGroup>}
    {proposal && <div className="space-y-3 rounded-lg border border-border/50 p-3 text-xs">
      <p className="font-medium">Review the preview</p>
      {proposal.supply && <div aria-label="Automatic water connection">
        <svg viewBox="0 0 240 64" className="w-full" role="img" aria-label="Supply connects through a valve to the watering devices">
          <path d="M30 25H205" stroke="currentColor" strokeWidth="3" />
          <circle cx="30" cy="25" r="11" fill="#60a5fa" /><path d="M26 25h8m-4-4v8" stroke="#17202c" strokeWidth="2" />
          <path d="M91 15l12 10-12 10zm24 0l-12 10 12 10z" fill="#86b994" /><path d="M103 25V8m-7 0h14" stroke="#86b994" strokeWidth="3" />
          {[178, 205].map(x => <circle key={x} cx={x} cy="25" r="6" fill="#60a5fa" />)}
          <text x="30" y="56" textAnchor="middle" fill="currentColor" fontSize="12">Supply</text><text x="103" y="56" textAnchor="middle" fill="currentColor" fontSize="12">Valve</text><text x="191" y="56" textAnchor="middle" fill="currentColor" fontSize="12">{method === 'drip' ? 'Dripline' : 'Sprinklers'}</text>
        </svg>
      </div>}
      <p>{proposal.layout.devices.length} {method === 'drip' ? 'driplines' : 'sprinklers'} · {proposal.zones.length} {proposal.zones.length === 1 ? 'zone' : 'zones'}</p>
      {method === 'sprinkler' && !proposal.notes.some(n => n.includes('not regenerated')) && <>
        <div className="h-1.5 overflow-hidden rounded bg-secondary"><div className="h-full rounded bg-primary" style={{ width: `${proposal.layout.coveragePercent}%` }} /></div>
        <p className="text-muted-foreground">{proposal.layout.coveragePercent.toFixed(0)}% within spray reach. Red dots mark gaps.</p>
      </>}
      {proposal.supply?.measurementStatus === 'assumed' && <p className="leading-5 text-muted-foreground">After saving, move the supply to your tap and enter measured pressure and flow.</p>}
      {method === 'drip' && proposal.supply && <p className="text-muted-foreground">Filter and pressure regulator included.</p>}
      <WateringDetails title="Design checks">
        {proposal.reviews.map((r, i) => <div key={proposal.zones[i]!.id} className="space-y-1"><p>{proposal.zones[i]!.name} · {r.demand.toFixed(1)} / {r.budget.toFixed(1)} L/min</p>{r.issues.map(issue => <p key={issue} className="leading-5 text-muted-foreground">{issue}</p>)}</div>)}
        {proposal.notes.map(note => <p key={note} className="leading-5 text-muted-foreground">{note}</p>)}
      </WateringDetails>
      {!!proposal.reviews.some(r => r.issues.some(i => i.includes('insufficient') || i.includes('exceeds'))) && <p role="status" className="leading-5 text-destructive">Pressure or flow needs review. See Design checks.</p>}
      <ActionGroup>
        <ActionButton label="Save layout" disabled={readOnly || !level} onClick={() => {
          try {
            const state = useScene.getState()
            if (state.readOnly || !level) return
            if (state.nodes !== proposal.snapshot) throw new Error('The scene changed. Preview the layout again.')
            applyIrrigationPlan(createSceneApi(useScene), proposal.plan, level)
            onApplied?.(proposal.zones[0]?.name || '', proposal.supply?.id || '')
            setProposal(null); setMessage('Layout saved. Review your zones below.')
          } catch (error) { setMessage((error as Error).message) }
        }} />
        <ActionButton label="Cancel" onClick={() => { setProposal(null); setMessage('') }} />
      </ActionGroup>
    </div>}
    {message && <p role="status" className="text-xs leading-5 text-muted-foreground">{message}</p>}
  </section>
}
