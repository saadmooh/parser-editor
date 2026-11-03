import type { NodeDefinition } from '@pascal-app/core'
import { EdgingNode, EDGING_KIND } from './domain/schema'
import { buildEdgingGeometry, buildEdgingFloorplan } from './rendering/geometry'
import { edgingPaint } from './editor/paint'
import { edgingFloorplanAffordances } from './editor/floorplan-affordances'
import { useEditor } from '@pascal-app/editor'

const drawingModes = ['straight', 'curve', 'freehand'] as const
function cycleEdgingMode() {
  const editor = useEditor.getState()
  const current = editor.toolDefaults[EDGING_KIND]?.drawMode
  const next = drawingModes[(drawingModes.indexOf(current as typeof drawingModes[number]) + 1) % drawingModes.length]!
  editor.setToolDefaults(EDGING_KIND, { ...editor.toolDefaults[EDGING_KIND], drawMode: next })
}

export const edgingDefinition: NodeDefinition<typeof EdgingNode> = {
  kind: EDGING_KIND,
  schemaVersion: 1,
  schema: EdgingNode,
  category: 'site',
  snapProfile: 'item',
  surfaceRole: 'furnishing',
  defaults: () => {
    const { id: _id, type: _type, ...defaults } = EdgingNode.parse({})
    return defaults
  },
  capabilities: {
    selectable: { hitVolume: 'mesh' },
    paint: edgingPaint,
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    duplicable: true,
    deletable: true,
  },
  geometry: buildEdgingGeometry,
  system: { module: () => import('./editor/route-system') },
  floorplan: buildEdgingFloorplan,
  floorplanAffordances: edgingFloorplanAffordances,
  tool: () => import('./editor/tool'),
  preview: () => import('./rendering/preview'),
  parametrics: { groups: [{ label: 'Edging', fields: [
    { key: 'form', label: 'Shape', kind: 'enum', options: ['strip', 'pavers', 'stone', 'square-posts', 'round-posts', 'capped-wall'], display: 'segmented' },
    { key: 'depth', label: 'Border width', kind: 'number', unit: 'm', min: 0.2, max: 3, step: 0.05 },
    { key: 'thickness', label: 'Height', kind: 'number', unit: 'm', min: 0.03, max: 2, step: 0.01 },
  ] }] },
  toolHints: [{ key: 'C', label: 'Drawing mode', chip: {
    subscribe: (onChange) => useEditor.subscribe((state, previous) => {
      if (state.toolDefaults[EDGING_KIND]?.drawMode !== previous.toolDefaults[EDGING_KIND]?.drawMode) onChange()
    }),
    value: () => (useEditor.getState().toolDefaults[EDGING_KIND]?.drawMode as string | undefined) ?? 'straight',
    cycle: cycleEdgingMode,
    labels: { straight: 'Mode: Straight', curve: 'Mode: Smooth curve', freehand: 'Mode: Freehand' },
    icons: { straight: 'lucide:minus', curve: 'lucide:spline', freehand: 'lucide:lasso' },
    tooltip: 'Drawing mode — click or press C to switch',
  } }, { key: 'Click / drag', label: 'Place points or draw freehand' }, { key: 'Enter / Double-click', label: 'Finish run' },
    { key: 'Backspace', label: 'Undo point' }, { key: 'Esc', label: 'Cancel run' }],
  presentation: { label: 'Edging', description: 'Draw strips, pavers, stones, posts, or capped borders with straight, curved, or freehand paths; finish them with Paint.', icon: { kind: 'iconify', name: 'lucide:minus' }, paletteSection: 'site', hidden: true },
  mcp: { description: 'Editable straight, smooth curved, or freehand landscape edging in strip, paver, stone, square-post, round-post, or capped-wall forms, with paintable body and cap.' },
}
