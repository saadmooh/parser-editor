export type PondWaterQuality = 'high' | 'medium'

/** Screen footprint with hysteresis; temporary editing uses Pool's medium branch. */
export function pondWaterQuality(current:PondWaterQuality,radiusPixels:number,dragging:boolean):PondWaterQuality {
  if(dragging)return 'medium'
  if(current==='high')return radiusPixels<140?'medium':'high'
  return radiusPixels>200?'high':'medium'
}
