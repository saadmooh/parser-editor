import type { PondNode } from './schema'

export const pondBedSurfaces = [
  { value: 'silt', label: 'Earth & silt' },
  { value: 'sand', label: 'Sand' },
  { value: 'gravel', label: 'Fine gravel' },
  { value: 'river-stone', label: 'River stones' },
  { value: 'algae', label: 'Algae-covered stone' },
] as const satisfies readonly { value: PondNode['bedSurface']; label: string }[]

export const pondBedSurfaceIndex = (surface: PondNode['bedSurface']) =>
  pondBedSurfaces.findIndex(option => option.value === surface)
