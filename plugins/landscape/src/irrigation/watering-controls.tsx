'use client'
import type { ReactNode } from 'react'

export function WateringSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string; disabled?: boolean }[]; disabled?: boolean }) {
  return <label className="flex min-h-9 items-center gap-2 text-xs font-normal text-muted-foreground">
    <span className="shrink-0">{label}</span>
    <select aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-border/50 bg-secondary px-2 text-xs font-normal text-foreground disabled:opacity-50">
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
  </label>
}
export function WateringDetails({ title, children }: { title: string; children: ReactNode }) {
  return <details className="group rounded-lg border border-border/50 text-xs">
    <summary className="cursor-pointer px-3 py-2 font-medium text-muted-foreground hover:text-foreground">{title}</summary>
    <div className="space-y-2 px-3 pb-3 pt-1">{children}</div>
  </details>
}
