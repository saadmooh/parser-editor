'use client'

import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { MetricControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import type { DeckNode } from '../domain/schema'
import { surfaceOutline } from '../../shared/outline'

type Props = { node: DeckNode; selected: boolean; onUpdate: (patch: Partial<DeckNode>) => void }

export function DeckRailingControls({ node, selected, onUpdate }: Props) {
  const readOnly = useScene((state) => state.readOnly)
  const changeStyle = (railingStyle: DeckNode['railingStyle']) => {
    const scene = useScene.getState()
    if (scene.readOnly) return
    if (!selected) { onUpdate({ railingStyle }); return }
    scene.updateNodes([
      { id: node.id as AnyNodeId, data: { railingStyle } as Partial<AnyNode> },
      ...Object.values(scene.nodes).flatMap((fence) => fence.type === 'fence' && fence.supportSurfaceNodeId === node.id
        ? [{ id: fence.id as AnyNodeId, data: { visible: railingStyle === 'none' } }] : []),
    ])
  }
  const draw = () => {
    const scene = useScene.getState()
    if (!selected || scene.readOnly || !scene.nodes[node.id as AnyNodeId]) return
    changeStyle('none')
    const parent = node.parentId ? scene.nodes[node.parentId as AnyNodeId] : null
    if (parent?.type !== 'level') return
    const viewer = useViewer.getState()
    viewer.setSelection({ selectedIds: [], levelId: parent.id })
    const editor = useEditor.getState()
    editor.setToolDefaults('fence', {
      supportSurfaceNodeId: node.id, name: 'Deck railing', style: 'guard', height: node.railingHeight,
      thickness: 0.09, postSize: 0.09, postSpacing: node.railingPostSpacing,
      color: node.railingColor, baseStyle: 'raised', baseHeight: 0.0381,
      groundClearance: 0.09, topRailHeight: 0.0381, guardInfill: 'balusters',
      supportOffset: 0,
    })
    editor.setContinuation('fence', 'continuous')
    editor.setSnappingMode('wall', 'lines')
    editor.setTool('fence')
  }
  const outline = surfaceOutline(node)
  return <section aria-label="Deck railing" className="mt-3 flex flex-col gap-2 rounded-lg border border-border/70 p-2.5">
    <h3 className="text-xs font-medium">Railing</h3>
    <label className="flex items-center justify-between gap-2 text-xs">Type
      <select aria-label="Deck railing type" disabled={readOnly} value={node.railingStyle}
        onChange={(event) => changeStyle(event.currentTarget.value as DeckNode['railingStyle'])}
        className="rounded-md border border-border bg-background px-2 py-1">
        <option value="none">Drawn fences</option><option value="wood">Wood</option>
        <option value="metal">Metal</option><option value="cable">Cable</option><option value="glass">Glass</option>
      </select>
    </label>
    <MetricControl label="Railing height" value={node.railingHeight} min={0.3} step={0.05} precision={2} unit="m"
      onChange={(railingHeight) => onUpdate({ railingHeight })} />
    <MetricControl label="Post spacing" value={node.railingPostSpacing} min={0.1} step={0.1} precision={2} unit="m"
      onChange={(railingPostSpacing) => onUpdate({ railingPostSpacing })} />
    {node.railingStyle === 'none' ? <>
      <button type="button" disabled={!selected || readOnly} onClick={draw}
        className="rounded-md border border-border bg-secondary px-3 py-2 text-xs hover:bg-accent disabled:opacity-50">Draw railing</button>
      <p className="text-[11px] text-muted-foreground">{selected
        ? 'Click deck corners or edges to draw. Hold Alt for free placement. Press Esc to finish.'
        : 'Select a deck to draw its railing.'}</p>
    </> : <>
      <label className="flex items-center justify-between text-xs">Color
        <input aria-label="Railing color" type="color" value={node.railingColor} disabled={readOnly}
          onChange={(event) => onUpdate({ railingColor: event.currentTarget.value })} />
      </label>
      <label className="flex items-center justify-between text-xs">Edges
        <select aria-label="Railing edges" value={node.railingEdgeMode} disabled={readOnly}
          onChange={(event) => onUpdate({ railingEdgeMode: event.currentTarget.value as DeckNode['railingEdgeMode'],
            railingEdges: node.railingEdges.length ? node.railingEdges : outline.map((_, index) => index) })}>
          <option value="all">All edges</option><option value="selected">Selected edges</option>
        </select>
      </label>
      {node.railingEdgeMode === 'selected' && <div className="max-h-40 overflow-y-auto">
        {outline.map((_, index) => <label key={index} className="flex items-center gap-2 py-1 text-xs">
          <input type="checkbox" disabled={readOnly} checked={node.railingEdges.includes(index)} onChange={(event) => {
            const edges = new Set(node.railingEdges)
            if (event.currentTarget.checked) edges.add(index); else edges.delete(index)
            onUpdate({ railingEdges: [...edges].sort((a, b) => a - b) })
          }} />Edge {index + 1}
        </label>)}
      </div>}
    </>}
  </section>
}
