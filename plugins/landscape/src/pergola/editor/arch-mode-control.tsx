'use client'
import type { PergolaNode } from '../domain/schema'
import { pergolaArchMode } from '../domain/layout'

export function ArchModeControl({
  node,
  onUpdate,
}: {
  node: PergolaNode
  onUpdate: (patch: Partial<PergolaNode>) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">
      <span>Arch placement</span>
      <select
        aria-label="Full-width arch placement"
        className="max-w-[150px] rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
        value={pergolaArchMode(node)}
        onChange={(event) =>
          onUpdate({ archMode: event.target.value as NonNullable<PergolaNode['archMode']> })
        }
      >
        <option value="none">None</option>
        <option value="front">Front</option>
        <option value="back">Back</option>
        <option value="both">Both</option>
      </select>
    </label>
  )
}
