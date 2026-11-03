'use client'
import { type AnyNode, getLevelDisplayName, useScene } from '@pascal-app/core'
import { ActionButton, PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { objectHierarchy, type ObjectBranch } from './object-hierarchy'

export function ObjectHierarchyPanel({ matches, onSelect }: { matches: AnyNode[]; onSelect: (nodes: AnyNode[]) => void }) {
  const nodes = useScene((state) => state.nodes)
  const levelId = useViewer((state) => state.selection.levelId)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const render = (branch: ObjectBranch): React.ReactNode => {
    const label = branch.node.type === 'level' ? getLevelDisplayName(branch.node) : branch.node.name || branch.node.type
    const control = branch.landscape
      ? <div className="flex"><ActionButton label={label} title={label} aria-pressed={selectedIds.includes(branch.node.id)} className="min-w-0 justify-start [&>span]:truncate" onClick={() => onSelect([branch.node])} /></div>
      : <p className="truncate text-xs text-muted-foreground" title={label}>{label} · parent</p>
    return <div key={branch.node.id} className="min-w-0">
      {branch.children.length ? <PanelSection title={label}>
        {control}
        <div className="space-y-1 border-l border-border pl-2">{branch.children.map(render)}</div>
      </PanelSection> : control}
    </div>
  }
  return <div aria-label="Landscape parent hierarchy" className="space-y-1">
    <p className="px-1 text-xs text-muted-foreground">Saved parent relationships. Parent containers provide context; select landscape objects to edit.</p>
    {objectHierarchy(nodes, levelId, matches).map(render)}
    {!matches.length && <p className="px-1 text-xs text-muted-foreground">No matching landscape objects.</p>}
  </div>
}
