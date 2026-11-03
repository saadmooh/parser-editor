import type { ToolHint } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { PATHWAY_KIND } from '../domain/schema'
import { sendPathwayCommand } from './session'

export const pathwayDrawingModeHint: ToolHint = { key: 'C', label: 'Drawing mode', chip: {
  subscribe: (onChange) => useEditor.subscribe((state, previous) => {
    if (state.toolDefaults[PATHWAY_KIND]?.drawMode !== previous.toolDefaults[PATHWAY_KIND]?.drawMode) onChange()
  }),
  value: () => useEditor.getState().toolDefaults[PATHWAY_KIND]?.drawMode === 'curve' ? 'curve' : 'straight',
  cycle: () => sendPathwayCommand('toggle'),
  labels: { straight: 'Mode: Straight', curve: 'Mode: Smooth curve' },
  icons: { straight: 'lucide:minus', curve: 'lucide:spline' },
  tooltip: 'Drawing mode — click or press C to switch',
} }
