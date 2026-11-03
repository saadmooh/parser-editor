import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three'

export const SPRINKLER_OUTLET_HEIGHT = 0.15

/** Compact pop-up spray head. Local +Z is the start of its watering arc. */
export function createSprinklerModel(accent: string, arc = 360) {
  const model = new Group()
  model.name = 'Pop-up sprinkler'
  const plastic = new MeshStandardMaterial({ color: '#252a2c', roughness: .78 })
  const rubber = new MeshStandardMaterial({ color: '#111719', roughness: .95 })
  const stem = new MeshStandardMaterial({ color: '#737c80', metalness: .65, roughness: .32 })
  const trim = new MeshStandardMaterial({ color: accent, roughness: .5 })
  const add = (name: string, geometry: import('three').BufferGeometry, material: MeshStandardMaterial, y: number) => {
    const mesh = new Mesh(geometry, material)
    mesh.name = name; mesh.position.y = y
    mesh.castShadow = true; mesh.receiveShadow = true
    model.add(mesh)
    return mesh
  }
  add('Tapered housing', new CylinderGeometry(.048, .041, .055, 24), plastic, .0275)
  add('Ground flange', new CylinderGeometry(.06, .06, .012, 32), plastic, .012)
  add('Housing shoulder', new CylinderGeometry(.046, .052, .015, 24), plastic, .059)
  const seal = add('Riser seal', new TorusGeometry(.025, .004, 8, 24), rubber, .068)
  seal.rotation.x = Math.PI / 2
  add('Raised riser', new CylinderGeometry(.021, .021, .07, 24), stem, .102)
  add('Nozzle collar', new CylinderGeometry(.03, .027, .017, 24), plastic, .137)
  add('Nozzle cap', new CylinderGeometry(.033, .033, .018, 32), plastic, .154)
  const ring = add('Zone identification ring', new TorusGeometry(.0295, .0025, 6, 32), trim, .164)
  ring.rotation.x = Math.PI / 2
  add('Adjustment screw', new CylinderGeometry(.005, .005, .002, 12), stem, .165)
  add('Screw slot', new BoxGeometry(.007, .0007, .0014), rubber, .1662)
  // Small radial outlets follow the same sector as the water preview.
  const outlets = Math.max(1, Math.ceil(arc / 45))
  for (let i = 0; i < outlets; i++) {
    const angle = (i + .5) / outlets * arc * Math.PI / 180
    const outlet = add('Spray outlet', new BoxGeometry(.009, .005, .002), rubber, SPRINKLER_OUTLET_HEIGHT)
    outlet.position.x = Math.sin(angle) * .033
    outlet.position.z = Math.cos(angle) * .033
    outlet.rotation.y = angle
  }
  const direction = add('Direction marker', new BoxGeometry(.006, .001, .013), trim, .1645)
  direction.position.z = .018
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * Math.PI * 2
    const rib = add('Housing grip', new BoxGeometry(.004, .027, .003), plastic, .036)
    rib.position.set(Math.sin(angle) * .047, .036, Math.cos(angle) * .047)
    rib.rotation.y = angle
  }
  return model
}
