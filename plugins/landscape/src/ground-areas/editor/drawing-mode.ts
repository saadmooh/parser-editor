import type { ToolHint } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { GROUND_AREA_KIND } from '../domain/schema'
import { sendGroundAreaCommand, type GroundAreaShape } from './session'

export const groundAreaModes: GroundAreaShape[] = ['rectangle', 'custom', 'freehand', 'circle', 'oval']

export function groundAreaDrawingMode(): GroundAreaShape {
  const shape = useEditor.getState().toolDefaults[GROUND_AREA_KIND]?.shape
  if (shape === 'polygon') return 'custom'
  return groundAreaModes.includes(shape as GroundAreaShape) ? shape as GroundAreaShape : 'rectangle'
}

export function setGroundAreaDrawingMode(shape: GroundAreaShape) {
  if (useEditor.getState().tool === GROUND_AREA_KIND) sendGroundAreaCommand({ mode: shape })
  else {
    const editor = useEditor.getState()
    editor.setToolDefaults(GROUND_AREA_KIND, { ...editor.toolDefaults[GROUND_AREA_KIND], shape })
  }
}

export function cycleGroundAreaDrawingMode() {
  const current = groundAreaDrawingMode()
  setGroundAreaDrawingMode(groundAreaModes[(groundAreaModes.indexOf(current) + 1) % groundAreaModes.length]!)
}

export const groundAreaDrawingModeHint: ToolHint = { key: 'T', label: 'Drawing mode', chip: {
  subscribe: (onChange) => useEditor.subscribe((state, previous) => {
    if (state.toolDefaults[GROUND_AREA_KIND]?.shape !== previous.toolDefaults[GROUND_AREA_KIND]?.shape) onChange()
  }),
  value: groundAreaDrawingMode,
  cycle: cycleGroundAreaDrawingMode,
  labels: { rectangle: 'Mode: Rectangle', custom: 'Mode: Custom outline', freehand: 'Mode: Freehand',
    circle: 'Mode: Circle', oval: 'Mode: Oval' },
  icons: { rectangle: 'lucide:square', custom: 'lucide:pentagon', freehand: 'lucide:lasso',
    circle: 'lucide:circle', oval: 'lucide:ellipse' },
  tooltip: 'Drawing mode — click or press T to switch',
} }
