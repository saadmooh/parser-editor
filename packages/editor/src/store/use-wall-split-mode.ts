// Ephemeral toggle for the wall split-on-overlap mode.
// Pressing O in the wall tool toggles this; the helper panel reads it
// to show whether the mode is active.

import { create } from 'zustand'

type WallSplitModeState = {
  enabled: boolean
  toggle(): void
  set(v: boolean): void
  reset(): void
}

const useWallSplitMode = create<WallSplitModeState>((set) => ({
  enabled: false,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  set: (v) => set({ enabled: v }),
  reset: () => set({ enabled: false }),
}))

export default useWallSplitMode
