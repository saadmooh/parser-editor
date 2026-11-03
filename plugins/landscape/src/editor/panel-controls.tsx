'use client'
import { ActionButton as SharedActionButton, ActionGroup as SharedActionGroup, PanelSection as SharedPanelSection } from '@pascal-app/editor'
import type { ComponentProps } from 'react'

/** Sidebar actions keep their padding when labels wrap or panels narrow. */
export function ActionButton({ className = '', ...props }: ComponentProps<typeof SharedActionButton>) {
  return <SharedActionButton {...props} className={`h-auto min-h-10 min-w-0 w-full flex-none gap-2 px-3 py-2 whitespace-normal leading-5 [&>span]:min-w-0 [&>span]:break-words ${className}`} />
}
export function ActionGroup({ className = '', ...props }: ComponentProps<typeof SharedActionGroup>) {
  return <SharedActionGroup {...props} className={`grid grid-cols-2 items-stretch gap-2 ${className}`} />
}
export function PanelSection({ className = '', ...props }: ComponentProps<typeof SharedPanelSection>) {
  return <SharedPanelSection {...props} className={`[&>div>div]:gap-3 ${className}`} />
}
