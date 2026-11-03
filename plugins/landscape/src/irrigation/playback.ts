import { useSyncExternalStore } from 'react'
type Playback = { zone: string; deviceIds: readonly string[] } | null
let state: Playback = null
const listeners = new Set<() => void>()
export function setWateringPlayback(next: Playback) { state = next; listeners.forEach(listener => listener()) }
export function getWateringPlayback() { return state }
export function useWateringPlayback() { return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback) } }, getWateringPlayback, () => null) }
export function devicePreviewEnabled(id: string, playback: Playback) { return !playback || playback.deviceIds.includes(id) }
