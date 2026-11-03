'use client'
import { consolidateIrrigationRuns } from './consolidate-runs'
import { applyIrrigationPlan } from './network'
import { useMemo, useState } from 'react'
import { type AnyNode, createSceneApi, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, PanelSection, SegmentedControl, useViewer } from '@pascal-app/editor'
import { AreaWateringPanel } from './area-watering-panel'
import { HydraulicReviewPanel } from './hydraulic-review-panel'
import { ManualWateringPanel } from './manual-watering-panel'
import { WateringTimeline } from './timeline'
import { IrrigationSourceNode } from './source'
import { IrrigationControllerNode } from './controller'
import { IrrigationHeadNode } from './schema'
import { DriplineNode } from './dripline'
import { IrrigationValveNode } from './valve'
import { IrrigationRunNode } from './run'
import { IrrigationFittingNode } from './fitting'
import { zoneCatalog } from './zone-model'
import { irrigationScheduleCsv } from './schedule'
import { selectLandscapeObjects } from '../editor/objects-panel'
import { reviewZoneHydraulics } from './hydraulics'
import { WateringSelect } from './watering-controls'

export function IrrigationGuidedPanel() {
  const nodes = useScene(s => s.nodes), level = useViewer(s => s.selection.levelId)
  const items = Object.values(nodes).filter(n => n.parentId === level)
  const zones = zoneCatalog(items)
  const [zoneName, setZoneName] = useState(''), [supplyId, setSupplyId] = useState(''), [view, setView] = useState<'review' | 'times'>('review')
  const active = zones.find(z => z.name === zoneName) ?? zones[0]
  const supplies = items.flatMap(raw => { const p = IrrigationSourceNode.safeParse(raw); return p.success ? [p.data] : [] })
  const supply = supplies.find(s => s.id === supplyId) ?? (active ? supplies.find(s => reviewZoneHydraulics(s, active.name, nodes).outlets.length > 0) : undefined) ?? supplies[0]
  const controllers = items.flatMap(raw => { const p = IrrigationControllerNode.safeParse(raw); return p.success ? [p.data] : [] })
  const cleanup = useMemo(() => level ? consolidateIrrigationRuns(nodes, level) : null, [nodes, level])
  const exportParts = () => {
    const parsed = <T,>(schema: { safeParse: (raw: unknown) => { success: boolean; data?: T } }) => items.flatMap(raw => { const p = schema.safeParse(raw); return p.success ? [p.data!] : [] })
    const csv = irrigationScheduleCsv(parsed(IrrigationHeadNode), { sources: supplies, controllers, driplines: parsed(DriplineNode), valves: parsed(IrrigationValveNode), runs: parsed(IrrigationRunNode), fittings: parsed(IrrigationFittingNode) })
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'landscape-irrigation.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div>
    <PanelSection title="Water an area">
      <AreaWateringPanel onApplied={(zone, source) => { setZoneName(zone); setSupplyId(source); setView('review') }} />
    </PanelSection>
    {!!zones.length && <PanelSection title="Your watering zones">
      <SegmentedControl value={view} onChange={setView} options={[{ value: 'review', label: 'Review' }, { value: 'times', label: 'Times' }]} />
      {view === 'review' && <div className="space-y-2 pt-2">
        <p className="text-xs leading-5 text-muted-foreground">Black pipes carry water. Purple dashed lines connect controller stations to valves.</p>
        <WateringSelect label="Zone" value={active?.name ?? ''} onChange={value => { setZoneName(value); setSupplyId('') }} options={zones.map(z => ({ value: z.name, label: z.name }))} />
        {!!supplies.length && <>
          {supplies.length > 1 && <WateringSelect label="Supply" value={supply?.id ?? ''} onChange={setSupplyId} options={supplies.map(s => ({ value: s.id, label: s.name || 'Water supply' }))} />}
          {supply && active && <HydraulicReviewPanel source={supply} zone={active.name} />}
          {supply && <ActionGroup><ActionButton label="Edit supply measurements" onClick={() => selectLandscapeObjects([supply as unknown as AnyNode])} /></ActionGroup>}
        </>}
        {!supplies.length && <p className="text-xs leading-5 text-muted-foreground">Choose the area above and preview it with an automatic water connection.</p>}
      </div>}
      {view === 'times' && <div className="space-y-2 pt-2">
        {controllers.map(c => <WateringTimeline key={c.id} node={c} />)}
        {!controllers.length && <p className="text-xs leading-5 text-muted-foreground">The automatic layout adds a controller when you connect water.</p>}
        <ActionGroup><ActionButton label="Export parts and times" onClick={exportParts} /></ActionGroup>
      </div>}
    </PanelSection>}
    {level && !!(cleanup?.delete?.length || cleanup?.update.length) && <PanelSection title="Existing pipes">
      <p className="text-xs leading-5 text-muted-foreground">Combine short pipe pieces into continuous runs. Tees, valves and reducers stay connected.</p>
      <ActionGroup><ActionButton label="Repair and combine pipes" onClick={() => applyIrrigationPlan(createSceneApi(useScene), consolidateIrrigationRuns(useScene.getState().nodes, level), level)} /></ActionGroup>
    </PanelSection>}
    <ManualWateringPanel />
  </div>
}
