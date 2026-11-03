'use client'

import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { PanelWrapper, SliderControl } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { PatioNode } from '../domain/schema'
import { finishColor } from '../rendering/geometry'
import { circleSizePatch } from '../../shared/outline'
import { LANDSCAPE_CATALOG_THUMBNAILS } from '../../../editor/catalog-thumbnails'
import { InspectorDeleteButton, InspectorFieldLabel, InspectorNotes, InspectorTabBar,
  useInspectorTab } from '../../shared/inspector-common'

type Finish = PatioNode['finish']
type Pattern = PatioNode['pattern']

const finishItems: { value: Finish; label: string; detail: string; color: string }[] = [
  { value: 'stone', label: 'Limestone pavers', detail: 'Natural stone', color: '#c3b9a5' },
  { value: 'concrete', label: 'Smooth concrete', detail: 'Cast concrete', color: '#aaa9a2' },
  { value: 'brick', label: 'Clay brick', detail: 'Fired clay', color: '#a7735d' },
]

function Swatch({ color, pattern = 'grid' }: { color: string; pattern?: Pattern }) {
  return <svg aria-hidden="true" viewBox="0 0 72 44" className="h-10 w-[68px] shrink-0 rounded-md border border-white/10">
    <rect width="72" height="44" fill={color} />
    {pattern === 'grid' ? <g fill="none" stroke="rgba(40,38,34,.38)" strokeWidth="1.5">
      <path d="M0 22h72M24 0v22m24 0V0M12 22v22m24-22v22m24-22v22" />
    </g> : <g fill="none" stroke="rgba(40,38,34,.38)" strokeWidth="1.5">
      <path d="M0 22h72M0 0h24m24 0h24M12 22v22m24-44v22m24 0v22" />
    </g>}
  </svg>
}

function ChoiceRow({ selected, onClick, children, label }: {
  selected: boolean; onClick: () => void; children: React.ReactNode; label: string
}) {
  return <button type="button" aria-label={label} aria-pressed={selected} onClick={onClick}
    className={`flex w-full min-w-0 items-center gap-2 rounded-lg border p-2 text-left transition-colors ${selected
      ? 'border-primary/70 bg-primary/10 ring-1 ring-primary/30'
      : 'border-border/70 bg-secondary/40 hover:bg-accent/40'}`}>
    {children}
  </button>
}

