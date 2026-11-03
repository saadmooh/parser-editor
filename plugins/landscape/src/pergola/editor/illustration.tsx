import type { PergolaNode } from '../domain/schema'
import flatThumbnail from '../../assets/catalog/pergola-flat-transparent-thumbnail.webp'
import singleSlopeThumbnail from '../../assets/catalog/pergola-single-slope-transparent-thumbnail.webp'
import gableThumbnail from '../../assets/catalog/pergola-gable-transparent-thumbnail.webp'
import curvedThumbnail from '../../assets/catalog/pergola-curved-transparent-thumbnail.webp'

const thumbnails: Record<PergolaNode['roofForm'], { src: string }> = {
  flat: flatThumbnail,
  'single-slope': singleSlopeThumbnail,
  gable: gableThumbnail,
  curved: curvedThumbnail,
}

export function PergolaIllustration({ roofForm = 'flat' }: { roofForm?: PergolaNode['roofForm'] }) {
  return (
    <img
      src={thumbnails[roofForm].src}
      alt={`${roofForm.replace('-', ' ')} roof pergola`}
      draggable={false}
      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
    />
  )
}
