'use client'
import SurfaceBoundarySystem, { HardscapeConnectionSystem } from '../../shared/boundary-system'
export default function ConcreteSlabBoundarySystem() {
  return <><HardscapeConnectionSystem /><SurfaceBoundarySystem kind="landscape:concrete-slab" /></>
}
