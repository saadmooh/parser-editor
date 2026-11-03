import { gradePathwayMesh, pathwayGradeField } from './grade-mesh'
import { extrudePaving } from './safe-extrusion'
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { STONE_LAYOUT_DEFAULTS, currentPathway, isNaturalStoneFinish, type PathwayEdgeProfile, type PathwayNode } from '../domain/schema'
import { buildOutline } from './outline'
import { createFinishTexture } from './finishes'
import { pathwayStoneFootprints } from './stone-footprints'
import { pavingPolygons } from './paving-polygons'
import { pavingBorder } from './paving-border'
import type { GeometryContext } from '@pascal-app/core'
import { subtractPoolCutouts } from '../../shared/pool-cutouts'

function bevel(profile: PathwayEdgeProfile, depth: number) {
  const size = profile === 'sharp' ? 0 : profile === 'soft' ? 0.006 : 0.012
  return {
    bevelEnabled: size > 0,
    bevelSize: size,
    bevelThickness: Math.min(size, depth / 3),
    bevelSegments: profile === 'rounded' ? 5 : 3,
  }
}

export function buildPathwayGeometry(node: PathwayNode, ctx?: GeometryContext, suppliedMaterial?: MeshStandardMaterial): Group {
  node = currentPathway(node)
  const group = new Group()
  const canCloneSuppliedMaterial = suppliedMaterial && typeof suppliedMaterial.clone === 'function' &&
    typeof suppliedMaterial.color?.multiplyScalar === 'function'
  const material = canCloneSuppliedMaterial ? suppliedMaterial : createPathwayMaterial(node)
  group.userData.sourceMaterial = canCloneSuppliedMaterial ? undefined : material
  const natural = isNaturalStoneFinish(node.finish)
  const laid = node.finish === 'laidStone' || node.finish === 'concreteSlabs' || natural
  const ownedMaterials: MeshStandardMaterial[] = []
  const baseMaterial = node.finish === 'concreteSlabs'
    ? new MeshStandardMaterial({ color: '#adab9c', roughness: 1 }) : material
  if (baseMaterial !== material) ownedMaterials.push(baseMaterial)
  group.userData.ownedMaterials = ownedMaterials
  const polygons = subtractPoolCutouts(buildOutline(node), node as unknown as PathwayNode & { id: string; type: string; parentId: string | null }, ctx)
  if (!polygons.length) {
    for (const owned of ownedMaterials) owned.dispose()
    if (!canCloneSuppliedMaterial) {
      material.dispose()
      material.map?.dispose()
    }
    return group
  }
  for (const polygon of node.finish === 'laidStone' || natural ? [] : polygons) {
    const geometry = extrudePaving(polygon, {
      depth: node.thickness,
      bevelEnabled: false,
      steps: 1,
    })
    if (!geometry) continue
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(0, node.elevation + 0.005, 0)
    const mesh = new Mesh(geometry, baseMaterial)
    mesh.name = 'pathway-backing'
    mesh.userData.slotId = 'surface'
    mesh.receiveShadow = true
    mesh.castShadow = true
    group.add(mesh)
  }
  // A narrow run of individual edging stones follows the joined outline, so
  // junctions and bends get a continuous border on both sides of the path.
  if (node.borderStyle !== 'none' && !(node.finish === 'laidStone' && node.borderStyle === 'stone')) {
    const edging = pavingBorder(polygons, Math.min(0.13, ...node.edges.map((edge) => edge.width * 0.18)))
      const edgePolygons = node.borderStyle === 'smooth'
        ? edging.band.flatMap((polygon) => [polygon])
        : edging.stones
    if (edgePolygons.length) {
      const edgeMaterial = new MeshStandardMaterial({
        color: node.borderStyle === 'smooth' ? '#b8b9a8' : '#c8c8b9', roughness: 0.94,
      })
      ownedMaterials.push(edgeMaterial)
      const geometries: BufferGeometry[] = []
      for (const polygon of edgePolygons) {
        // Expand the cap a few millimetres past the path edge, then run it
        // from the underside of the paving to just above its top surface.
        const edgeDepth = node.thickness + 0.02
        const edgeBevel = bevel(node.borderEdge ?? 'soft', edgeDepth)
        const expanded = pavingPolygons.inset(polygon, edgeBevel.bevelSize - 0.008)
        for (const piece of expanded) {
          const geometry = extrudePaving(piece, {
            depth: edgeDepth,
            ...edgeBevel,
            steps: 1,
          })
          if (!geometry) continue
          geometry.rotateX(-Math.PI / 2)
          geometry.translate(0, node.elevation + 0.005, 0)
          geometries.push(geometry)
        }
      }
      const geometry = geometries.length ? mergeGeometries(geometries, false) : null
      geometries.forEach((part) => part.dispose())
      if (geometry) {
        const mesh = new Mesh(geometry, edgeMaterial)
        mesh.name = 'pathway-border'
        mesh.userData.slotId = 'border'
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
      }
    }
  }
  if (laid) {
    const tileMaterials = Array.from({ length: 4 }, (_, i) => {
      const tileMaterial = material.clone()
      tileMaterial.color.multiplyScalar(node.finish === 'laidStone' || natural
        ? 1 + (natural ? node.naturalStoneShade ?? 0.4 : node.stoneVariation ?? STONE_LAYOUT_DEFAULTS.variation)
          * [-0.3, -0.1, 0.1, 0.3][i]!
        : [0.98, 1, 1.02, 1][i]!)
      ownedMaterials.push(tileMaterial)
      return tileMaterial
    })
    const borderMaterial = material.clone()
    borderMaterial.color.multiplyScalar(0.94)
    ownedMaterials.push(borderMaterial)
    const batches = new Map<MeshStandardMaterial, BufferGeometry[]>()
    const tiles = pathwayStoneFootprints(node, ctx)
    group.userData.pavingTileCount = tiles.length
    for (const tile of tiles) {
      // Extrusion bevels expand outward. Inset the source first so bevels
      // cannot grow through a neighboring stone or close a miter joint.
      const depth = tile.border
        ? node.thickness + 0.02
        : node.finish === 'laidStone' || natural ? Math.max(0.018, node.thickness - 0.012) : 0.012
      const tileBevel = bevel(tile.border ? node.borderEdge ?? 'soft' : node.stoneEdge ?? 'soft', depth)
      const pieces = pavingPolygons.inset([tile.ring, ...(tile.holes ?? [])],
        tile.border ? tileBevel.bevelSize - 0.008 : tileBevel.bevelSize)
      for (const piece of pieces) {
        const geometry = extrudePaving(piece, {
          depth,
          ...tileBevel,
          steps: 1,
        })
        if (!geometry) continue
        geometry.rotateX(-Math.PI / 2)
        geometry.translate(0, tile.border ? node.elevation + 0.005
          : node.finish === 'laidStone' || natural ? node.elevation + 0.011 : node.elevation + node.thickness + 0.012, 0)
        const tileMaterial = tile.border ? borderMaterial : tileMaterials[tile.shade]!
        const batch = batches.get(tileMaterial) ?? []
        batch.push(geometry)
        batches.set(tileMaterial, batch)
      }
    }
    // Stones remain disconnected geometry; batching avoids one draw call per stone.
    for (const [tileMaterial, geometries] of batches) {
      const geometry = geometries.length ? mergeGeometries(geometries, false) : null
      for (const part of geometries) part.dispose()
      if (!geometry) continue
      const mesh = new Mesh(geometry, tileMaterial)
      mesh.userData.slotId = 'surface'
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }
  }
  if (node.vertices.some((vertex) => (vertex.elevationOffset ?? 0) !== 0)) {
    const heightAt = pathwayGradeField(node)
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const original = object.geometry
      object.geometry = gradePathwayMesh(original, heightAt)
      original.dispose()
    })
  }
  return group
}

export function createPathwayMaterial(node: PathwayNode) {
  const texture = createFinishTexture(node.finish ?? 'concrete', node.color)
  return new MeshStandardMaterial({
    color: texture ? '#ffffff' : node.color,
    map: texture,
    bumpMap: node.finish === 'laidStone' || isNaturalStoneFinish(node.finish) ? texture : null,
    bumpScale: node.finish === 'laidStone' || isNaturalStoneFinish(node.finish) ? 0.012 : 0,
    roughness: 0.92,
  })
}

export function disposePathwayGeometry(group: Group, disposeMaterial = true) {
  const materials = new Set<MeshStandardMaterial>()
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material)
  })
  for (const material of group.userData.ownedMaterials ?? []) {
    material.dispose()
    materials.delete(material)
  }
  const sourceMaterial = group.userData.sourceMaterial as MeshStandardMaterial | undefined
  if (sourceMaterial && !disposeMaterial) {
    materials.delete(sourceMaterial)
    sourceMaterial.dispose()
    sourceMaterial.map?.dispose()
  } else if (sourceMaterial) {
    materials.add(sourceMaterial)
  }
  if (disposeMaterial) for (const material of materials) {
    material.dispose()
    material.map?.dispose()
  }
}
