import type { ToolHint } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import type { DrawnAccessKind } from './items'

export type DrawingMode = 'rectangle' | 'custom' | 'freehand' | 'circle' | 'oval'
export const drawingModes: DrawingMode[] = ['rectangle', 'custom', 'freehand', 'circle', 'oval']

export function drawingMode(kind: DrawnAccessKind): DrawingMode {
  const shape = useEditor.getState().toolDefaults[kind]?.shape
  return drawingModes.includes(shape as DrawingMode) ? shape as DrawingMode : 'rectangle'
}

export function cycleDrawingMode(kind: DrawnAccessKind) {
  const next = drawingModes[(drawingModes.indexOf(drawingMode(kind)) + 1) % drawingModes.length]!
  const editor = useEditor.getState()
  editor.setToolDefaults(kind, { ...editor.toolDefaults[kind], shape: next })
}

export function drawingModeHint(kind: DrawnAccessKind): ToolHint {
  return { key: 'T', label: 'Drawing mode', chip: {
    subscribe: (onChange) => useEditor.subscribe((state, previous) => {
      if (state.toolDefaults[kind]?.shape !== previous.toolDefaults[kind]?.shape) onChange()
    }),
    value: () => drawingMode(kind),
    cycle: () => cycleDrawingMode(kind),
    labels: { rectangle: 'Mode: Rectangle', custom: 'Mode: Custom outline', freehand: 'Mode: Freehand',
      circle: 'Mode: Circle', oval: 'Mode: Oval' },
    icons: { rectangle: 'lucide:square', custom: 'lucide:pentagon', freehand: 'lucide:lasso',
      circle: 'lucide:circle', oval: 'lucide:ellipse' },
    tooltip: 'Drawing mode — click or press T to switch',
  } }
}
