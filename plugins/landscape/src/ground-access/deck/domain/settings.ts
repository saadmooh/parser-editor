import type { DeckNode } from './schema'

export function deckMinimumHeight(node: Pick<DeckNode,
  'boardThickness' | 'frameDepth' | 'deckType' | 'skirtStyle'>) {
  const structure = node.boardThickness + node.frameDepth
  return Math.max(structure + (node.skirtStyle === 'none' ? 0 : 0.1),
    node.deckType === 'raised' ? Math.max(0.6, structure + 0.1) : 0)
}

export function deckBorderWidth(node: DeckNode) {
  if (node.borderStyle === 'none') return 0
  const courses = node.borderStyle === 'double' ? 2 : 1
  return Math.min(node.width / 3, node.depth / 3,
    node.boardWidth * courses + node.boardGap * Math.max(0, courses - 1))
}
