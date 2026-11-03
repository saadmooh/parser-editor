import type { ParametricDescriptor } from '@pascal-app/core'
import { deckMinimumHeight } from '../domain/settings'
import type { DeckNode } from '../domain/schema'
import { circleDerivedSize } from '../../shared/outline'

export const deckParametrics: ParametricDescriptor<DeckNode> = {
  customPanel: () => import('./inspector'),
  derive: (next, patch, previous) => {
    const before = previous ?? next
    const switched = patch.deckType && patch.deckType !== before.deckType
    const minHeight = deckMinimumHeight(next)
    const desiredHeight = switched
      ? patch.deckType === 'raised' ? Math.max(before.thickness, 1.2)
        : Math.min(before.thickness, 0.45)
      : next.thickness
    return {
      ...circleDerivedSize(next, patch),
      ...(switched ? { supportPosts: patch.deckType === 'raised' } : {}),
      ...(switched || desiredHeight < minHeight ? { thickness: Math.max(desiredHeight, minHeight) } : {}),
    }
  },
  groups: [
    { label: 'Deck size and type', fields: [
      { key: 'width', label: 'Width', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
      { key: 'depth', label: 'Depth', kind: 'number', unit: 'm', min: 0.2, max: 30, step: 0.1 },
      { key: 'deckType', label: 'Type', kind: 'enum', options: ['platform', 'raised'] },
      { key: 'thickness', label: 'Deck height', kind: 'number', unit: 'm', min: 0.03, max: 2, step: 0.01 },
    ] },
    { label: 'Deck boards', fields: [
      { key: 'boardDirection', label: 'Direction', kind: 'enum',
        options: ['lengthwise', 'crosswise', 'diagonal'] },
      { key: 'boardWidth', label: 'Board width', kind: 'number', unit: 'm', min: 0.09, max: 0.25, step: 0.005 },
      { key: 'boardGap', label: 'Board gap', kind: 'number', unit: 'm', min: 0.003, max: 0.025, step: 0.001 },
      { key: 'boardThickness', label: 'Board thickness', kind: 'number', unit: 'm', min: 0.018, max: 0.06, step: 0.002 },
    ] },
    { label: 'Perimeter finish', fields: [
      { key: 'borderStyle', label: 'Picture frame', kind: 'enum', options: ['none', 'single', 'double'] },
      { key: 'fascia', label: 'Fascia', kind: 'boolean' },
      { key: 'skirtStyle', label: 'Skirting', kind: 'enum', options: ['none', 'solid', 'slatted'] },
    ] },
    { label: 'Frame and posts', fields: [
      { key: 'frameDepth', label: 'Frame depth', kind: 'number', unit: 'm', min: 0.08, max: 0.4, step: 0.01 },
      { key: 'supportPosts', label: 'Individual support posts (off: solid base)', kind: 'boolean',
        visibleIf: (node) => node.deckType === 'raised' },
      { key: 'supportSpacing', label: 'Support spacing', kind: 'number', unit: 'm', min: 0.8, max: 4, step: 0.1,
        visibleIf: (node) => node.deckType === 'raised' && node.supportPosts },
      { key: 'postSize', label: 'Post width', kind: 'number', unit: 'm', min: 0.07, max: 0.25, step: 0.01,
        visibleIf: (node) => node.deckType === 'raised' && node.supportPosts },
    ] },
  ],
}
