'use client'
import { useScene } from '@pascal-app/core'
import { MetricControl, ToggleControl, useLinearDisplay } from '@pascal-app/editor'
import type { ComponentProps, ReactNode } from 'react'

function ReadOnlyProperty({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <output aria-label={typeof label === 'string' ? label : undefined} className="shrink-0 font-mono tabular-nums text-foreground">{children}</output>
  </div>
}

/** The host controls lack disabled props. Do not mount edit handlers in read-only scenes. */
export function SceneMetricControl(props: ComponentProps<typeof MetricControl>) {
  const readOnly = useScene(state => state.readOnly)
  const display = useLinearDisplay(props.unit ?? '', props.precision ?? 2, props.step ?? 1)
  if (!readOnly) return <MetricControl {...props} />
  return <ReadOnlyProperty label={props.label}>{display.toDisplay(props.value).toFixed(display.precision)}{display.displayUnit}</ReadOnlyProperty>
}

export function SceneToggleControl(props: ComponentProps<typeof ToggleControl>) {
  const readOnly = useScene(state => state.readOnly)
  if (!readOnly) return <ToggleControl {...props} />
  return <ReadOnlyProperty label={props.label}>{props.mixed ? 'Mixed' : props.checked ? 'On' : 'Off'}</ReadOnlyProperty>
}
