'use client'

import { SliderControl } from '@pascal-app/editor'
import type { PathwayNode } from '../domain/schema'

export function PathwayWidthControl({ node, onUpdate }: {
  node: PathwayNode
  onUpdate: (patch: Partial<PathwayNode>) => void
}) {
  return (
    <SliderControl
      label="Width"
      value={node.defaultWidth}
      onChange={(width) => onUpdate({ defaultWidth: width })}
      min={0.3}
      max={10}
      step={0.1}
      precision={1}
      unit="m"
    />
  )
}
