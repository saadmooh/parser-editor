import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three'
import type { IrrigationSourceNode } from './source'
import type { IrrigationValveNode } from './valve'
import { zoneColor } from './zone-model'

function parts() {
  const group = new Group()
  const black = new MeshStandardMaterial({ color: '#111111', roughness: .65 })
  const brass = new MeshStandardMaterial({ color: '#b49554', metalness: .7, roughness: .35 })
  const steel = new MeshStandardMaterial({ color: '#889397', metalness: .75, roughness: .3 })
  const add = (name: string, geometry: import('three').BufferGeometry, material: MeshStandardMaterial, x: number, y: number, z = 0) => {
    const mesh = new Mesh(geometry, material)
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true
    group.add(mesh); return mesh
  }
  const pipe = (name: string, radius: number, length: number, x: number, y: number, material = black) => {
    const mesh = add(name, new CylinderGeometry(radius, radius, length, 24), material, x, y)
    mesh.rotation.z = Math.PI / 2; return mesh
  }
  return { group, black, brass, steel, add, pipe }
}

export function irrigationSourceGeometry(node: IrrigationSourceNode) {
  const { group, black, brass, steel, add, pipe } = parts()
  group.name = 'Water supply assembly'
  const radius = node.diameter * .0254 / 2
  add('Mounting base', new BoxGeometry(.15, .018, .14), black, -.055, .009)
  add('Supply riser', new CylinderGeometry(radius + .007, radius + .007, .09, 24), brass, -.055, .06)
  pipe('Supply manifold', Math.max(.022, radius + .005), .16, 0, .1, brass)
  pipe('Black outlet pipe', radius, .12, .14, .1)
  pipe('Outlet union', radius + .007, .024, .1, .1, steel)
  const handwheel = add('Supply shutoff wheel', new TorusGeometry(.04, .006, 8, 24), new MeshStandardMaterial({ color: node.enabled ? '#397a60' : '#b45c54', roughness: .6 }), -.045, .155)
  handwheel.rotation.x = Math.PI / 2
  add('Shutoff spindle', new CylinderGeometry(.007, .007, .04, 12), brass, -.045, .135)
  for (let i = 0; i < 3; i++) {
    const spoke = add('Wheel spoke', new BoxGeometry(.07, .005, .006), handwheel.material, -.045, .155)
    spoke.rotation.y = i * Math.PI / 3
  }
  add('Gauge neck', new CylinderGeometry(.008, .008, .035, 12), brass, .045, .135)
  const rim = add('Pressure gauge rim', new CylinderGeometry(.034, .034, .014, 32), steel, .045, .174, .003)
  rim.rotation.x = Math.PI / 2
  const face = add('Pressure gauge face', new CylinderGeometry(.029, .029, .002, 32), new MeshStandardMaterial({ color: '#eee9db', roughness: .8 }), .045, .174, .011)
  face.rotation.x = Math.PI / 2
  const angle = -.75 * Math.PI + Math.min(1, (node.enabled ? node.pressureBar : 0) / 20) * 1.5 * Math.PI
  const needle = add('Pressure needle', new BoxGeometry(.002, .024, .001), new MeshStandardMaterial({ color: '#c94335' }), .045 + Math.sin(angle) * .01, .174 + Math.cos(angle) * .01, .013)
  needle.rotation.z = -angle
  for (let i = 0; i <= 8; i++) {
    const a = -.75 * Math.PI + i / 8 * 1.5 * Math.PI
    const tick = add('Gauge tick', new BoxGeometry(.0015, .005, .001), black, .045 + Math.sin(a) * .024, .174 + Math.cos(a) * .024, .013)
    tick.rotation.z = -a
  }
  return group
}

export function irrigationValveGeometry(node: IrrigationValveNode) {
  const { group, black, brass, steel, add, pipe } = parts()
  group.name = 'Zone valve assembly'
  const radius = node.diameter * .0254 / 2
  pipe('Valve body', Math.max(.034, radius + .01), .13, 0, .06, brass)
  for (const sign of [-1, 1]) {
    pipe(sign < 0 ? 'Black inlet pipe' : 'Black outlet pipe', radius, .085, sign * .1075, .06)
    pipe('Socket union', radius + .008, .026, sign * .077, .06, black)
    pipe('Union collar', radius + .009, .007, sign * .087, .06, steel)
  }
  add('Valve bonnet', new CylinderGeometry(.025, .03, .022, 6), brass, 0, .096)
  add('Handle spindle', new CylinderGeometry(.006, .006, .025, 12), steel, 0, .117)
  const handle = add('Valve handle', new BoxGeometry(.14, .015, .022), new MeshStandardMaterial({ color: node.isOpen ? zoneColor(node.zoneId || node.zone) : '#b45c54', roughness: .55 }), 0, .138)
  handle.rotation.y = node.isOpen ? 0 : Math.PI / 2
  add('Handle fastener', new CylinderGeometry(.008, .008, .005, 6), steel, 0, .148)
  return group
}
