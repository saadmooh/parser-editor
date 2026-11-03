'use client'

import { SliderControl } from '@pascal-app/editor'
import { isNaturalStoneFinish, type PathwayNode } from '../domain/schema'
import { naturalStoneDefaults } from '../rendering/natural-stones'

export function NaturalStoneControl({ node, onUpdate }: {
  node: PathwayNode
  onUpdate: (patch: Partial<PathwayNode>) => void
}) {
  if (!isNaturalStoneFinish(node.finish)) return null
  const defaults = naturalStoneDefaults[node.finish]
  return <div role="group" aria-label="Natural stone layout">
    <div style={{ fontSize: 12, padding: '8px 12px 4px' }}>Stone layout</div>
    <SliderControl label="Stone size" value={node.naturalStoneSize ?? defaults.size}
      onChange={(value) => onUpdate({ naturalStoneSize: value })}
      min={0.15} max={1.5} step={0.01} precision={2} unit="m" />
    <SliderControl label={node.finish === 'steppingStones' ? 'Stride gap' : 'Spacing'}
      value={node.naturalStoneGap ?? defaults.gap}
      onChange={(value) => onUpdate({ naturalStoneGap: value })}
      min={0.015} max={0.5} step={0.005} precision={3} unit="m" />
    <SliderControl label="Shape variation" value={(node.naturalStoneIrregularity ?? 0.45) * 100}
      onChange={(value) => onUpdate({ naturalStoneIrregularity: value / 100 })}
      min={0} max={100} step={5} precision={0} unit="%" />
    <SliderControl label="Color variation" value={(node.naturalStoneShade ?? 0.4) * 100}
      onChange={(value) => onUpdate({ naturalStoneShade: value / 100 })}
      min={0} max={100} step={5} precision={0} unit="%" />
    <SliderControl label="Pattern seed" value={node.naturalStoneSeed ?? 1}
      onChange={(value) => onUpdate({ naturalStoneSeed: value })}
      min={0} max={9999} step={1} precision={0} />
  </div>
}