function PatioShapeIcon({ shape }: { shape: 'rectangle' | 'circle' | 'oval' }) {
  return <svg aria-hidden="true" viewBox="0 0 32 22" className="h-6 w-8 text-foreground/80">
    {shape === 'rectangle' && <rect x="5" y="4" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    {shape === 'circle' && <circle cx="16" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    {shape === 'oval' && <ellipse cx="16" cy="11" rx="12" ry="7" fill="none" stroke="currentColor" strokeWidth="1.6" />}
  </svg>
}

function DirectionArrow({ direction }: { direction: PatioNode['drainDirection'] }) {
  const rotation = { front: 90, back: -90, left: 180, right: 0 }[direction]
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" style={{ transform: `rotate(${rotation}deg)` }}>
    <path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

export default function PatioInspector({ node: rawNode }: { node: PatioNode }) {
  const setSelection = useViewer((state) => state.setSelection)
  const [tab, setTab] = useInspectorTab()
  const node = PatioNode.parse(rawNode)
  const update = (patch: Partial<PatioNode>) => useScene.getState().updateNode(
    node.id as AnyNodeId,
    circleSizePatch(node, patch) as Partial<AnyNode>,
  )

  const changeFinish = (finish: Finish) => update({
    finish,
    fieldColor: node.fieldColor === finishColor[node.finish] ? finishColor[finish] : node.fieldColor,
  })

  return <PanelWrapper title="Patio" icon={<img alt="" src={LANDSCAPE_CATALOG_THUMBNAILS.patio}
    className="h-10 w-12 rounded-md object-cover" />} onClose={() => setSelection({ selectedIds: [] })} width={340}>
    <div className="px-3 pb-3">
      <div className="-mt-1 mb-3 text-[11px] text-muted-foreground">Selected element</div>
      <InspectorTabBar value={tab} onChange={setTab} label="Patio settings" />

      {tab === 'properties' && <div className="flex flex-col gap-2.5">
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Patio shape</InspectorFieldLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { value: 'rectangle', label: 'Rectangle' },
              { value: 'circle', label: 'Circle' },
              { value: 'oval', label: 'Oval' },
            ] as const).map(({ value, label }) => <button key={value} type="button" aria-label={label}
              aria-pressed={node.shape === value} onClick={() => update({ shape: value })}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md border text-[10px] ${node.shape === value
                ? 'border-primary/70 bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:bg-accent/40'}`}>
              <PatioShapeIcon shape={value} />{label}
            </button>)}
          </div>
          {(node.shape === 'custom' || node.shape === 'freehand') && <p className="mt-2 text-[10px] text-muted-foreground">
            Custom outline · drag points on the patio to reshape it.
          </p>}
        </div>
        <div className="flex flex-col gap-2">
          <SliderControl label={node.shape === 'circle' ? 'Diameter' : 'Width'} value={node.width} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(width) => update({ width })} />
          {node.shape !== 'circle' && <SliderControl label="Length" value={node.depth} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(depth) => update({ depth })} />}
        </div>
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-muted-foreground">Area</span><span>{(node.width * node.depth).toFixed(1)} m²</span>
        </div>
        <SliderControl label="Thickness" value={node.thickness} min={0.03} max={2} step={0.01} precision={2} unit="m" onChange={(thickness) => update({ thickness })} />
        <SliderControl label="Elevation" value={node.elevation} min={-2} max={2} step={0.01} precision={2} unit="m" onChange={(elevation) => update({ elevation })} />
        <SliderControl label="Drainage slope" value={node.slopePercent} min={0} max={5} step={0.25} precision={2} unit="%" onChange={(slopePercent) => update({ slopePercent })} />
        {node.slopePercent > 0 && <div className="rounded-lg border border-border/70 bg-secondary/25 p-2">
          <InspectorFieldLabel>Slope direction</InspectorFieldLabel>
          <div className="grid grid-cols-4 gap-1">
            {(['front', 'back', 'left', 'right'] as const).map((direction) => <button key={direction} type="button" aria-label={`Drain ${direction}`}
              aria-pressed={node.drainDirection === direction} onClick={() => update({ drainDirection: direction })}
              className={`flex h-8 items-center justify-center rounded-md ${node.drainDirection === direction ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-accent/40'}`}>
              <DirectionArrow direction={direction} />
            </button>)}
          </div>
        </div>}
      </div>}

      {tab === 'materials' && <div className="flex flex-col gap-3">
        <div><InspectorFieldLabel>Paver material</InspectorFieldLabel><div className="flex flex-col gap-1.5">
          {finishItems.map((item) => <ChoiceRow key={item.value} label={item.label} selected={node.finish === item.value}
            onClick={() => changeFinish(item.value)}>
            <Swatch color={item.color} pattern={node.pattern} />
            <span className="min-w-0"><span className="block truncate text-xs">{item.label}</span><span className="block text-[10px] text-muted-foreground">{item.detail}</span></span>
          </ChoiceRow>)}
        </div></div>
        <div><InspectorFieldLabel>Pattern</InspectorFieldLabel><div className="grid grid-cols-2 gap-2">
          {([{ value: 'grid', label: 'Ashlar' }, { value: 'running-bond', label: 'Running bond' }] as const).map((item) => <ChoiceRow key={item.value}
            label={item.label} selected={node.pattern === item.value} onClick={() => update({ pattern: item.value })}>
            <span className="flex min-w-0 flex-col items-center gap-1"><Swatch color={finishItems.find((f) => f.value === node.finish)!.color} pattern={item.value} /><span className="text-[10px]">{item.label}</span></span>
          </ChoiceRow>)}
        </div></div>
        <SliderControl label="Paver width" value={node.paverWidth} min={0.2} max={2} step={0.05} precision={2} unit="m" onChange={(paverWidth) => update({ paverWidth })} />
        <SliderControl label="Paver length" value={node.paverDepth} min={0.2} max={2} step={0.05} precision={2} unit="m" onChange={(paverDepth) => update({ paverDepth })} />
        <SliderControl label="Joint width" value={node.jointWidth} min={0.003} max={0.04} step={0.001} precision={3} unit="m" onChange={(jointWidth) => update({ jointWidth })} />
        <div><InspectorFieldLabel>Border</InspectorFieldLabel><div className="grid grid-cols-2 gap-2">
          {([{ value: 'none', label: 'None', color: '#383a3c' }, { value: 'contrast', label: 'Corten edge', color: node.borderColor }] as const).map((item) => <ChoiceRow key={item.value}
            label={item.label} selected={node.borderStyle === item.value} onClick={() => update({ borderStyle: item.value })}>
            <Swatch color={item.color} /><span className="text-[10px]">{item.label}</span>
          </ChoiceRow>)}
        </div></div>
        {node.borderStyle !== 'none' && <SliderControl label="Border width" value={node.borderWidth} min={0.08} max={0.6} step={0.01} precision={2} unit="m" onChange={(borderWidth) => update({ borderWidth })} />}
        <label className="flex items-center justify-between text-xs text-muted-foreground">Paver color
          <input aria-label="Paver color" type="color" value={node.fieldColor} onChange={(event) => update({ fieldColor: event.currentTarget.value })} className="h-7 w-10 cursor-pointer rounded border border-border/60 bg-secondary p-0.5" />
        </label>
      </div>}

      {tab === 'notes' && <InspectorNotes item="patio" nodeId={node.id} />}
    </div>
    <div className="flex shrink-0 items-center border-t border-border/50 px-3 py-2">
      <InspectorDeleteButton item="patio" onDelete={() => {
        useScene.getState().deleteNode(node.id as AnyNodeId)
        setSelection({ selectedIds: [] })
      }} />
    </div>
  </PanelWrapper>
}
