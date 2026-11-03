'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, PanelSection, SegmentedControl, SliderControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useMemo } from 'react'
import { SceneToggleControl } from '../editor/scene-property-controls'
import { PanelSelect } from '../editor/panel-select'
import { DrawingModeControl } from '../ground-access/shared/drawing-mode-control'
import { circleSizePatch } from '../ground-access/shared/outline'
import { pondCapacity } from './terrain'
import { POND_KIND, PondNode } from './schema'
import { pondWaterPresets } from './presets'
import { pondBedSurfaces } from './bed-surfaces'
import { usePondSettingsEdit } from './use-settings-edit'

export default function PondPanel({ node: raw }: { node?: AnyNode | PondNode } = {}) {
  const id = useViewer(state => state.selection.selectedIds[0])
  const selected = useScene(state => id ? state.nodes[id as AnyNodeId] : undefined)
  const defaults = useEditor(state => state.toolDefaults[POND_KIND])
  const readOnly = useScene(state => state.readOnly)
  const source = raw ?? ((selected?.type as string) === POND_KIND ? selected : undefined)
  const edit = usePondSettingsEdit((source as PondNode) ?? null)
  const parsed = PondNode.safeParse({ ...(source ?? defaults ?? {}), ...edit.patch })
  const capacityKey = parsed.success ? JSON.stringify([parsed.data.shape, parsed.data.width,
    parsed.data.depth, parsed.data.outline, parsed.data.basinDepth, parsed.data.waterDrop, parsed.data.bankWidth]) : null
  const capacity = useMemo(() => parsed.success ? pondCapacity(parsed.data) : null, [capacityKey])
  if (!parsed.success || !capacity) return null
  const node = parsed.data
  const update = (patch: Partial<PondNode>) => {
    if (useScene.getState().readOnly) return
    const scene = useScene.getState(), editor = useEditor.getState()
    const current = PondNode.safeParse(source ? scene.nodes[node.id as AnyNodeId] : editor.toolDefaults[POND_KIND] ?? {})
    if (!current.success) return
    const next = circleSizePatch(current.data, patch)
    if (!PondNode.safeParse({ ...current.data, ...next }).success) return
    if (source && edit.previewing.current) edit.session.preview(next)
    else if (source) { edit.session.cancel(); scene.updateNode(node.id as AnyNodeId, next as Partial<AnyNode>) }
    else editor.setToolDefaults(POND_KIND, { ...editor.toolDefaults[POND_KIND], ...next })
  }
  const { area, volume } = capacity
  const waterSetting = (patch: Partial<PondNode>) => update({ ...patch, waterPreset: 'custom' })
  return <div onWheel={event => event.stopPropagation()} className="flex min-w-0 flex-col">
    <PanelSection title={source ? 'Dimensions' : 'Draw a pond'}>
      {!source && !readOnly && <DrawingModeControl value={node.shape} onChange={shape => update({ shape })} />}
      {!source && <p className="text-xs leading-5 text-muted-foreground">Drag to draw, or click points for a custom outline.</p>}
      <SliderControl label={node.shape === 'circle' ? 'Diameter' : 'Width'} value={node.width} unit="m" min={0.2} max={30} step={0.1} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ width: value }))} />
      {node.shape !== 'circle' && <SliderControl label="Length" value={node.depth} unit="m" min={0.2} max={30} step={0.1} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ depth: value }))} />}
      <SliderControl label="Elevation" value={node.elevation} unit="m" min={-20} max={20} step={0.05} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ elevation: value }))} />
    </PanelSection>
    <PanelSection title="Basin and bank" defaultExpanded={false}>
      <PanelSelect label="Pond bed" value={node.bedSurface} disabled={readOnly} onChange={event => update({ bedSurface: event.target.value as PondNode['bedSurface'] })}>
        {pondBedSurfaces.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </PanelSelect>
      <SliderControl label="Basin depth" value={node.basinDepth} unit="m" min={0.15} max={3} step={0.05} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ basinDepth: value }))} />
      <SliderControl label="Water level below bank" value={node.waterDrop} unit="m" min={0} max={0.12} step={0.01} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ waterDrop: value }))} />
      <SliderControl label="Bank width" value={node.bankWidth} unit="m" min={0.08} max={1.5} step={0.05} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ bankWidth: value }))} />
      <SliderControl label="Bank height" value={node.thickness} unit="m" min={0.03} max={0.5} step={0.01} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ thickness: value }))} />

    </PanelSection>
    <PanelSection title="Border" defaultExpanded={false}>
      <fieldset disabled={readOnly} aria-label="Layout" className="m-0 border-0 p-0">
        <legend className="mb-1.5 px-1 text-xs text-muted-foreground">Layout</legend>
        <SegmentedControl value={node.rockBorder} disabled={readOnly} onChange={rockBorder => update({ rockBorder })}
          options={[{ value: 'stone', label: 'Stone' }, { value: 'continuous', label: 'Rocks' }, { value: 'clusters', label: 'Clusters' }, { value: 'none', label: 'None' }]} />
      </fieldset>
      {['stone','continuous'].includes(node.rockBorder) && <fieldset disabled={readOnly} className={`m-0 flex flex-col gap-3 border-0 p-0 ${readOnly ? 'pointer-events-none opacity-60' : ''}`} aria-label="Rock border settings">
        <fieldset className="m-0 border-0 p-0"><legend className="mb-1.5 px-1 text-xs text-muted-foreground">Placement</legend>
          <SegmentedControl value={node.rockBorderPlacement} disabled={readOnly} onChange={rockBorderPlacement => update({ rockBorderPlacement })}
            options={[{ value: 'shoreline', label: 'Water edge' }, { value: 'outer', label: 'Outer bank' }, { value: 'both', label: 'Both' }]} />
        </fieldset>
        {node.rockBorder !== 'stone' && <fieldset className="m-0 border-0 p-0"><legend className="mb-1.5 px-1 text-xs text-muted-foreground">Rock shape</legend>
          <SegmentedControl value={node.rockBorderShape} disabled={readOnly} onChange={rockBorderShape => update({ rockBorderShape })}
            options={[{ value: 'mixed', label: 'Mixed' }, { value: 'rounded', label: 'Rounded' }, { value: 'angular', label: 'Angular' }]} />
        </fieldset>}
        <SliderControl label={node.rockBorder === 'stone' ? 'Border width' : 'Rock size'} value={node.rockBorderSize} unit="m" min={.15} max={1.5} step={.05} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderSize: value }))} />
        <SliderControl label="Joint gap" value={node.rockBorderGap} unit="m" min={0} max={.5} step={.025} precision={3} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderGap: value }))} />
        <PanelSection title="Variation" defaultExpanded={false} className="-mx-3">
        <SliderControl label="Size variation" value={node.rockBorderVariation * 100} unit="%" min={0} max={100} step={5} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderVariation: value / 100 }))} />
        <SliderControl label="Height variation" value={node.rockBorderHeightVariation * 100} unit="%" min={0} max={100} step={5} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderHeightVariation: value / 100 }))} />
        {node.rockBorder !== 'stone' && <>
        <SliderControl label="Shape variation" value={node.rockBorderShapeVariation * 100} unit="%" min={0} max={100} step={5} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderShapeVariation: value / 100 }))} />

        <SliderControl label="Position variation" value={node.rockBorderPositionVariation * 100} unit="%" min={0} max={100} step={5} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderPositionVariation: value / 100 }))} />
        <SliderControl label="Rotation variation" value={node.rockBorderRotationVariation * 100} unit="%" min={0} max={100} step={5} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderRotationVariation: value / 100 }))} />
        </>}
        <SliderControl label="Colour variation" value={node.rockBorderColorVariation * 100} unit="%" min={0} max={100} step={5} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderColorVariation: value / 100 }))} />
        </PanelSection>
        <SliderControl label="Moss coverage" value={node.rockBorderMoss * 100} unit="%" min={0} max={100} step={5} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ rockBorderMoss: value / 100 }))} />
        <ActionButton label="Shuffle stones" disabled={readOnly} onClick={() => {
          const seed = crypto.getRandomValues(new Uint32Array(1))[0]! % 1000000
          update({ rockBorderSeed: seed === node.rockBorderSeed ? (seed + 1) % 1000000 : seed })
        }} />
      </fieldset>}
    </PanelSection>
    <PanelSection title="Water">
      <PanelSelect label="Preset" value={node.waterPreset} disabled={readOnly} onChange={event => {
        const preset = event.target.value as keyof typeof pondWaterPresets
        if (preset in pondWaterPresets) update({ ...pondWaterPresets[preset], waterPreset: preset })
      }}>
        <option value="natural">Natural</option><option value="glass">Glass</option><option value="cinematic">Cinematic</option><option value="playful">Playful</option><option value="custom" disabled>Custom</option>
      </PanelSelect>
      <label className="flex items-center justify-between px-1 text-xs">Water colour<input aria-label="Water colour" type="color" className="h-8 w-10 cursor-pointer rounded-md border border-border/50 bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50" value={node.waterColor} disabled={readOnly} onChange={event => { edit.runPreview(() => update({ waterColor: event.target.value, waterPreset: 'custom' })); if (event.nativeEvent.type === 'change') edit.session.commit() }} onBlur={() => edit.session.commit()} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); edit.session.cancel() } }} /></label>
      <SliderControl label="Water clarity" value={node.waterClarity} min={.5} max={2} step={.05} precision={2} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => waterSetting({ waterClarity: value }))} />
      <PanelSection title="Lighting" defaultExpanded={false} className="-mx-3">
      <SliderControl label="Reflections" value={node.reflectionStrength} min={0} max={1} step={.05} precision={2} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => waterSetting({ reflectionStrength: value }))} />
      <SliderControl label="Refraction" value={node.refractionStrength} min={0} max={1.6} step={.05} precision={2} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => waterSetting({ refractionStrength: value }))} />
      <SliderControl label="Sun highlights" value={node.sunGlints} min={0} max={2} step={.05} precision={2} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => waterSetting({ sunGlints: value }))} />
      </PanelSection>
    <PanelSection title="Motion" defaultExpanded={false} className="-mx-3">
      <SliderControl label="Ripple strength" value={node.rippleStrength} min={0} max={1} step={0.05} precision={2} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => waterSetting({ rippleStrength: value }))} />
      <SceneToggleControl label="Animate water" checked={node.animated} onChange={animated => update({ animated })} />
    </PanelSection>
    </PanelSection>
    <PanelSection title="Fish" defaultExpanded={false}>
      <SliderControl label="Number of fish" value={node.fishCount} min={0} max={24} step={1} precision={0} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ fishCount: Math.round(value) }))} />
      {node.fishCount > 0 && <>
        <PanelSelect label="Species" value={node.fishType} disabled={readOnly} onChange={event => update({ fishType: event.target.value as PondNode['fishType'] })}>
          <option value="mixed">Mixed</option><option value="koi">Koi</option><option value="goldfish">Goldfish</option>
          <option value="carp">Carp</option><option value="perch">Perch</option><option value="trout">Trout</option>
        </PanelSelect>
        <SliderControl label="Fish length" value={node.fishSize} unit="m" min={.15} max={.8} step={.05} previewWhileTyping className={readOnly ? 'pointer-events-none opacity-60' : undefined} precision={2} restoreOnCommit={false} onCommit={() => edit.session.commit()} onCancel={() => edit.session.cancel()} onChange={value => edit.runPreview(() => update({ fishSize: value }))} />
      </>}

    </PanelSection>
    <p className="px-3 pb-3 text-xs text-muted-foreground">{area.toFixed(2)} m² water · approx. {(volume * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} L</p>
  </div>
}
