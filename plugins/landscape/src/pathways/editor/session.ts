'use client'
import { useSyncExternalStore } from 'react'

type Command = 'finish' | 'back' | 'cancel' | 'toggle'
export type PathwayMode = 'straight' | 'curve'
type Status = { points: number; mode: PathwayMode; snap: boolean; message: string }
const idle: Status = { points: 0, mode: 'straight', snap: false, message: '' }
let status = idle
const listeners = new Set<() => void>()
const commands = new Set<(command: Command) => void>()
export function setPathwayStatus(next: Status) {
  if (
    next.points === status.points &&
    next.mode === status.mode &&
    next.snap === status.snap &&
    next.message === status.message
  )
    return
  status = next
  listeners.forEach((listener) => listener())
}
export function sendPathwayCommand(command: Command) {
  commands.forEach((listener) => listener(command))
}
export function onPathwayCommand(listener: (command: Command) => void) {
  commands.add(listener)
  return () => {
    commands.delete(listener)
  }
}
export function usePathwayStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => status,
    () => idle,
  )
}
