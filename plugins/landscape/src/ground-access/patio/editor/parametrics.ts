import type { ParametricDescriptor } from '@pascal-app/core'
import type { PatioNode } from '../domain/schema'
import { finishColor } from '../rendering/geometry'
import { circleDerivedSize } from '../../shared/outline'

export const patioParametrics: ParametricDescriptor<PatioNode> = {
  customPanel: () => import('./inspector'),
  derive: (next, patch) => ({
    ...circleDerivedSize(next, patch),
    ...(patch.finish && patch.fieldColor === undefined &&
      next.fieldColor === finishColor[next.finish]
      ? { fieldColor: finishColor[patch.finish] } : {}),
  }),
  groups: [
    { label: 'Size and level', fields: [
      { key: 'width', label: 'Width', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
      { key: 'depth', label: 'Depth', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
      { key: 'thickness', label: 'Base thickness', kind: 'number', unit: 'm', min: 0.03, max: 2, step: 0.01 },
      { key: 'elevation', label: 'Base elevation', kind: 'number', unit: 'm', min: -2, max: 2, step: 0.01 },
      { key: 'slopePercent', label: 'Drainage slope (%)', kind: 'number', min: 0, max: 5, step: 0.25 },
      { key: 'drainDirection', label: 'Drain toward', kind: 'enum', options: ['front', 'back', 'left', 'right'],
        visibleIf: (node) => node.slopePercent > 0 },
    ] },
    { label: 'Paving', fields: [
      { key: 'finish', label: 'Material', kind: 'enum', options: ['concrete', 'stone', 'brick'] },
      { key: 'pattern', label: 'Pattern', kind: 'enum', options: ['grid', 'running-bond'] },
      { key: 'paverWidth', label: 'Paver width', kind: 'number', unit: 'm', min: 0.2, max: 2, step: 0.05 },
      { key: 'paverDepth', label: 'Paver depth', kind: 'number', unit: 'm', min: 0.2, max: 2, step: 0.05 },
      { key: 'jointWidth', label: 'Joint width', kind: 'number', unit: 'm', min: 0.003, max: 0.04, step: 0.001 },
      { key: 'fieldColor', label: 'Paver color', kind: 'color' },
    ] },
    { label: 'Border', fields: [
      { key: 'borderStyle', label: 'Border', kind: 'enum', options: ['none', 'contrast'] },
      { key: 'borderWidth', label: 'Border width', kind: 'number', unit: 'm', min: 0.08, max: 0.6, step: 0.01,
        visibleIf: (node) => node.borderStyle !== 'none' },
      { key: 'borderColor', label: 'Border color', kind: 'color', visibleIf: (node) => node.borderStyle !== 'none' },
    ] },
  ],
}
