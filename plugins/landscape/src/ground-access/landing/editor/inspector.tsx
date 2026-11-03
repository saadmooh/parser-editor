'use client'

import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { PanelWrapper, SliderControl } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { LandingNode } from '../domain/schema'
import { circleDerivedSize } from '../../shared/outline'
import { LANDSCAPE_CATALOG_THUMBNAILS } from '../../../editor/catalog-thumbnails'
import { InspectorDeleteButton, InspectorFieldLabel, InspectorNotes, InspectorTabBar,
  useInspectorTab } from '../../shared/inspector-common'

export default function LandingInspector({ node: rawNode }: { node: LandingNode }) {
  const setSelection = useViewer((state) => state.setSelection)
  const [tab, setTab] = useInspectorTab()
  const node = LandingNode.parse(rawNode)
  const update = (patch: Partial<LandingNode>) => useScene.getState().updateNode(
    node.id as AnyNodeId, { ...patch, ...circleDerivedSize({ ...node, ...patch }, patch) } as Partial<AnyNode>,
  )

  return <PanelWrapper title="Landing" icon={<img alt="" src={LANDSCAPE_CATALOG_THUMBNAILS.landing}
    className="h-10 w-12 rounded-md object-cover" />} onClose={() => setSelection({ selectedIds: [] })} width={340}>
    <div className="px-3 pb-3">
      <div className="-mt-1 mb-3 text-[11px] text-muted-foreground">Selected element</div>
      <InspectorTabBar value={tab} onChange={setTab} label="Landing settings" tabs={['properties', 'notes']} />

      {tab === 'properties' && <div className="flex flex-col gap-2.5">
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Landing outline</InspectorFieldLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {([{ value: 'rectangle', label: 'Rectangle' }, { value: 'circle', label: 'Circle' }, { value: 'oval', label: 'Oval' }] as const).map((shape) =>
              <button key={shape.value} type="button" aria-label={shape.label} aria-pressed={node.shape === shape.value}
                onClick={() => update({ shape: shape.value })}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border text-[10px] ${node.shape === shape.value
                  ? 'border-primary/70 bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:bg-accent/40'}`}>
                <svg aria-hidden="true" viewBox="0 0 32 22" className="h-6 w-8">
                  {shape.value === 'rectangle' && <rect x="5" y="4" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />}
                  {shape.value === 'circle' && <circle cx="16" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />}
                  {shape.value === 'oval' && <ellipse cx="16" cy="11" rx="12" ry="7" fill="none" stroke="currentColor" strokeWidth="1.6" />}
                </svg>{shape.label}
              </button>) }
          </div>
          {(node.shape === 'custom' || node.shape === 'freehand') && <p className="mt-2 text-[10px] text-muted-foreground">Custom outline · drag points on the landing to reshape it.</p>}
        </div>
        <SliderControl label={node.shape === 'circle' ? 'Diameter' : 'Width'} value={node.width} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(width) => update({ width })} />
        {node.shape !== 'circle' && <SliderControl label="Length" value={node.depth} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(depth) => update({ depth })} />}
        <div className="flex items-center justify-between px-1 text-xs"><span className="text-muted-foreground">Area</span><span>{(node.width * node.depth).toFixed(1)} m²</span></div>
        <SliderControl label="Thickness" value={node.thickness} min={0.03} max={2} step={0.01} precision={2} unit="m" onChange={(thickness) => update({ thickness })} />
      </div>}

      {tab === 'notes' && <InspectorNotes item="landing" nodeId={node.id} />}
    </div>
    <div className="flex shrink-0 items-center border-t border-border/50 px-3 py-2">
      <InspectorDeleteButton item="landing" onDelete={() => {
        useScene.getState().deleteNode(node.id as AnyNodeId)
        setSelection({ selectedIds: [] })
      }} />
    </div>
  </PanelWrapper>
}
