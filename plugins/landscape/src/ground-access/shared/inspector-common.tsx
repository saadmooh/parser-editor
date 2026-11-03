'use client'

import { useEffect, useState } from 'react'
import { type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, SegmentedControl } from '@pascal-app/editor'

export type InspectorTab = 'properties' | 'materials' | 'notes'

export function useInspectorTab() {
  return useState<InspectorTab>('properties')
}

export function InspectorTabBar({ value, onChange, label, tabs = ['properties', 'materials', 'notes'] }: {
  value: InspectorTab; onChange: (tab: InspectorTab) => void; label: string; tabs?: InspectorTab[]
}) {
  return <div role="group" aria-label={label} className="mb-3">
    <SegmentedControl value={value} onChange={onChange} options={tabs.map((tab) => ({
      value: tab, label: tab.charAt(0).toUpperCase() + tab.slice(1),
    }))} />
  </div>
}

export function InspectorFieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] font-medium text-muted-foreground">{children}</div>
}

export function InspectorChoice({ selected, onClick, label, children }: {
  selected: boolean; onClick: () => void; label: string; children: React.ReactNode
}) {
  return <button type="button" aria-label={label} aria-pressed={selected} onClick={onClick}
    className={`flex min-w-0 items-center gap-2 rounded-lg border p-2 text-left transition-colors ${selected
      ? 'border-primary/70 bg-primary/10 ring-1 ring-primary/30'
      : 'border-border/70 bg-secondary/40 hover:bg-accent/40'}`}>
    {children}
  </button>
}

export function InspectorSwatch({ color, direction = 'horizontal' }: {
  color: string; direction?: 'horizontal' | 'vertical' | 'diagonal'
}) {
  const strokes = direction === 'vertical' ? 'M18 0v44M36 0v44M54 0v44' :
    direction === 'diagonal' ? 'M-5 44 25 0M15 44 45 0M35 44 65 0M55 44 85 0' : 'M0 12h72M0 24h72M0 36h72'
  return <svg aria-hidden="true" viewBox="0 0 72 44" className="h-10 w-[68px] shrink-0 rounded-md border border-white/10">
    <rect width="72" height="44" fill={color} />
    <path d={strokes} fill="none" stroke="rgba(35,27,20,.42)" strokeWidth="1.5" />
  </svg>
}

export function InspectorNotes({ item, nodeId }: { item: string; nodeId: string }) {
  const saved = useScene((state) => {
    const value = state.nodes[nodeId as AnyNodeId]?.metadata?.landscapeNote
    return typeof value === 'string' ? value : ''
  })
  const readOnly = useScene((state) => state.readOnly)
  const [note, setNote] = useState(saved)
  useEffect(() => setNote(saved), [saved, nodeId])
  const save = () => {
    const state = useScene.getState()
    const node = state.nodes[nodeId as AnyNodeId]
    if (!node || state.readOnly || note === saved) return
    state.updateNode(node.id, { metadata: { ...node.metadata, landscapeNote: note } })
  }
  return <div className="flex flex-col gap-2">
    <InspectorFieldLabel>Notes</InspectorFieldLabel>
    <textarea value={note} onChange={(event) => setNote(event.currentTarget.value)} rows={5} disabled={readOnly}
      placeholder={`Add a note about this ${item}…`} aria-label={`${item} notes`}
      className="resize-y rounded-lg border border-border/70 bg-secondary/40 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60" />
    <ActionButton type="button" label="Save notes" onClick={save} disabled={readOnly || note === saved} className="disabled:opacity-50" />
    <p role="status" className="text-[10px] text-muted-foreground">{note === saved ? 'Notes saved to this object.' : 'Unsaved changes. Save before leaving this tab.'}</p>
  </div>
}

export function InspectorDeleteButton({ item, onDelete }: { item: string; onDelete: () => void }) {
  return <ActionButton type="button" label={`Delete ${item}`} onClick={onDelete}
    className="text-destructive hover:bg-destructive/15" />
}
