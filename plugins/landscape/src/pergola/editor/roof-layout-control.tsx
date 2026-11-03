'use client'
import type { PergolaNode } from '../domain/schema'
import { pergolaRoofLayout } from '../domain/layout'

export function RoofLayoutControl({
  node,
  onUpdate,
}: {
  node: PergolaNode
  onUpdate: (patch: Partial<PergolaNode>) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">
      <span>Member layout</span>
      <select
        aria-label="Member layout"
        className="max-w-[150px] rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
        value={pergolaRoofLayout(node)}
        onChange={(event) =>
          onUpdate({ roofLayout: event.target.value as NonNullable<PergolaNode['roofLayout']> })
        }
      >
        <option value="rafters">Open rafters</option>
        <option value="slatted">Shade slats</option>
        <option value="grid">Roof grid</option>
      </select>
    </label>
  )
}
