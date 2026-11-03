'use client'
import { useSyncExternalStore } from 'react'
import type { DrawnAccessKind } from './items'
import type { DrawingMode } from './drawing-mode'

type Status = { shape: DrawingMode; points: number; message: string }
const idle: Status = { shape: 'rectangle', points: 0, message: '' }
const statuses = new Map<DrawnAccessKind, Status>()
const listeners = new Set<() => void>()

export function setDrawingStatus(kind: DrawnAccessKind, next: Status) {
  const current = statuses.get(kind)
  if (current?.shape === next.shape && current.points === next.points && current.message === next.message) return
  statuses.set(kind, next)
  listeners.forEach((listener) => listener())
}

export function useDrawingStatus(kind: DrawnAccessKind): Status {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    () => statuses.get(kind) ?? idle,
    () => idle,
  )
}
