import type { PergolaNode } from './schema'

export const POST_DETAIL_OPTIONS = {
  square: [
    { value: 'plain', label: 'Plain' },
    { value: 'twin-bands', label: 'Twin bands' },
    { value: 'stepped-cap', label: 'Stepped cap' },
  ],
  chamfered: [
    { value: 'plain', label: 'Plain' },
    { value: 'crown', label: 'Crown' },
    { value: 'twin-bands', label: 'Twin bands' },
  ],
  round: [
    { value: 'plain', label: 'Plain' },
    { value: 'ringed', label: 'Ringed' },
    { value: 'crown', label: 'Crown' },
  ],
  tapered: [
    { value: 'plain', label: 'Plain' },
    { value: 'stepped-cap', label: 'Stepped cap' },
    { value: 'twin-bands', label: 'Twin bands' },
  ],
} as const satisfies Record<
  PergolaNode['postStyle'],
  ReadonlyArray<{ value: PergolaNode['postDetailStyle']; label: string }>
>

export function validPostDetailStyle(
  node: PergolaNode,
): PergolaNode['postDetailStyle'] {
  const style = node.postStyle ?? 'square'
  const choice = node.postDetailStyle ?? 'plain'
  return POST_DETAIL_OPTIONS[style].some((option) => option.value === choice)
    ? choice
    : 'plain'
}
