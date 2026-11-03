import type { ParametricDescriptor, ParamField } from '@pascal-app/core'
import type { PergolaNode } from '../domain/schema'
import { DEFAULT_ARCH_DROP, DEFAULT_ARCH_RISE, DEFAULT_ROOF_RISE } from '../domain/schema'
import { PostDetailControl } from './post-detail-control'
import { RoofLayoutControl } from './roof-layout-control'
import { pergolaArchMode, pergolaRoofLayout } from '../domain/layout'
import { ArchModeControl } from './arch-mode-control'

const dimension = (
  key: keyof PergolaNode,
  label: string,
  min: number,
  max: number,
  step = 0.01,
): ParamField<PergolaNode> => ({
  key,
  label,
  kind: 'number',
  unit: 'm',
  min,
  max,
  step,
})
export const pergolaParametrics: ParametricDescriptor<PergolaNode> = {
  derive: (next, patch) => ({
    ...(patch.postStyle !== undefined ? { postDetailStyle: 'plain' as const } : {}),
    ...((patch.roofForm === 'gable' || patch.roofForm === 'curved') &&
      next.roofRise === undefined ? { roofRise: DEFAULT_ROOF_RISE } : {}),
    ...(patch.roofForm === 'gable' && next.gableArch === undefined
      ? { gableArch: true } : {}),
    ...(next.roofForm !== 'gable' && patch.gableArchDrop !== undefined &&
      (next.gableArchCurve ?? DEFAULT_ARCH_RISE) > patch.gableArchDrop - 0.04
      ? { gableArchCurve: Math.max(0.05, patch.gableArchDrop - 0.04) }
      : {}),
    ...(next.roofForm !== 'gable' && patch.gableArchCurve !== undefined &&
      (next.gableArchDrop ?? DEFAULT_ARCH_DROP) < patch.gableArchCurve + 0.04
      ? { gableArchDrop: Math.min(0.7, patch.gableArchCurve + 0.04) }
      : {}),
    ...(next.roofForm === 'gable' && patch.gableArchCurve !== undefined &&
      (next.roofRise ?? DEFAULT_ROOF_RISE) < patch.gableArchCurve + 0.06
      ? { roofRise: patch.gableArchCurve + 0.06 }
      : {}),
    ...(next.roofForm === 'gable' && patch.roofRise !== undefined &&
      (next.gableArchCurve ?? DEFAULT_ARCH_RISE) > patch.roofRise - 0.06
      ? { gableArchCurve: Math.max(0.05, patch.roofRise - 0.06) }
      : {}),
  }),
  groups: [
    {
      label: 'Dimensions',
      fields: [
        dimension('width', 'Width', 1.5, 10, 0.1),
        dimension('depth', 'Depth', 1.5, 8, 0.1),
        dimension('height', 'Front height', 1.8, 4, 0.1),
        {
          key: 'roofForm',
          label: 'Roof form',
          kind: 'enum',
          options: ['flat', 'single-slope', 'gable', 'curved'],
        },
        {
          ...dimension('backHeight', 'Back height', 1.8, 4, 0.1),
          visibleIf: (n) => n.roofForm === 'single-slope',
        },
        {
          ...dimension('roofRise', 'Roof rise', 0.2, 1.5, 0.05),
          visibleIf: (n) => n.roofForm === 'gable' || n.roofForm === 'curved',
        },
        dimension('sideOverhang', 'Side overhang', 0, 0.6),
        dimension('endOverhang', 'Front / back overhang', 0, 0.6),
      ],
    },
    {
      label: 'Full-width arch',
      fields: [
        { key: 'archMode', kind: 'custom', component: ArchModeControl },
        {
          key: 'archStyle',
          label: 'Arch style',
          kind: 'enum',
          options: ['segmental', 'rounded', 'pointed'],
          visibleIf: (n) => pergolaArchMode(n) !== 'none',
        },
        {
          ...dimension('gableArchDrop', 'Arch drop', 0.2, 0.7, 0.01),
          visibleIf: (n) => pergolaArchMode(n) !== 'none',
        },
        {
          ...dimension('gableArchCurve', 'Arch rise', 0.05, 0.5, 0.01),
          visibleIf: (n) => pergolaArchMode(n) !== 'none',
        },
        {
          ...dimension('archDepth', 'Arch depth', 0.08, 0.35, 0.01),
          visibleIf: (n) => pergolaArchMode(n) !== 'none',
        },
      ],
    },
    {
      label: 'Structure',
      fields: [
        dimension('postSize', 'Post size', 0.08, 0.3),
        {
          key: 'postBaseStyle',
          label: 'Post base',
          kind: 'enum',
          options: ['none', 'simple-square', 'square-plinth', 'stepped-square', 'round-rings', 'panelled-pedestal'],
        },
        {
          ...dimension('postBaseWidth', 'Base width', 0.12, 0.6),
          visibleIf: (n) => n.postBaseStyle !== 'none',
        },
        {
          ...dimension('postBaseHeight', 'Base height', 0.04, 0.4),
          visibleIf: (n) => n.postBaseStyle !== 'none',
        },
        {
          key: 'postStyle',
          label: 'Post profile',
          kind: 'enum',
          options: ['square', 'chamfered', 'round', 'tapered'],
        },
        {
          key: 'postShaftProfile',
          label: 'Shaft shape',
          kind: 'enum',
          options: ['straight', 'bulged', 'hourglass'],
          visibleIf: (n) => n.postStyle === 'round' || n.postStyle === 'tapered',
        },
        {
          key: 'postTaper',
          label: 'Taper strength',
          kind: 'number',
          min: 0.05,
          max: 0.45,
          step: 0.01,
          visibleIf: (n) => n.postStyle === 'tapered',
        },
        {
          key: 'postBulge',
          label: 'Shaft curve',
          kind: 'number',
          min: 0.02,
          max: 0.3,
          step: 0.01,
          visibleIf: (n) =>
            (n.postStyle === 'round' || n.postStyle === 'tapered') &&
            n.postShaftProfile !== 'straight',
        },
        {
          key: 'postDetailStyle',
          kind: 'custom',
          component: PostDetailControl,
        },
        dimension('leftPostInset', 'Left post inset', 0, 0.4),
        dimension('rightPostInset', 'Right post inset', 0, 0.4),
        dimension('frontPostInset', 'Front post inset', 0, 0.4),
        dimension('backPostInset', 'Back post inset', 0, 0.4),
        dimension('beamWidth', 'Beam width', 0.08, 0.3),
        dimension('beamHeight', 'Beam height', 0.12, 0.4),
        { key: 'braces', label: 'Knee braces', kind: 'boolean' },
        { key: 'braceStyle', label: 'Brace style', kind: 'enum', options: ['diagonal', 'arched', 'swept', 'curved-bracket'], visibleIf: (n) => n.braces },
        { ...dimension('braceCurve', 'Bracket curve', 0.15, 0.85, 0.05), visibleIf: (n) => n.braces && n.braceStyle === 'curved-bracket' },
        { ...dimension('braceThickness', 'Brace thickness', 0.04, 0.16), visibleIf: (n) => n.braces },
        { ...dimension('braceReach', 'Reach along beam', 0.25, 0.9), visibleIf: (n) => n.braces },
        { ...dimension('braceDrop', 'Drop down post', 0.2, 0.9), visibleIf: (n) => n.braces },
      ],
    },
    {
      label: 'Side screens',
      fields: [
        { key: 'sideScreens', label: 'Sides', kind: 'enum', options: ['none', 'left', 'right', 'both'] },
        { key: 'screenStyle', label: 'Screen style', kind: 'enum', options: ['horizontal-slats', 'vertical-slats', 'solid'], visibleIf: (n) => n.sideScreens !== 'none' },
        { ...dimension('screenHeight', 'Screen height', 0.5, 2.5, 0.05), visibleIf: (n) => n.sideScreens !== 'none' },
        { ...dimension('screenSlatWidth', 'Slat width', 0.04, 0.2), visibleIf: (n) => n.sideScreens !== 'none' && n.screenStyle !== 'solid' },
        { ...dimension('screenSlatGap', 'Slat gap', 0.02, 0.2), visibleIf: (n) => n.sideScreens !== 'none' && n.screenStyle !== 'solid' },
      ],
    },
    {
      label: 'Roof members',
      fields: [
        {
          key: 'roofLayout',
          kind: 'custom',
          component: RoofLayoutControl,
        },
        dimension('rafterWidth', 'Rafter width', 0.04, 0.12, 0.005),
        dimension('rafterHeight', 'Rafter height', 0.08, 0.25),
        dimension('rafterSpacing', 'Rafter spacing', 0.2, 0.8),
        { key: 'memberEndStyle', label: 'Member ends', kind: 'enum', options: ['square', 'beveled', 'curved'] },
        { ...dimension('memberEndCut', 'End cut depth', 0.01, 0.12), visibleIf: (n) => n.memberEndStyle !== 'square' },
        {
          ...dimension('slatSpacing', 'Slat spacing', 0.1, 0.4),
          visibleIf: (n) => pergolaRoofLayout(n) === 'slatted',
        },
        { ...dimension('slatWidth', 'Slat width', 0.03, 0.12), visibleIf: (n) => pergolaRoofLayout(n) === 'slatted' },
        { ...dimension('slatHeight', 'Slat height', 0.025, 0.12), visibleIf: (n) => pergolaRoofLayout(n) === 'slatted' },
        { ...dimension('gridCrossSpacing', 'Cross spacing', 0.2, 1.2), visibleIf: (n) => pergolaRoofLayout(n) === 'grid' },
        { ...dimension('gridCrossWidth', 'Cross width', 0.04, 0.2), visibleIf: (n) => pergolaRoofLayout(n) === 'grid' },
        { ...dimension('gridCrossHeight', 'Cross height', 0.04, 0.2), visibleIf: (n) => pergolaRoofLayout(n) === 'grid' },
        {
          key: 'gridTopLayer',
          label: 'Top layer',
          kind: 'enum',
          options: ['cross', 'rafters'],
          visibleIf: (n) => pergolaRoofLayout(n) === 'grid',
        },
      ],
    },
  ],
}
