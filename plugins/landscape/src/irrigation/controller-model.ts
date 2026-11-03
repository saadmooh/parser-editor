import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, TorusGeometry } from 'three'
import type { IrrigationControllerNode } from './controller'

/** Outdoor control cabinet on a short mounting post. All coordinates are local. */
export function irrigationControllerGeometry(node: IrrigationControllerNode) {
  const group = new Group()
  const shell = new MeshStandardMaterial({ color: '#dddcd3', roughness: .65 })
  const dark = new MeshStandardMaterial({ color: '#272d31', roughness: .75 })
  const metal = new MeshStandardMaterial({ color: '#737b80', metalness: .7, roughness: .4 })
  const green = new MeshStandardMaterial({ color: node.enabled ? '#a6c9a1' : '#52605a', roughness: .45 })
  const ink = new MeshStandardMaterial({ color: '#263a2c', roughness: .7 })
  const add = (name: string, geometry: Mesh['geometry'], material: MeshStandardMaterial, x: number, y: number, z: number) => {
    const mesh = new Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh
  }
  const box = (name: string, w: number, h: number, d: number, material: MeshStandardMaterial, x: number, y: number, z: number) => add(name, new BoxGeometry(w, h, d), material, x, y, z)
  const circle = (name: string, radius: number, depth: number, material: MeshStandardMaterial, x: number, y: number, z: number) => {
    const mesh = add(name, new CylinderGeometry(radius, radius, depth, 24), material, x, y, z); mesh.rotation.x = Math.PI / 2; return mesh
  }
  box('Mounting foot', .24, .025, .20, metal, 0, .0125, -.025)
  box('Mounting post', .065, .61, .055, metal, 0, .33, -.05)
  const shape = new Shape(), w = .36, h = .40, r = .025
  shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  add('Weatherproof enclosure', new ExtrudeGeometry(shape, { depth: .13, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 3, steps: 1, curveSegments: 8 }), shell, 0, .79, -.065)
  box('Door gasket', .325, .363, .007, dark, 0, .79, .069)
  box('Recessed control panel', .31, .349, .009, shell, 0, .79, .075)
  box('Display bezel', .206, .078, .012, dark, -.019, .899, .086)
  box('LCD display', .185, .058, .003, green, -.019, .899, .094)
  const digits: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abfgcd' }
  const time = node.startTime.replace(':', '')
  if (node.enabled) time.split('').forEach((digit, index) => {
    const x = -.089 + index * .041, y = .899
    for (const segment of digits[digit] || '') {
      const horizontal = ['a', 'g', 'd'].includes(segment)
      const dx = ['b', 'c'].includes(segment) ? .011 : ['f', 'e'].includes(segment) ? -.011 : 0
      const dy = segment === 'a' ? .021 : segment === 'd' ? -.021 : ['b', 'f'].includes(segment) ? .0105 : ['c', 'e'].includes(segment) ? -.0105 : 0
      box(`Time digit ${index} segment ${segment}`, horizontal ? .02 : .003, horizontal ? .003 : .016, .001, ink, x + dx, y + dy, .096)
    }
  })
  if (node.enabled) for (const y of [.891, .907]) circle('Time separator', .0018, .001, ink, -.0275, y, .096)
  circle('Program dial ring', .054, .009, dark, -.033, .788, .088)
  circle('Program dial', .046, .017, shell, -.033, .788, .102)
  box('Dial pointer', .005, .025, .003, dark, -.033, .812, .113)
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; circle(`Dial setting ${i + 1}`, .0025, .002, dark, -.033 + Math.sin(angle) * .061, .788 + Math.cos(angle) * .061, .087) }
  for (const [index, y] of [.814, .775, .736].entries()) {
    box(`Programming button ${index + 1}`, .042, .024, .012, dark, .10, y, .091)
    box(`Button mark ${index + 1}`, .014, .002, .001, shell, .10, y, .098)
    if (index === 0) box('Plus button mark', .002, .014, .001, shell, .10, y, .098)
  }
  box('Station strip', .27, .042, .006, dark, 0, .665, .084)
  node.stations.forEach((station, i) => {
    const active = node.enabled && station.enabled && !!station.valveId && station.runMinutes > 0 && node.wateringDays.length > 0
    const light = new MeshStandardMaterial({ color: active ? '#6fb580' : '#586064', emissive: active ? '#25482e' : '#000000', emissiveIntensity: .3, roughness: .45 })
    circle(`Station ${i + 1} indicator`, .006, .003, light, -.112 + i * .032, .665, .089)
  })
  for (const y of [.68, .89]) box('Door hinge', .012, .035, .018, metal, -.185, y, .025)
  circle('Door lock', .009, .008, metal, .173, .79, .075)
  box('Lock key slot', .0015, .009, .002, dark, .173, .79, .081)
  box('Lower cable cover', .285, .031, .015, shell, 0, .619, .085)
  for (const x of [-.08, .08]) {
    add('Cable gland', new CylinderGeometry(.016, .016, .027, 12), dark, x, .578, 0)
    add('Cable conduit', new CylinderGeometry(.009, .009, .26, 12), dark, x, .435, 0)
    const collar = add('Conduit collar', new TorusGeometry(.010, .002, 6, 16), dark, x, .55, 0); collar.rotation.x = Math.PI / 2
  }
  return group
}
