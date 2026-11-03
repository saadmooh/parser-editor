'use client'

import { ActionButton } from '@pascal-app/editor'
import { pathwayFinishes, type PathwayNode } from '../domain/schema'
import { finishOptions } from '../rendering/finishes'

export function PathwayFinishControl({ node, onUpdate }: {
  node: PathwayNode
  onUpdate: (patch: Partial<PathwayNode>) => void
}) {
  return <div role="group" aria-label="Paving finish" className="space-y-1 px-3 py-2">
    <div className="text-xs text-foreground/80">Paving finish</div>
    <div className="grid grid-cols-2 gap-1.5">
      {pathwayFinishes.map((finish) => {
        const option = finishOptions[finish]
        const selected = node.finish === finish
        return <ActionButton key={finish} type="button" label={option.label} title={option.description}
          aria-pressed={selected} onClick={() => onUpdate({ finish })}
          icon={<span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm border border-white/10" style={{ background: option.color }} />}
          className={`w-full min-w-0 flex-none justify-start px-2 ${selected ? 'bg-[#3e3e3e] text-foreground ring-1 ring-border/50' : ''}`} />
      })}
    </div>
  </div>
}
