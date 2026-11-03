'use client'
import SurfaceBoundarySystem, { HardscapeConnectionSystem } from '../../shared/boundary-system'
export default function PatioBoundarySystem() {
  return <><HardscapeConnectionSystem /><SurfaceBoundarySystem kind="landscape:patio" /></>
}
