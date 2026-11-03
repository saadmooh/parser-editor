'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { SegmentedControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { SurfaceDrawingPanel } from '../../shared/drawing-panel'
import { deckMinimumHeight } from '../domain/settings'
import { DeckRailingControls } from './railing-controls'
import { DECK_KIND, DeckNode } from '../domain/schema'

export function DeckPanel() {
  const placing = useEditor((state) => state.tool === DECK_KIND)
  const defaults = useEditor((state) => state.toolDefaults[DECK_KIND])
  const selectedId = useViewer((state) => state.selection.selectedIds.length === 1
    ? state.selection.selectedIds[0] : undefined)
  const raw = useScene((state) => selectedId ? state.nodes[selectedId as AnyNodeId] : undefined)
  const selected = !placing && (raw?.type as string | undefined) === DECK_KIND ? DeckNode.parse(raw) : null
  const node = selected ?? DeckNode.parse(defaults ?? {})
  const update = (patch: Partial<DeckNode>) => {
    const next = { ...patch }
    if (patch.boardThickness !== undefined || patch.frameDepth !== undefined ||
        patch.skirtStyle !== undefined)
      next.thickness = Math.max(node.thickness, deckMinimumHeight({ ...node, ...patch }))
    if (selected) useScene.getState().updateNode(selected.id as AnyNodeId, next as Partial<AnyNode>)
    else useEditor.getState().setToolDefaults(DECK_KIND, { ...useEditor.getState().toolDefaults[DECK_KIND], ...next })
  }
  const choose = <K extends 'deckType' | 'boardDirection' | 'borderStyle' | 'skirtStyle'>(
    key: K, title: string, options: readonly { value: DeckNode[K]; label: string }[]) =>
    <div className="py-1">
      <div className="mb-1 px-2 text-xs text-foreground/80">{title}</div>
      <SegmentedControl value={node[key]} options={options.map((option) => ({ ...option, value: String(option.value) }))}
        onChange={(value) => {
        const selected = value as DeckNode[K]
        if (key === 'deckType') {
          const raised = selected === 'raised'
          update({ deckType: selected as DeckNode['deckType'],
            thickness: Math.max(deckMinimumHeight({ ...node, deckType: selected as DeckNode['deckType'] }),
              raised ? Math.max(node.thickness, 1.2) : Math.min(node.thickness, 0.45)),
            supportPosts: raised })
        } else update({ [key]: selected })
      }} />
    </div>
  const number = (key: 'boardWidth' | 'boardGap' | 'boardThickness' | 'frameDepth' |
    'supportSpacing' | 'postSize',
    title: string, min: number, max: number, step: number) =>
    <SliderControl label={title} value={node[key]} min={min} max={max} step={step}
      precision={Math.max(0, Math.ceil(-Math.log10(step)))} unit="m" onChange={(value) => update({ [key]: value })} />
  const toggle = (key: 'fascia' | 'supportPosts', title: string) =>
    <ToggleControl label={title} checked={node[key]} onChange={(checked) => update({ [key]: checked })} />
  return <>
    <SurfaceDrawingPanel kind={DECK_KIND} minThickness={deckMinimumHeight(node)} />
    <DeckRailingControls node={node} selected={selected !== null} onUpdate={update} />
    <section aria-label="Deck design settings" className="mt-3 flex flex-col gap-1.5">
      <h3 style={{ fontSize: 14, margin: '0 0 5px' }}>Deck design</h3>
      {choose('deckType', 'Deck type', [
        { value: 'platform', label: 'Low platform' }, { value: 'raised', label: 'Raised deck' },
      ])}
      {choose('boardDirection', 'Board direction', [
        { value: 'lengthwise', label: 'Along depth' }, { value: 'crosswise', label: 'Along width' },
        { value: 'diagonal', label: 'Diagonal 45°' },
      ])}
      {number('boardWidth', 'Board width (m)', 0.09, 0.25, 0.005)}
      {number('boardGap', 'Board gap (m)', 0.003, 0.025, 0.001)}
      {number('boardThickness', 'Board thickness (m)', 0.018, 0.06, 0.002)}

      <h4 style={{ fontSize: 12, margin: '20px 0 0' }}>Edges</h4>
      {choose('borderStyle', 'Picture frame border', [
        { value: 'none', label: 'None' }, { value: 'single', label: 'One board' },
        { value: 'double', label: 'Two boards' },
      ])}
      {toggle('fascia', 'Show fascia on the rim')}
      {choose('skirtStyle', 'Under-deck skirting', [
        { value: 'none', label: 'Open' }, { value: 'solid', label: 'Solid' },
        { value: 'slatted', label: 'Vertical slats' },
      ])}

      <h4 style={{ fontSize: 12, margin: '20px 0 0' }}>Frame and supports</h4>
      {number('frameDepth', 'Frame depth (m)', 0.08, 0.4, 0.01)}
      {node.deckType === 'raised' && <>
        {toggle('supportPosts', 'Individual support posts (off: solid base)')}
        {node.supportPosts && <>
          {number('supportSpacing', 'Post spacing (m)', 0.8, 4, 0.1)}
          {number('postSize', 'Post width (m)', 0.07, 0.25, 0.01)}
        </>}
      </>}

    </section>
  </>
}
