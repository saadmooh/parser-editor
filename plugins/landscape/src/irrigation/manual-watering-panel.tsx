'use client'
import { deviceMethod, assertZoneMethod } from './method'
import { irrigationPlanPreview } from './preview'
import { type AnyNode, type AnyNodeId, createSceneApi, useScene } from '@pascal-app/core'
import { ActionButton, PanelSection, SegmentedControl, useEditor, usePlacementPreview, useViewer } from '@pascal-app/editor'
import { WateringSelect } from './watering-controls'
import { SceneMetricControl } from '../editor/scene-property-controls'
import { useEffect, useRef, useState } from 'react'
import { levelDescendants } from '../editor/scene-inventory'
import { selectLandscapeObjects } from '../editor/objects-panel'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import { IrrigationZoneNode, zoneCatalog, renameZoneUpdates } from './zone-model'
import { irrigationZones } from './zones'
import { IrrigationHeadNode } from './schema'
import { DriplineNode } from './dripline'
import { IrrigationSourceNode } from './source'
import { IrrigationValveNode } from './valve'
import { IrrigationRunNode, irrigationRunIssues } from './run'
import { irrigationPorts } from './ports'
import { applyIrrigationPlan, type IrrigationPlan } from './network'
import { planConnectZone } from './connect-zone'
export function ManualWateringPanel() {
  const nodes = useScene(s => s.nodes), readOnly = useScene(s => s.readOnly)
  const level = useViewer(s => s.selection.levelId), selectedIds = useViewer(s => s.selection.selectedIds)
  const items = levelDescendants(nodes, level), catalog = zoneCatalog(items)
  const [step, setStep] = useState(0), [zoneName, setZoneName] = useState('Zone 1'), [newName, setNewName] = useState(''), [method, setMethod] = useState<'sprinkler' | 'drip'>('sprinkler')
  const [depth, setDepth] = useState(.3), [message, setMessage] = useState(''), [preview, setPreview] = useState<IrrigationPlan | null>(null), [supplyId, setSupplyId] = useState(''), [valveId, setValveId] = useState('')
  useEffect(() => {
    if (catalog.length && !catalog.some(z => z.name === zoneName)) setZoneName(catalog[0]!.name)
    else if (!catalog.length && zoneName !== 'Zone 1') { setZoneName('Zone 1'); setStep(0) }
  }, [nodes, level])
  const ownsPreview = useRef(false)
  const currentZone = catalog.find(z => z.name === zoneName)
  const areas = items.flatMap(raw => { const p = GroundAreaNode.safeParse(raw); return p.success ? [p.data] : [] })
  const heads = items.flatMap(raw => { const p = IrrigationHeadNode.safeParse(raw); return p.success ? [p.data] : [] })
  const driplines = items.flatMap(raw => { const p = DriplineNode.safeParse(raw); return p.success ? [p.data] : [] })
  const supplies = items.flatMap(raw => { const p = IrrigationSourceNode.safeParse(raw); return p.success ? [p.data] : [] })
  const valves = items.flatMap(raw => { const p = IrrigationValveNode.safeParse(raw); return p.success ? [p.data] : [] })
  const runs = items.flatMap(raw => { const p = IrrigationRunNode.safeParse(raw); return p.success ? [p.data] : [] })
  const members = items.filter(n => (n as unknown as { zone?: string }).zone === zoneName)
  const selectedAreas = areas.filter(a => selectedIds.includes(a.id))
  const selectedSupply = supplies.find(s => s.id === supplyId) ?? supplies[0]
  const selectedValve = valves.find(v => v.id === valveId && v.zone === zoneName) ?? valves.find(v => v.zone === zoneName)
  const summary = irrigationZones(heads, driplines).find(z => z.name === zoneName)
  useEffect(() => {
    setPreview(null); setMessage('')
    if (ownsPreview.current) { usePlacementPreview.getState().clear(); ownsPreview.current = false }
  }, [nodes, level, zoneName, supplyId, valveId, depth, step])
  useEffect(() => {
    if (!preview || !level) return
    const ghost = irrigationPlanPreview(preview, nodes, level)
    ownsPreview.current = true; usePlacementPreview.getState().set(ghost)
    return () => { if (usePlacementPreview.getState().node?.id === ghost.id) usePlacementPreview.getState().clear(); ownsPreview.current = false }
  }, [preview, level])
  useEffect(() => () => { if (ownsPreview.current) usePlacementPreview.getState().clear() }, [])
  const place = (kind: string) => {
    if (readOnly || !level) return
    try {
      const requested = kind === 'landscape:dripline' ? 'drip' : kind === 'landscape:irrigation-head' ? 'sprinkler' : undefined
      if (requested) assertZoneMethod(requested, zoneName, level, nodes)
    } catch (error) { setMessage((error as Error).message); return }
    setPreview(null)
    useEditor.getState().setToolDefaults(kind, { zone: zoneName, method: currentZone?.method, ...(currentZone?.id ? { zoneId: currentZone.id } : {}), depth })
    useEditor.getState().setMode('build'); useEditor.getState().setTool(kind)
  }
  const createZone = () => {
    const name = (newName || selectedAreas[0]?.name || `Zone ${catalog.length + 1}`).trim().slice(0, 80)
    if (readOnly || !level || !name) return
    if (catalog.some(z => z.name === name)) { setMessage('Choose a unique zone name.'); return }
    const zone = IrrigationZoneNode.parse({ parentId: level, name, method, areaIds: selectedAreas.map(a => a.id) })
    useScene.getState().createNode(zone as unknown as AnyNode, level); setZoneName(name); setNewName(''); setMessage(''); setStep(1)
  }
  const assign = () => {
    if (readOnly) return
    if (items.some(n => selectedIds.includes(n.id) && deviceMethod(n) && currentZone?.method && deviceMethod(n) !== currentZone.method)) { setMessage('Choose a separate zone for sprinklers and drip.'); return }
    const updates = items.flatMap(n => selectedIds.includes(n.id) && ['landscape:irrigation-head', 'landscape:dripline', 'landscape:irrigation-valve'].includes(n.type as string) ? [{ id: n.id as AnyNodeId, data: { zone: zoneName, zoneId: currentZone?.id } as Partial<AnyNode> }] : [])
    if (updates.length) useScene.getState().updateNodes(updates)
  }
  const connect = () => {
    if (!selectedSupply || !selectedValve || readOnly) return
    try {
      const plan = planConnectZone(irrigationPorts(selectedSupply)[0]!, irrigationPorts(selectedValve)[0]!, irrigationPorts(selectedValve)[1]!, [...heads.filter(h => h.zone === zoneName), ...driplines.filter(d => d.zone === zoneName)].flatMap(irrigationPorts), depth, nodes)
      if (!plan.create.length && !plan.update.length) { setMessage('This zone is already connected.'); return }
      useEditor.getState().setTool(null); useEditor.getState().setMode('select'); useEditor.getState().setViewMode('2d'); setPreview(plan); setMessage('Review the pipe and fitting preview, then apply the connections.')
    } catch (error) { setMessage((error as Error).message) }
  }
  return <PanelSection title="Manual editing" defaultExpanded={false}>
    <div className="space-y-3">
      <SegmentedControl value={String(step)} onChange={value => setStep(Number(value))} options={[{ value: '0', label: 'Zones' }, { value: '1', label: 'Devices' }, { value: '2', label: 'Pipes' }]} />
      {!level && <p role="status" className="text-xs">Select a level to make a watering plan.</p>}
      {!!catalog.length && <WateringSelect label="Zone" value={zoneName} disabled={readOnly} onChange={value => { setZoneName(value); setValveId('') }} options={[...(!catalog.some(z => z.name === zoneName) ? [{ value: zoneName, label: zoneName }] : []), ...catalog.map(z => ({ value: z.name, label: z.name }))]} />}
      {summary && <p className="text-xs text-muted-foreground">{summary.heads.length} sprinklers · {summary.driplines.length} driplines · {summary.flow.toFixed(2)} L/min entered demand</p>}
      {step === 0 && <>
        <p className="text-xs font-medium">What do you want to water?</p>
        <div className="space-y-1">{areas.map(area => <button type="button" key={area.id} aria-pressed={selectedIds.includes(area.id)} onClick={() => selectLandscapeObjects([area as unknown as AnyNode])} className="flex w-full items-center justify-between rounded border border-border px-3 py-2 text-left text-xs"><span>{area.name || 'Ground area'}</span><span>{area.surface}</span></button>)}</div>
        {!areas.length && <ActionButton className="w-full" label="Draw a watering area" disabled={readOnly || !level} onClick={() => { useEditor.getState().setMode('build'); useEditor.getState().setTool('landscape:ground-area') }} />}
        <label className="flex items-center gap-2 text-xs">Zone name<input aria-label="New watering zone name" value={newName} maxLength={80} disabled={readOnly} placeholder={selectedAreas[0]?.name || 'Front lawn'} onChange={e => setNewName(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-border/50 bg-secondary px-2 text-xs text-foreground" /></label>
        <SegmentedControl value={method} disabled={readOnly} onChange={setMethod} options={[{ value: 'sprinkler', label: 'Sprinklers' }, { value: 'drip', label: 'Dripline' }]} />
        <ActionButton className="w-full" label="Create zone" disabled={readOnly || !level} onClick={createZone} />
        {currentZone?.id && selectedAreas.length > 0 && <ActionButton className="w-full" label="Use selected areas for this zone" disabled={readOnly} onClick={() => useScene.getState().updateNode(currentZone.id as AnyNodeId, { areaIds: selectedAreas.map(a => a.id) } as Partial<AnyNode>)} />}
        {currentZone && <label className="flex items-center gap-2 text-xs">Rename zone<input key={zoneName} aria-label="Rename watering zone" defaultValue={zoneName} disabled={readOnly} maxLength={80} onBlur={e => { const name = e.target.value.trim(); if (name === zoneName) return; try { useScene.getState().updateNodes(renameZoneUpdates(items, currentZone, name)); setZoneName(name); setMessage('') } catch (error) { setMessage((error as Error).message) } }} className="h-9 min-w-0 flex-1 rounded-lg border border-border/50 bg-secondary px-2 text-xs text-foreground" /></label>}
      </>}
      {step === 1 && <>
        <p className="text-xs font-medium">Place devices in {zoneName}</p>
        <div className="grid grid-cols-2 gap-2"><ActionButton className="w-full" label="Place sprinklers" disabled={readOnly || !level} onClick={() => place('landscape:irrigation-head')} /><ActionButton className="w-full" label="Draw dripline" disabled={readOnly || !level} onClick={() => place('landscape:dripline')} /></div>
        <p className="text-xs leading-5 text-muted-foreground">Place nearby sprinklers to connect them. For drip, draw along the bed and press Enter. Select a device to adjust it.</p>
        <ActionButton className="w-full" label="Assign selected devices" disabled={readOnly || !selectedIds.length} onClick={assign} />
        {members.filter(n => ['landscape:irrigation-head', 'landscape:dripline'].includes(n.type as string)).map(n => <ActionButton key={n.id} label={n.name || (n.type as string).replace('landscape:', '')} onClick={() => selectLandscapeObjects([n])} />)}
      </>}
      {step === 2 && <>
        <p className="text-xs font-medium">Connect water to {zoneName}</p>
        <div className="grid grid-cols-2 gap-2"><ActionButton className="w-full" label="Place supply" disabled={readOnly || !level} onClick={() => place('landscape:irrigation-source')} /><ActionButton className="w-full" label="Place valve" disabled={readOnly || !level} onClick={() => place('landscape:irrigation-valve')} /></div>
        <WateringSelect label="Supply" value={selectedSupply?.id ?? ''} disabled={readOnly} onChange={setSupplyId} options={[...(!supplies.length ? [{ value: '', label: 'No supply yet' }] : []), ...supplies.map(s => ({ value: s.id, label: s.name || 'Water supply' }))]} />
        <WateringSelect label="Valve" value={selectedValve?.id ?? ''} disabled={readOnly} onChange={setValveId} options={[...(!selectedValve ? [{ value: '', label: 'No valve yet' }] : []), ...valves.filter(v => v.zone === zoneName).map(v => ({ value: v.id, label: v.name || 'Zone valve' }))]} />
        {selectedSupply && <ActionButton className="w-full" label="Edit supply measurements" onClick={() => selectLandscapeObjects([selectedSupply as unknown as AnyNode])} />}
        <SceneMetricControl label="Burial depth" value={depth} min={.05} max={3} step={.05} unit="m" onChange={setDepth} />
        <ActionButton className="w-full" label="Place controller" disabled={readOnly || !level} onClick={() => place('landscape:irrigation-controller')} />
        <ActionButton className="w-full" label="Draw pipes on the plan" disabled={readOnly || !level} onClick={() => place('landscape:irrigation-run')} />
        <ActionButton className="w-full" label="Preview connections for this zone" disabled={readOnly || !selectedSupply || !selectedValve || !summary} onClick={connect} />
        {(!selectedSupply || !selectedValve || !summary) && <p className="text-xs text-muted-foreground">Place a supply, a valve, and watering devices to preview zone connections.</p>}
        {preview && <div className="space-y-2 rounded border border-border p-2"><p className="text-xs">{preview.create.filter(n => (n.type as string) === 'landscape:irrigation-run').length} new pipes · {preview.create.filter(n => (n.type as string) === 'landscape:irrigation-fitting').length} fittings</p><ActionButton className="w-full" label="Apply these connections" disabled={readOnly || !level} onClick={() => { if (level && !useScene.getState().readOnly) { applyIrrigationPlan(createSceneApi(useScene), preview, level); setMessage(`${zoneName} is connected. Review demand below.`) } }} /><ActionButton className="w-full" label="Cancel preview" onClick={() => { setPreview(null); usePlacementPreview.getState().clear(); ownsPreview.current = false }} /></div>}
        {runs.flatMap(run => irrigationRunIssues(run, nodes).map(issue => <button key={`${run.id}:${issue}`} type="button" onClick={() => selectLandscapeObjects([run as unknown as AnyNode])} className="block w-full rounded border border-border p-2 text-left text-xs">{issue} · Focus ↗</button>))}
      </>}
      {message && <p role="status" className="text-xs">{message}</p>}
      {step === 1 && heads.some(h => h.zone === zoneName) && <ActionButton className="w-full" label="View spray in 3D" onClick={() => { useEditor.getState().setTool(null); useEditor.getState().setMode('select'); useEditor.getState().setViewMode('3d'); selectLandscapeObjects(heads.filter(h => h.zone === zoneName) as unknown as AnyNode[]) }} />}
    </div>
  </PanelSection>
}
