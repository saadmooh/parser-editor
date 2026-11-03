'use client'
import { ActionButton, ActionGroup, PanelSection } from './panel-controls'
import { getLevelDisplayName, useScene } from '@pascal-app/core'
import { exportFloorplanPdf, exportSheetsToPdf, SegmentedControl } from '@pascal-app/editor'
import { useState } from 'react'
import { useViewer } from '@pascal-app/viewer'
import { levelDescendants } from './scene-inventory'
import { plantingSchedule } from './schedules'
import { plantingSchedulePages } from './planting-schedule-pages'

export function PlantingDocumentationPanel() {
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'requested' | 'error'>('idle')
  const [planExportState, setPlanExportState] = useState<'idle' | 'busy' | 'requested' | 'error'>('idle')
  const nodes = useScene((state) => state.nodes)
  const readOnly = useScene((state) => state.readOnly)
  const levelId = useViewer((state) => state.selection.levelId)
  const style = levelId && nodes[levelId]?.metadata?.landscapePlanLabelStyle === 'code' ? 'code' : 'name'
  const plants = levelDescendants(nodes, levelId).filter((node) => ['landscape:plant', 'landscape:tree'].includes(node.type as string))
  const labelled = plants.filter((node) => node.metadata?.landscapePlanLabel === true).length
  const schedules = ['landscape:tree', 'landscape:plant'].map((kind) => plantingSchedule({
    siblings: plants.filter((node) => (node.type as string) === kind), unit: 'metric',
  })).filter((schedule) => schedule !== null)
  const setLabels = (visible: boolean) => {
    const state = useScene.getState()
    if (state.readOnly) return
    const updates = plants.filter((node) => (node.metadata?.landscapePlanLabel === true) !== visible)
      .map((node) => ({ id: node.id, data: { metadata: { ...state.nodes[node.id]?.metadata, landscapePlanLabel: visible, landscapePlanLabelStyle: style } } }))
    if (updates.length) state.updateNodes(updates)
  }
  return <PanelSection title="Planting documentation">
    <fieldset disabled={readOnly || !levelId} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" aria-label="Plan label style">
      <legend className="mb-1.5 px-1 text-xs text-muted-foreground">Plan labels</legend>
      <SegmentedControl value={style} options={[{ value: 'name', label: 'Names' }, { value: 'code', label: 'Codes' }]}
        onChange={(next) => {
          const state = useScene.getState()
          const level = levelId && state.nodes[levelId]
          if (state.readOnly || !level) return
          state.updateNodes([level, ...plants].map((node) => ({ id: node.id,
            data: { metadata: { ...state.nodes[node.id]?.metadata, landscapePlanLabelStyle: next } } })))
        }} />
    </fieldset>
    <ActionGroup>
      <ActionButton label="Show plan labels" disabled={readOnly || !plants.length || labelled === plants.length} onClick={() => setLabels(true)} />
      <ActionButton label="Hide plan labels" disabled={readOnly || !labelled} onClick={() => setLabels(false)} />
    </ActionGroup>
    <p className="text-xs text-muted-foreground">{labelled} of {plants.length} plants labelled.</p>
    <div className="flex"><ActionButton label={exportState === 'busy' ? 'Preparing schedule PDF…' : 'Export planting schedule PDF'} disabled={!plants.length || exportState === 'busy'}
      onClick={async () => {
        setExportState('busy')
        try {
          const level = levelId ? nodes[levelId] : undefined
          const name = level?.type === 'level' ? getLevelDisplayName(level) : 'Landscape level'
          await exportSheetsToPdf(plantingSchedulePages(schedules, name), 'landscape-planting-schedule.pdf', `${name} · planting schedule`)
          setExportState('requested')
        } catch { setExportState('error') }
      }} /></div>
    {exportState === 'requested' && <p role="status" className="text-xs text-muted-foreground">Schedule ready. Check your downloads.</p>}
    {exportState === 'error' && <p role="alert" className="text-xs text-destructive">Schedule export failed. Try again.</p>}
    <div className="flex"><ActionButton label={planExportState === 'busy' ? 'Preparing project plans…' : 'Export project plans and schedules'}
      disabled={!levelId || planExportState === 'busy'} onClick={async () => {
        setPlanExportState('busy')
        try {
          await exportFloorplanPdf('full')
          setPlanExportState('requested')
        } catch { setPlanExportState('error') }
      }} /></div>
    {planExportState === 'requested' && <p role="status" className="text-xs text-muted-foreground">Export complete. Check your downloads.</p>}
    {planExportState === 'error' && <p role="alert" className="text-xs text-destructive">Plan export failed. Try again.</p>}
    {schedules.map((schedule) => <div key={schedule.id}>
      <p className="my-2 text-xs font-medium">{schedule.title} · legend</p>
      <table className="w-full text-left text-xs"><thead><tr className="text-muted-foreground"><th className="py-2 font-medium">Code</th><th className="py-2 font-medium">Species</th><th className="py-2 text-right font-medium">Count</th></tr></thead>
        <tbody>{schedule.rows.map((row) => <tr key={row.id} className="border-b border-border/50"><td className="py-2 pr-2 font-medium">{row.cells.code}</td><td className="py-2">{row.cells.name}</td><td className="text-right">{row.cells.count}</td></tr>)}</tbody>
      </table>
    </div>)}
    {!plants.length && <p className="text-xs text-muted-foreground">Add trees or plants to build a planting legend.</p>}
  </PanelSection>
}
