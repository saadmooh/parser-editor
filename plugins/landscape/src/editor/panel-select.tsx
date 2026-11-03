'use client'

import { useId, type SelectHTMLAttributes } from 'react'

export function PanelSelect({ label, id, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  return <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={controlId} className="px-1 text-xs text-muted-foreground">{label}</label>
    <select {...props} id={controlId} className={`h-9 w-full min-w-0 rounded-lg border border-border/50 bg-[#2C2C2E] px-2 text-sm text-foreground outline-none transition-colors hover:bg-[#3e3e3e] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`} />
  </div>
}
