import { Group, InstancedMesh, Mesh, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Bake local transforms into one mesh per material/shadow configuration. */
export function mergePlantParts(root: Group) {
  const batches = new Map<string, Mesh[]>()
  for (const child of root.children) {
    if (!(child instanceof Mesh) || child instanceof InstancedMesh || Array.isArray(child.material)) continue
    const key = `${child.material.uuid}:${child.castShadow}:${child.receiveShadow}`
    const parts = batches.get(key) ?? []
    parts.push(child)
    batches.set(key, parts)
  }
  for (const parts of batches.values()) {
    if (parts.length < 2) continue
    const transformed: BufferGeometry[] = parts.map((part) => {
      part.updateMatrix()
      return part.geometry.clone().applyMatrix4(part.matrix)
    })
    const geometry = mergeGeometries(transformed, false)
    transformed.forEach((part) => part.dispose())
    if (!geometry) continue
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const first = parts[0]!
    const mesh = new Mesh(geometry, first.material)
    mesh.castShadow = first.castShadow
    mesh.receiveShadow = first.receiveShadow
    root.add(mesh)
    for (const part of parts) {
      root.remove(part)
      part.geometry.dispose()
    }
  }
}
