'use client'
import { type AnyNode, type AnyNodeId, type ItemNode, emitter, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, PanelSection, SegmentedControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { catalogMatches } from './scene-inventory'
import { ObjectHierarchyPanel } from './object-hierarchy-panel'
import { ReadonlyIrrigationProperties } from './readonly-irrigation-properties'

export type LandscapeObjectGroup = { key: string; label: string; thumbnail: string; nodes: AnyNode[] }

export function selectLandscapeObjects(nodes: AnyNode[]) {
  if (!nodes.length) return
  const editor = useEditor.getState()
  editor.setTool(null)
  editor.setMode('select')
  editor.setPhase('building')
  useViewer.getState().setSelection({ selectedIds: nodes.map((node) => node.id) })
}

export function LandscapeObjectsPanel({ groups, query }: { groups: LandscapeObjectGroup[]; query: string }) {
  const readOnly = useScene((state) => state.readOnly)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const [grouping, setGrouping] = useState<'kind' | 'hierarchy'>('kind')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const allNodes = groups.flatMap((group) => group.nodes)
  const selectedObjects = allNodes.filter(node => selectedIds.includes(node.id))
  const thumbnails = new Map(groups.flatMap((group) => group.nodes.map((node) => [node.id, node.type === 'item' ? (node as ItemNode).asset.thumbnail : group.thumbnail] as const)))
  const rows = groups.map(group => ({ ...group, nodes: group.nodes.filter(node => catalogMatches(node.name ?? group.label, group.label, query)) })).filter(group => group.nodes.length)
  const commitName = (node: AnyNode) => {
    if (!useScene.getState().readOnly && draftName.trim()) useScene.getState().updateNode(node.id as AnyNodeId, { name: draftName.trim() })
    setEditingId(null)
  }
  return <section aria-label="Landscape objects" className="space-y-2 pt-3">
    <SegmentedControl value={grouping} onChange={setGrouping} options={[{ value: 'kind', label: 'Types' }, { value: 'hierarchy', label: 'Hierarchy' }]} />
    {selectedObjects.length > 0 && <PanelSection title={`Selected objects · ${selectedObjects.length}`}>
      {selectedObjects.length === 1 && <ActionGroup>
        <ActionButton type="button" label="Focus" onClick={() => emitter.emit('camera-controls:focus', { nodeId: selectedObjects[0]!.id as AnyNodeId })} />
        <ActionButton type="button" label="Rename" disabled={readOnly} onClick={() => {
          const node = selectedObjects[0]!
          setDraftName(node.name || groups.find(group => group.nodes.some(item => item.id === node.id))?.label || 'Object')
          setEditingId(node.id)
          setGrouping('kind')
        }} />
      </ActionGroup>}
      <ActionGroup>
        {([true, false] as const).map(visible => <ActionButton key={String(visible)}
          label={visible ? 'Show selected' : 'Hide selected'} disabled={readOnly || !selectedObjects.some(node => (node.visible !== false) !== visible)}
          onClick={() => {
            const state = useScene.getState()
            if (state.readOnly) return
            const selected = new Set(useViewer.getState().selection.selectedIds)
            const updates = allNodes.flatMap(node => {
              const current = state.nodes[node.id as AnyNodeId]
              return current && selected.has(current.id) && (current.visible !== false) !== visible
                ? [{ id: current.id as AnyNodeId, data: { visible } }] : []
            })
            if (updates.length) state.updateNodes(updates)
          }} />)}
      </ActionGroup>
    </PanelSection>}
    {grouping === 'hierarchy' && <ObjectHierarchyPanel matches={groups.flatMap((group) => group.nodes.filter((node) => catalogMatches(node.name ?? group.label, group.label, query)))} onSelect={selectLandscapeObjects} />}
    {grouping !== 'hierarchy' && !rows.length && <p className="px-1 py-3 text-xs text-muted-foreground">{query ? 'No objects match your search.' : 'No landscape objects on this level yet.'}</p>}
    {grouping !== 'hierarchy' && rows.map((group) => <PanelSection key={group.key} title={`${group.label} · ${group.nodes.length}`}>
      <div role="list" aria-label={group.label} className="flex flex-col gap-1.5">{group.nodes.map((node) => {
        const label = node.name || group.label
        return <div key={node.id} role="listitem" className={`flex h-10 min-w-0 items-center gap-1.5 rounded-lg px-1 ${selectedIds.includes(node.id) ? 'bg-accent/50' : 'hover:bg-accent/30'} ${node.visible === false ? 'text-muted-foreground' : ''}`}>
          {editingId === node.id ? <input autoFocus aria-label="Object name" value={draftName}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-secondary px-2 text-sm"
            onChange={(event) => setDraftName(event.target.value)} onBlur={() => commitName(node)}
            onKeyDown={(event) => { if (event.key === 'Enter') commitName(node); if (event.key === 'Escape') setEditingId(null) }} />
            : <button type="button" title={label} aria-label={`Select ${label}`} aria-pressed={selectedIds.includes(node.id)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                  const next = selectedIds.includes(node.id) ? selectedIds.filter((id) => id !== node.id) : [...selectedIds, node.id]
                  if (!next.length) useViewer.getState().setSelection({ selectedIds: [] })
                  else selectLandscapeObjects(next.map((id) => useScene.getState().nodes[id as AnyNodeId]).filter((item): item is AnyNode => Boolean(item)))
                } else selectLandscapeObjects([node])
              }} onDoubleClick={() => { selectLandscapeObjects([node]); emitter.emit('camera-controls:focus', { nodeId: node.id as AnyNodeId }) }}>
              <img src={thumbnails.get(node.id) ?? group.thumbnail} alt="" className="size-7 shrink-0 rounded object-cover" />
              <span className="truncate">{label}</span>
            </button>}
          <button type="button" title={`${node.visible === false ? 'Show' : 'Hide'} ${label}`} aria-label={`${node.visible === false ? 'Show' : 'Hide'} ${label}`}
            disabled={readOnly} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            onClick={() => { const state = useScene.getState(); if (!state.readOnly) state.updateNode(node.id as AnyNodeId, { visible: node.visible === false }) }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {node.visible === false && <path d="m3 3 18 18" />}
            </svg>
          </button>
        </div>
      })}</div>
    </PanelSection>)}
    <ReadonlyIrrigationProperties />
  </section>
}
