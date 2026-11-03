'use client'
import { ActionButton } from '@pascal-app/editor'
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function ReviewDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog ref={dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      // The host's canvas shortcuts prevent native Escape cancellation. Keep
      // modal input local, and explicitly close before it reaches the canvas.
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }}
    className="m-auto max-h-[85dvh] w-[min(960px,calc(100vw-32px))] max-w-none overflow-y-auto rounded-xl border border-border/50 bg-sidebar p-4 text-foreground shadow-2xl backdrop:bg-black/40"
    onWheelCapture={event => event.stopPropagation()}>
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
      <h2 id={titleId} className="text-sm font-semibold">Landscape quantities and materials</h2>
      <div className="flex shrink-0"><ActionButton label="Close review" onClick={onClose} /></div>
    </div>
    {children}
  </dialog>
}
