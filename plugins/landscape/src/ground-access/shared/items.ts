import { PondNode } from '../../pond/schema'
import { PatioNode } from '../patio/domain/schema'
import { DeckNode } from '../deck/domain/schema'
import { ConcreteSlabNode } from '../concrete-slab/domain/schema'
import { LandingNode } from '../landing/domain/schema'
import { EdgingNode } from '../edging/domain/schema'
import { RetainingWallNode } from '../retaining-wall/domain/schema'

export const accessItems = [
  { kind: 'patio', label: 'Patio', schema: PatioNode, color: '#b8aa93' },
  { kind: 'deck', label: 'Deck', schema: DeckNode, color: '#a4774e' },
  { kind: 'concrete-slab', label: 'Concrete slab', schema: ConcreteSlabNode, color: '#aaa9a2' },
  { kind: 'landing', label: 'Landing', schema: LandingNode, color: '#b9ab96' },
  { kind: 'edging', label: 'Edging', schema: EdgingNode, color: '#918575' },
  { kind: 'retaining-wall', label: 'Retaining wall', schema: RetainingWallNode, color: '#9d9387' },
] as const

export type AccessItem = (typeof accessItems)[number]
export const accessItemFor = (kind: string) => accessItems.find((item) => `landscape:${item.kind}` === kind)

export const DRAWN_ACCESS_KINDS = ['landscape:patio', 'landscape:deck',
  'landscape:concrete-slab', 'landscape:landing', 'landscape:pond'] as const
export type DrawnAccessKind = (typeof DRAWN_ACCESS_KINDS)[number]
const pondItem = { kind: 'pond', label: 'Pond', schema: PondNode, color: '#328e92' } as const
export type DrawnAccessItem = Extract<AccessItem, { kind: 'patio' | 'deck' | 'concrete-slab' | 'landing' }> | typeof pondItem
export const isDrawnAccessKind = (kind: string): kind is DrawnAccessKind =>
  (DRAWN_ACCESS_KINDS as readonly string[]).includes(kind)
export const drawnAccessItemFor = (kind: string): DrawnAccessItem | undefined =>
  kind === 'landscape:pond' ? pondItem : isDrawnAccessKind(kind) ? accessItemFor(kind) as DrawnAccessItem | undefined : undefined
