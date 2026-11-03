'use client'
import SurfaceBoundarySystem, { HardscapeConnectionSystem } from '../../shared/boundary-system'
export default function DeckBoundarySystem() {
  return <><HardscapeConnectionSystem /><SurfaceBoundarySystem kind="landscape:deck" /></>
}
