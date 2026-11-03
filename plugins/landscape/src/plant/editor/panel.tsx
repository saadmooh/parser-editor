'use client'
import { ActionButton, PanelSection } from '../../editor/panel-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { MetricControl, SegmentedControl, SliderControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { PLANT_PRESETS, PLANT_PRESET_BY_KEY } from '../domain/catalog'
import { PLANT_KIND, PlantNode } from '../domain/schema'
import { PlacementContinuation } from '../../editor/placement-continuation'

const selectClass = 'max-w-[65%] rounded-md border border-border/50 bg-[#2C2C2E] min-h-9 px-3 py-2 text-xs text-foreground'

export default function PlantPanel() {
  const levelId = useViewer((state) => state.selection.levelId)
  const readOnly = useScene((state) => state.readOnly)
  const active = useEditor((state) => state.tool === PLANT_KIND)
  const defaults = useEditor((state) => state.toolDefaults[PLANT_KIND])
  const selectedId = useViewer((state) => state.selection.selectedIds.length === 1 ? state.selection.selectedIds[0] : undefined)
  const selectedRaw = useScene((state) => selectedId ? state.nodes[selectedId as AnyNodeId] : undefined)
  const selected = (selectedRaw?.type as string | undefined) === PLANT_KIND ? PlantNode.parse(selectedRaw) : null
  const node = selected ?? PlantNode.parse(defaults ?? {})
  const preset = PLANT_PRESET_BY_KEY[node.preset]
  const procedural = preset?.source !== 'FABOTANIC'
  const paintMode = defaults?.landscapePaintMode === 'brush' || defaults?.landscapePaintMode === 'erase' ? defaults.landscapePaintMode : 'point'
  const setPaint = (patch: Record<string, unknown>) => useEditor.getState().setToolDefaults(PLANT_KIND, { ...useEditor.getState().toolDefaults[PLANT_KIND], ...patch })
  const update = (patch: Partial<PlantNode>) => {
    if (selected) useScene.getState().updateNode(selected.id as AnyNodeId, patch as Partial<AnyNode>)
    else useEditor.getState().setToolDefaults(PLANT_KIND, { ...defaults, ...patch })
  }
  const start = () => {
    if (!levelId || useScene.getState().readOnly) return
    const editor = useEditor.getState()
    editor.setMode('build'); editor.setTool(PLANT_KIND)
  }
  return <section aria-label="Plant settings" className="flex flex-col">
    {!selected && <div className="space-y-3 px-3 py-3" role="group" aria-label="Planting tool mode">
      <SegmentedControl value={paintMode} onChange={(landscapePaintMode) => setPaint({ landscapePaintMode })}
        options={[{ value: 'point', label: 'Point' }, { value: 'brush', label: 'Brush' }, { value: 'erase', label: 'Erase' }]} />
      {paintMode === 'point' ? <PlacementContinuation /> : <>
        <MetricControl label={paintMode === 'brush' ? 'Brush spacing' : 'Erase radius'} value={Number(defaults?.landscapeBrushSize ?? 1)} min={0.1} max={10} step={0.1} unit="m" precision={2}
          onChange={(landscapeBrushSize) => setPaint({ landscapeBrushSize })} />
        <p className="text-xs leading-5 text-muted-foreground">{paintMode === 'brush' ? 'Drag to plant a spaced row, up to 500 plants per stroke.' : 'Drag to erase visible plants on this level, including other species. Trees are retained.'} Release to apply one undoable stroke. Escape cancels.</p>
      </>}
    </div>}
    <div className="space-y-3 px-3 pb-3">
      <label className="mb-2 flex items-center justify-between gap-2 text-xs text-foreground/80">
        <span>Plant</span><select className={selectClass} value={node.preset}
          onChange={(event) => update({ preset: event.currentTarget.value })}>
          {PLANT_PRESETS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select>
      </label>
      <p className="mb-2 text-xs text-muted-foreground">{preset?.category}</p>
      {!selected && <div className="flex"><ActionButton type="button" disabled={!levelId || readOnly} onClick={start}
        label={active ? paintMode === 'point' ? 'Click in scene to place plant' : paintMode === 'brush' ? 'Drag in scene to plant' : 'Drag in scene to erase plants' : `Place ${preset?.name ?? 'plant'}`} className="disabled:opacity-50" /></div>}
    </div>
    <PanelSection title="Plant shape">
      <SliderControl label="Size" value={node.scale} min={0.1} max={5} step={0.05} precision={2} onChange={(scale) => update({ scale })} />
      {procedural && <>
        <SliderControl label="Density" value={node.density} min={0.1} max={node.preset.startsWith('claude:') && preset?.form !== 'grass' ? 1 : 2} step={0.05} precision={2} onChange={(density) => update({ density })} />
        <SliderControl label="Variation" value={node.variation} min={0} max={1} step={0.05} precision={2} onChange={(variation) => update({ variation })} />
        <SliderControl label="Seed" value={node.seed} min={0} max={99999} step={1} precision={0} onChange={(seed) => update({ seed })} />
      </>}
    </PanelSection>
    <PanelSection title="Color" defaultExpanded={false}>
      <label className="flex min-h-9 items-center justify-between gap-3 border-b border-border/50 px-2 text-xs text-foreground/80">
        <span>Foliage tint</span><input type="color" value={node.tint ?? preset?.foliage ?? '#628b50'}
          onChange={(event) => update({ tint: event.currentTarget.value })} />
      </label>
    </PanelSection>
  </section>
}
