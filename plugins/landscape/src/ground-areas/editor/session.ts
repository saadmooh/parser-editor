'use client'
import { useSyncExternalStore } from 'react'

export type GroundAreaShape = 'rectangle' | 'custom' | 'freehand' | 'circle' | 'oval'
export type GroundAreaCommand = 'finish' | 'back' | 'cancel' | 'cycle' | { mode: GroundAreaShape }
type Status = { points: number; shape: GroundAreaShape; message: string }
const idle: Status = { points: 0, shape: 'rectangle', message: '' }
let status = idle
const listeners = new Set<() => void>()
const commands = new Set<(command: GroundAreaCommand) => void>()

export function setGroundAreaStatus(next: Status) {
  if (next.points === status.points && next.shape === status.shape && next.message === status.message) return
  status = next
  listeners.forEach((listener) => listener())
}
export function sendGroundAreaCommand(command: GroundAreaCommand) {
  commands.forEach((listener) => listener(command))
}
export function onGroundAreaCommand(listener: (command: GroundAreaCommand) => void) {
  commands.add(listener)
  return () => commands.delete(listener)
}
export function useGroundAreaStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => status,
    () => idle,
  )
}
