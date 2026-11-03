'use client'

import { SegmentedControl } from '@pascal-app/editor'
import { pathwayEdgeProfiles, type PathwayEdgeProfile, type PathwayNode } from '../domain/schema'

export function PathwayEdgeControl({ node, onUpdate }: {
  node: PathwayNode
  onUpdate: (patch: Partial<PathwayNode>) => void
}) {
  const control = (label: string, key: 'stoneEdge' | 'borderEdge') => (
    <div role="group" aria-label={label} className="space-y-1 px-3 py-2">
      <div className="text-xs text-foreground/80">{label}</div>
      <SegmentedControl value={(node[key] ?? 'soft') as PathwayEdgeProfile}
        options={pathwayEdgeProfiles.map((profile) => ({ value: profile, label: profile }))}
        onChange={(profile) => onUpdate({ [key]: profile })} />
    </div>
  )
  return <>
    {node.finish === 'laidStone' && control('Stone edges', 'stoneEdge')}
    {node.borderStyle !== 'none' && control('Border edges', 'borderEdge')}
  </>
}
