'use client'

import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { PanelWrapper, SliderControl, ToggleControl } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { DeckNode } from '../domain/schema'
import { DeckRailingControls } from './railing-controls'
import { deckParametrics } from './parametrics'
import { LANDSCAPE_CATALOG_THUMBNAILS } from '../../../editor/catalog-thumbnails'
import { InspectorChoice, InspectorDeleteButton, InspectorFieldLabel, InspectorNotes,
  InspectorSwatch, InspectorTabBar, useInspectorTab } from '../../shared/inspector-common'

const materials: { value: DeckNode['material']; label: string; color: string }[] = [
  { value: 'pressure-treated', label: 'Pressure treated', color: '#9b7958' },
  { value: 'cedar', label: 'Cedar', color: '#a4774e' },
  { value: 'hardwood', label: 'Hardwood', color: '#76543b' },
  { value: 'composite', label: 'Composite', color: '#827b6d' },
  { value: 'pvc', label: 'PVC', color: '#b9b5a9' },
]

export default function DeckInspector({ node: rawNode }: { node: DeckNode }) {
  const setSelection = useViewer((state) => state.setSelection)
  const [tab, setTab] = useInspectorTab()
  const node = DeckNode.parse(rawNode)
  const update = (patch: Partial<DeckNode>) => {
    const derived = deckParametrics.derive?.({ ...node, ...patch }, patch, node)
    useScene.getState().updateNode(node.id as AnyNodeId, { ...patch, ...derived } as Partial<AnyNode>)
  }
  const changeMaterial = (material: DeckNode['material']) => {
    const option = materials.find((item) => item.value === material)!
    update({ material, boardColor: option.color })
  }

  return <PanelWrapper title="Deck" icon={<img alt="" src={LANDSCAPE_CATALOG_THUMBNAILS.deck}
    className="h-10 w-12 rounded-md object-cover" />} onClose={() => setSelection({ selectedIds: [] })} width={340}>
    <div className="px-3 pb-3">
      <div className="-mt-1 mb-3 text-[11px] text-muted-foreground">Selected element</div>
      <InspectorTabBar value={tab} onChange={setTab} label="Deck settings" />

      {tab === 'properties' && <div className="flex flex-col gap-2.5">
        <DeckRailingControls node={node} selected onUpdate={update} />
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Deck type</InspectorFieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {([{ value: 'platform', label: 'Platform', detail: 'Low profile' },
              { value: 'raised', label: 'Raised', detail: 'With supports' }] as const).map((item) =>
              <InspectorChoice key={item.value} label={item.label} selected={node.deckType === item.value}
                onClick={() => update({ deckType: item.value })}>
                <span className="flex h-9 w-10 shrink-0 items-center justify-center rounded bg-[#76543b]">
                  <span className={`block w-6 border-t-2 border-[#d0a77b] ${item.value === 'raised' ? 'h-5 border-b-2' : 'h-2'}`} />
                </span>
                <span><span className="block text-xs">{item.label}</span><span className="block text-[10px] text-muted-foreground">{item.detail}</span></span>
              </InspectorChoice>) }
          </div>
        </div>
        <SliderControl label="Width" value={node.width} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(width) => update({ width })} />
        <SliderControl label="Length" value={node.depth} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(depth) => update({ depth })} />
        <div className="flex items-center justify-between px-1 text-xs"><span className="text-muted-foreground">Area</span><span>{(node.width * node.depth).toFixed(1)} m²</span></div>
        <SliderControl label={node.deckType === 'raised' ? 'Height' : 'Thickness'} value={node.thickness} min={0.03} max={2} step={0.01} precision={2} unit="m" onChange={(thickness) => update({ thickness })} />
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Board direction</InspectorFieldLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {([{ value: 'lengthwise', label: 'Lengthwise', direction: 'horizontal' },
              { value: 'crosswise', label: 'Crosswise', direction: 'vertical' },
              { value: 'diagonal', label: 'Diagonal', direction: 'diagonal' }] as const).map((item) =>
              <button type="button" key={item.value} aria-label={item.label} aria-pressed={node.boardDirection === item.value}
                onClick={() => update({ boardDirection: item.value })}
                className={`flex flex-col items-center gap-1 rounded-md border p-1.5 text-[10px] ${node.boardDirection === item.value
                  ? 'border-primary/70 bg-primary/10' : 'border-border/60 text-muted-foreground hover:bg-accent/40'}`}>
                <InspectorSwatch color={node.boardColor} direction={item.direction} />{item.label}
              </button>) }
          </div>
        </div>
        <SliderControl label="Board width" value={node.boardWidth} min={0.09} max={0.25} step={0.005} precision={3} unit="m" onChange={(boardWidth) => update({ boardWidth })} />
        <SliderControl label="Board gap" value={node.boardGap} min={0.003} max={0.025} step={0.001} precision={3} unit="m" onChange={(boardGap) => update({ boardGap })} />
        <SliderControl label="Board thickness" value={node.boardThickness} min={0.018} max={0.06} step={0.002} precision={3} unit="m" onChange={(boardThickness) => update({ boardThickness })} />
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Perimeter</InspectorFieldLabel>
          <div className="grid grid-cols-3 gap-1.5">{([{ value: 'none', label: 'None' }, { value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }] as const).map((item) =>
            <button key={item.value} type="button" aria-pressed={node.borderStyle === item.value} onClick={() => update({ borderStyle: item.value })}
              className={`rounded-md border px-1 py-2 text-[10px] ${node.borderStyle === item.value ? 'border-primary/70 bg-primary/10' : 'border-border/60 text-muted-foreground'}`}>{item.label}</button>)}</div>
          <div className="mt-2"><ToggleControl label="Fascia" checked={node.fascia} onChange={(fascia) => update({ fascia })} /></div>
          <div className="mt-2"><InspectorFieldLabel>Skirting</InspectorFieldLabel>
            <div className="grid grid-cols-3 gap-1.5">{([{ value: 'none', label: 'Open' }, { value: 'solid', label: 'Solid' }, { value: 'slatted', label: 'Slatted' }] as const).map((item) =>
              <button key={item.value} type="button" aria-pressed={node.skirtStyle === item.value} onClick={() => update({ skirtStyle: item.value })}
                className={`rounded-md border px-1 py-2 text-[10px] ${node.skirtStyle === item.value ? 'border-primary/70 bg-primary/10' : 'border-border/60 text-muted-foreground'}`}>{item.label}</button>)}</div>
          </div>
        </div>
        {node.deckType === 'raised' && <>
          <ToggleControl label="Individual support posts" checked={node.supportPosts} onChange={(supportPosts) => update({ supportPosts })} />
          {node.supportPosts && <>
            <SliderControl label="Post spacing" value={node.supportSpacing} min={0.8} max={4} step={0.1} precision={1} unit="m" onChange={(supportSpacing) => update({ supportSpacing })} />
            <SliderControl label="Post width" value={node.postSize} min={0.07} max={0.25} step={0.01} precision={2} unit="m" onChange={(postSize) => update({ postSize })} />
          </>}
        </>}
      </div>}

      {tab === 'materials' && <div className="flex flex-col gap-3">
        <div><InspectorFieldLabel>Deck material</InspectorFieldLabel><div className="flex flex-col gap-1.5">
          {materials.map((item) => <InspectorChoice key={item.value} label={item.label} selected={node.material === item.value}
            onClick={() => changeMaterial(item.value)}>
            <InspectorSwatch color={item.color} />
            <span className="text-xs">{item.label}</span>
          </InspectorChoice>)}
        </div></div>
        <label className="flex items-center justify-between text-xs text-muted-foreground">Board color
          <input aria-label="Board color" type="color" value={node.boardColor} onChange={(event) => update({ boardColor: event.currentTarget.value })}
            className="h-7 w-10 cursor-pointer rounded border border-border/60 bg-secondary p-0.5" />
        </label>
        <label className="flex items-center justify-between text-xs text-muted-foreground">Edge color
          <input aria-label="Edge color" type="color" value={node.borderColor} onChange={(event) => update({ borderColor: event.currentTarget.value, fasciaColor: event.currentTarget.value, skirtColor: event.currentTarget.value })}
            className="h-7 w-10 cursor-pointer rounded border border-border/60 bg-secondary p-0.5" />
        </label>
      </div>}
      {tab === 'notes' && <InspectorNotes item="deck" nodeId={node.id} />}
    </div>
    <div className="flex shrink-0 items-center border-t border-border/50 px-3 py-2">
      <InspectorDeleteButton item="deck" onDelete={() => {
        useScene.getState().deleteNode(node.id as AnyNodeId)
        setSelection({ selectedIds: [] })
      }} />
    </div>
  </PanelWrapper>
}
