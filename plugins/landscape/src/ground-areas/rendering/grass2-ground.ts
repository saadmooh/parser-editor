import { makeGrassTexture } from './grass'

const bladeGround = makeGrassTexture([71, 101, 45], 4)
const billboardGround = makeGrassTexture([58, 77, 40], 4)

/** Ground and roots must sample the same texture in area-local metre coordinates. */
export function grass2GroundTexture(mode: 'blades' | 'billboards' = 'blades') {
  return mode === 'billboards' ? billboardGround : bladeGround
}
