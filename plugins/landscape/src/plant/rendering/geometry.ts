import { ConeGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh,
  MeshStandardMaterial, Object3D, PlaneGeometry, SphereGeometry } from 'three'
import type { PlantNode } from '../domain/schema'
import { PLANT_PRESET_BY_KEY } from '../domain/catalog'
import { mergePlantParts } from './merge-parts'

const unit = new Object3D()
const brown = '#66513c'

function random(seed: number) {
  let value = (seed || 1) >>> 0
  return () => ((value = (1664525 * value + 1013904223) >>> 0) / 4294967296)
}

export function buildPlantGeometry(node: PlantNode) {
  const preset = PLANT_PRESET_BY_KEY[node.preset]
  const root = new Group()
  if (!preset) return root
  const rand = random(node.seed + [...node.preset].reduce((sum, char) => sum + char.charCodeAt(0), 0))
  const height = preset.height
  const spread = preset.spread
  const variation = node.variation
  const foliage = node.tint ?? preset.foliage
  const leafMaterial = new MeshStandardMaterial({ color: foliage, roughness: 0.92, side: DoubleSide })
  const woodMaterial = new MeshStandardMaterial({ color: brown, roughness: 1 })
  const accentMaterial = new MeshStandardMaterial({ color: preset.accent ?? foliage, roughness: 0.9, side: DoubleSide })
  const stem = (x: number, y: number, z: number, h: number, radius: number, material = woodMaterial) => {
    const mesh = new Mesh(new CylinderGeometry(radius * 0.65, radius, h, 6), material)
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; root.add(mesh)
    return mesh
  }
  const ball = (x: number, y: number, z: number, sx: number, sy: number, sz: number, material = leafMaterial) => {
    const mesh = new Mesh(new SphereGeometry(1, 8, 6), material)
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; root.add(mesh)
  }
  const blades = (count: number, bladeHeight: number, radius: number, material = leafMaterial) => {
    const geometry = new PlaneGeometry(0.035, 1, 1, 2)
    geometry.translate(0, 0.5, 0)
    const mesh = new InstancedMesh(geometry, material, count)
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2
      const distance = Math.sqrt(rand()) * radius
      unit.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance)
      unit.rotation.set((rand() - 0.5) * variation, rand() * Math.PI * 2, (rand() - 0.5) * variation * 1.4)
      unit.scale.set(0.8 + rand() * variation, bladeHeight * (1 - variation * 0.45 + rand() * variation * 0.9), 1)
      unit.updateMatrix(); mesh.setMatrixAt(i, unit.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; root.add(mesh)
  }

  if (preset.form === 'tree' || preset.form === 'flowering-tree') {
    stem(0, 0, 0, height * 0.65, Math.max(0.12, height * 0.035))
    const canopyY = height * 0.73
    const count = Math.round(7 + node.density * 5)
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996
      const radial = spread * (0.15 + Math.sqrt(i / count) * 0.31)
      const x = Math.cos(angle) * radial
      const z = Math.sin(angle) * radial
      const y = canopyY + (rand() - 0.5) * height * variation * 0.75
      ball(x, y, z, spread * (0.18 + rand() * 0.1), height * (0.13 + rand() * 0.08), spread * 0.22,
        preset.form === 'flowering-tree' && i % 3 === 0 ? accentMaterial : leafMaterial)
    }
  } else if (preset.form === 'conifer') {
    stem(0, 0, 0, height, height * 0.025)
    for (let i = 0; i < 4; i++) {
      const cone = new Mesh(new ConeGeometry(spread * (0.45 - i * 0.07), height * 0.42, 9), leafMaterial)
      cone.position.y = height * (0.35 + i * 0.17); cone.castShadow = true; root.add(cone)
    }
  } else if (preset.form === 'shrub') {
    const count = Math.round(5 + node.density * 5)
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2, radius = rand() * spread * 0.32
      ball(Math.cos(angle) * radius, height * (0.45 + rand() * 0.2), Math.sin(angle) * radius,
        spread * 0.27, height * 0.35, spread * 0.27, preset.accent && i % 4 === 0 ? accentMaterial : leafMaterial)
    }
  } else if (preset.form === 'bamboo') {
    const count = Math.round(6 + node.density * 5)
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2, radius = rand() * spread * 0.4
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, h = height * (1 - variation * 0.3 + rand() * variation * 0.3)
      stem(x, 0, z, h, Math.max(0.012, h * 0.008), leafMaterial)
      for (let j = 0; j < 3; j++) ball(x + (rand() - 0.5) * 0.5, h * (0.5 + j * 0.17), z + (rand() - 0.5) * 0.5, 0.4, 0.13, 0.23)
    }
  } else if (preset.form === 'palm') {
    stem(0, 0, 0, height * 0.8, height * 0.04)
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 2 / 10
      const reach = spread * 0.45
      const mesh = new Mesh(new ConeGeometry(reach * 0.18, reach, 3), leafMaterial)
      mesh.position.set(Math.cos(angle) * reach * 0.45, height * 0.76, Math.sin(angle) * reach * 0.45)
      mesh.rotation.set(Math.sin(angle) * 1.1, 0, -Math.cos(angle) * 1.1)
      mesh.castShadow = true; root.add(mesh)
    }
  } else if (preset.form === 'cactus') {
    const cactusMaterial = new MeshStandardMaterial({ color: foliage, roughness: 1 })
    if (node.preset.endsWith('pad')) {
      stem(0, 0, 0, height * 0.5, 0.12, cactusMaterial)
      for (let i = 0; i < 5; i++) ball((rand() - 0.5) * spread, height * (0.35 + rand() * 0.45), (rand() - 0.5) * 0.3, 0.28, 0.42, 0.09, cactusMaterial)
    } else {
      stem(0, 0, 0, height, spread * 0.14, cactusMaterial)
      for (const side of [-1, 1]) {
        const arm = stem(side * spread * 0.33, height * 0.43, 0, height * 0.32, 0.09, cactusMaterial)
        arm.rotation.z = side * 0.38
      }
    }
  } else if (preset.form === 'succulent' || preset.form === 'fern') {
    const count = preset.form === 'fern' ? 18 : 12
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count, reach = spread * (0.25 + rand() * 0.2)
      const leaf = new Mesh(new ConeGeometry(reach * 0.18, reach, 3), leafMaterial)
      leaf.position.set(Math.cos(angle) * reach * 0.32, height * 0.35, Math.sin(angle) * reach * 0.32)
      leaf.rotation.set(Math.sin(angle) * 0.9, 0, -Math.cos(angle) * 0.9)
      root.add(leaf)
    }
  } else if (preset.form === 'flower') {
    const count = Math.round(5 + node.density * 6)
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2, radius = Math.sqrt(rand()) * spread * 0.45
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, h = height * (0.65 + rand() * 0.35)
      stem(x, 0, z, h, 0.012, leafMaterial)
      ball(x, h, z, 0.07, 0.045, 0.07, accentMaterial)
    }
    blades(Math.round(20 * node.density), height * 0.35, spread * 0.5)
  } else {
    blades(Math.round(Math.min(180, 80 * node.density)), height, spread * 0.48)
    if (preset.accent) {
      for (let i = 0; i < 9; i++) {
        const angle = rand() * Math.PI * 2, radius = rand() * spread * 0.4
        const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
        stem(x, 0, z, height * 1.1, 0.009, leafMaterial)
        ball(x, height * 1.1, z, 0.05, 0.09, 0.05, accentMaterial)
      }
    }
  }
  mergePlantParts(root)
  const usedMaterials = new Set(root.children.flatMap((child) => child instanceof Mesh
    ? Array.isArray(child.material) ? child.material : [child.material] : []))
  for (const material of [leafMaterial, woodMaterial, accentMaterial])
    if (!usedMaterials.has(material)) material.dispose()
  root.scale.setScalar(node.scale)
  return root
}

export function disposePlantGeometry(group: Group) {
  const geometries = new Set<object>(), materials = new Set<object>()
  group.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof InstancedMesh)) return
    if (object instanceof InstancedMesh) object.dispose()
    geometries.add(object.geometry)
    const source = Array.isArray(object.material) ? object.material : [object.material]
    source.forEach((material) => materials.add(material))
  })
  geometries.forEach((geometry) => (geometry as { dispose: () => void }).dispose())
  materials.forEach((material) => (material as { dispose: () => void }).dispose())
}
