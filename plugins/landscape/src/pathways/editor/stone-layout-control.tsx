'use client'

import { SliderControl } from '@pascal-app/editor'
import { STONE_LAYOUT_DEFAULTS, type PathwayNode } from '../domain/schema'

export function StoneLayoutControl({ node, onUpdate }: {
  node: PathwayNode
  onUpdate: (patch: Partial<PathwayNode>) => void
}) {
  if (node.finish !== 'laidStone') return null
  return <div role="group" aria-label="Stone layout">
    <div style={{ fontSize: 12, padding: '8px 12px 4px' }}>Stone layout</div>
    <SliderControl label="Stone length" value={node.stoneLength ?? STONE_LAYOUT_DEFAULTS.length}
      onChange={(value) => onUpdate({ stoneLength: value })}
      min={0.18} max={0.6} step={0.01} precision={2} unit="m" />
    <SliderControl label="Joint width" value={node.stoneJoint ?? STONE_LAYOUT_DEFAULTS.joint}
      onChange={(value) => onUpdate({ stoneJoint: value })}
      min={0.015} max={0.06} step={0.005} precision={3} unit="m" />
    <SliderControl label="Variation" value={(node.stoneVariation ?? STONE_LAYOUT_DEFAULTS.variation) * 100}
      onChange={(value) => onUpdate({ stoneVariation: value / 100 })}
      min={0} max={100} step={5} precision={0} unit="%" />
  </div>
}
