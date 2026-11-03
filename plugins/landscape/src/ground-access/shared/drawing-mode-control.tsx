'use client'

import { ActionButton } from '@pascal-app/editor'
import type { DrawingMode } from './drawing-mode'

const options: { label: string; value: DrawingMode }[] = [
  { label: 'Rectangle', value: 'rectangle' },
  { label: 'Custom', value: 'custom' },
  { label: 'Freehand', value: 'freehand' },
  { label: 'Circle', value: 'circle' },
  { label: 'Oval', value: 'oval' },
]

export function DrawingModeControl({ value, onChange }: {
  value: DrawingMode
  onChange: (value: DrawingMode) => void
}) {
  return <div className="grid grid-cols-2 gap-1.5" aria-label="Drawing mode" role="group">
    {options.map((option) => <ActionButton
      key={option.value}
      type="button"
      label={option.label}
      aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}
      className={`w-full flex-none justify-start ${value === option.value ? 'bg-[#3e3e3e] text-foreground ring-1 ring-border/50' : ''}`}
    />)}
  </div>
}
