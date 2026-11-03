'use client'
import SurfaceBoundarySystem, { HardscapeConnectionSystem } from '../../shared/boundary-system'
export default function LandingBoundarySystem() {
  return <><HardscapeConnectionSystem /><SurfaceBoundarySystem kind="landscape:landing" /></>
}
