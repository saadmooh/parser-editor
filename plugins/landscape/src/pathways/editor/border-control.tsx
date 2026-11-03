'use client'

import { SegmentedControl } from '@pascal-app/editor'
import type { PathwayBorderStyle, PathwayNode } from '../domain/schema'

const options: { value: PathwayBorderStyle; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No raised or contrasting edge' },
  { value: 'stone', label: 'Stone edging', description: 'Individual stones along each side' },
  { value: 'smooth', label: 'Smooth edge', description: 'A continuous edging strip' },
]

export function PathwayBorderControl({ node, onUpdate }: {
  node: PathwayNode
  onUpdate: (patch: Partial<PathwayNode>) => void
}) {
  return <div role="group" aria-label="Path border" className="space-y-1 px-3 py-2">
    <div className="text-xs text-foreground/80">Path border</div>
    <SegmentedControl value={(node.borderStyle ?? 'stone') as PathwayBorderStyle}
      options={options.map(({ value, label }) => ({ value, label }))}
      onChange={(borderStyle) => onUpdate({ borderStyle })} />
  </div>
}
