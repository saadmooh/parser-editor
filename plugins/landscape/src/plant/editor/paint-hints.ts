import type { ToolHint } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { TREE_KIND } from '../../tree/domain/schema'
import { PLANT_KIND } from '../domain/schema'

function visible(kind: string, mode: 'point' | 'brush' | 'erase'): NonNullable<ToolHint['visible']> {
  return {
    subscribe: (onChange) => useEditor.subscribe((state, previous) => {
      if (state.toolDefaults[kind]?.landscapePaintMode !== previous.toolDefaults[kind]?.landscapePaintMode) onChange()
    }),
    value: () => {
      const value = useEditor.getState().toolDefaults[kind]?.landscapePaintMode
      return mode === 'point' ? value !== 'brush' && value !== 'erase' : value === mode
    },
  }
}

function paintHints(kind: string, noun: string): ToolHint[] { return [
  { key: 'Left click', label: `Place ${noun}`, visible: visible(kind, 'point') },
  { key: 'Drag', label: 'Paint a spaced planting row; release to apply', visible: visible(kind, 'brush') },
  { key: 'Drag', label: `Erase ${noun}s within the radius; release to apply`, visible: visible(kind, 'erase') },
  { key: 'Esc', label: 'Cancel stroke and finish placement' },
] }

export const plantPaintHints = paintHints(PLANT_KIND, 'plant')
export const treePaintHints = paintHints(TREE_KIND, 'tree')
