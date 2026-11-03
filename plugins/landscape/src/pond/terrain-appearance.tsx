'use client'
import { sceneRegistry, useScene, persistedTerrainFieldOf } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Float32BufferAttribute, Mesh, Vector3, type Material, type Texture, type Color } from 'three'
import { attribute, color, positionWorld, texture, uv, vec3 } from 'three/tsl'
import { pondTerrainAppearanceKey } from './terrain-input'
import { pondBedSurfaceIndex } from './bed-surfaces'
import { PondNode } from './schema'
import { createPondTerrainField } from './terrain'
import { pondSiteDesign, pondSiteFrame } from './site-terrain'
import { pondTerrainMaterial } from './materials'
import { hasPondTerrainAttributes, shouldRefreshPondTerrainAppearance } from './terrain-appearance-refresh'

/** Texture the existing terrain and draped ground; this creates no ground meshes. */
export default function PondTerrainAppearance() {
  const key = useScene(state => pondTerrainAppearanceKey(state.nodes))
  const nodes = useScene.getState().nodes
  const sweep = useRef({ next: 0, profiles: null as unknown })
  const profiles = useMemo(() => Object.values(nodes).flatMap(raw => {
    if ((raw.type as string) !== 'landscape:pond' || raw.visible === false) return []
    const parsed = PondNode.safeParse(raw)
    if (!parsed.success) return []
    const { node, frame } = pondSiteDesign(parsed.data, nodes)
    if (!frame) return []
    return [{ node, frame, field: createPondTerrainField(node) }]
  }), [key])
  const styles = useMemo(() => new Map<Mesh, { original: Material; styled: Material; geometryId: string; transform: string; profiles: typeof profiles }>(), [])
  const restore = (mesh: Mesh) => {
    const state = styles.get(mesh)
    if (!state) return
    mesh.material = state.original
    // The host can retain a material clone for a render pass. Keep its required
    // vertex buffers until the geometry itself is disposed by the host.
    state.styled.dispose(); styles.delete(mesh)
  }
  useEffect(() => () => { for (const mesh of styles.keys()) restore(mesh) }, [])
  useFrame(({ clock }) => {
    // Host geometries can arrive asynchronously: inspect four times per second,
    // and immediately when pond profiles change, rather than walking the scene each frame.
    if (!shouldRefreshPondTerrainAppearance(clock.elapsedTime, sweep.current.next, profiles, sweep.current.profiles, styles)) return
    sweep.current = { profiles, next: clock.elapsedTime + .25 }
    const nodes = useScene.getState().nodes
    const seen = new Set<Mesh>(), point = new Vector3()
    for (const [id, group] of sceneRegistry.nodes) {
      const raw = nodes[id as keyof typeof nodes]
      if (!raw || !['site', 'landscape:ground-area'].includes(raw.type as string)) continue
      const siteId = raw.type === 'site' ? id : pondSiteFrame({ parentId: raw.parentId, position: [0, 0, 0], rotation: [0, 0, 0] }, nodes)?.site.id
      const relevant = profiles.filter(profile => profile.frame.site.id === siteId)
      if (!relevant.length) continue
      const terrain = raw.type === 'site' ? persistedTerrainFieldOf(raw as never) : null
      group.updateWorldMatrix(true, true)
      group.traverse(object => {
        if (!(object instanceof Mesh) || Array.isArray(object.material)) return
        if (raw.type === 'site' && (!terrain || object.geometry.getAttribute('position')?.count !== terrain.cols * terrain.rows)) return
        if (raw.type !== 'site' && object.userData.slotId !== 'surface') return
        seen.add(object)
        const transform = object.matrixWorld.elements.join(',')
        const previous = styles.get(object)
        if (previous && previous.geometryId === object.geometry.uuid && previous.profiles === profiles && previous.transform === transform && hasPondTerrainAttributes(object)) return
        const original = previous?.original ?? object.material
        if (previous) previous.styled.dispose()
        const p = object.geometry.getAttribute('position')
        const blend = new Float32Array(p.count), local = new Float32Array(p.count * 2), datum = new Float32Array(p.count), bed = new Float32Array(p.count)
        for (let index = 0; index < p.count; index++) {
          point.fromBufferAttribute(p, index); object.localToWorld(point)
          for (const profile of relevant) {
            const dx = point.x - profile.frame.x, dz = point.z - profile.frame.z, c = Math.cos(profile.frame.yaw), s = Math.sin(profile.frame.yaw)
            const x = dx * c - dz * s, z = dz * c + dx * s, b = profile.field.bounds
            if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
            const weight = profile.field.blendAt(x, z)
            if (weight <= blend[index]!) continue
            blend[index] = weight; local[index * 2] = x; local[index * 2 + 1] = z
            datum[index] = profile.node.elevation + profile.frame.y
            bed[index] = pondBedSurfaceIndex(profile.node.bedSurface)
          }
        }
        object.geometry.setAttribute('pondBlend', new Float32BufferAttribute(blend, 1))
        object.geometry.setAttribute('pondLocalXZ', new Float32BufferAttribute(local, 2))
        object.geometry.setAttribute('pondDatum', new Float32BufferAttribute(datum, 1))
        object.geometry.setAttribute('pondBedSurface', new Float32BufferAttribute(bed, 1))
        const base = original as Material & { map?: Texture; color?: Color }
        const outside = base.map ? texture(base.map, uv()).rgb : color(base.color ? `#${base.color.getHexString()}` : '#718451').rgb
        const xz = attribute<'vec2'>('pondLocalXZ', 'vec2')
        const styled = pondTerrainMaterial(relevant[0]!.node, relevant[0]!.field.bounds, undefined, {
          position: vec3(xz.x, positionWorld.y, xz.y), datum: attribute<'float'>('pondDatum', 'float'), outside,
          bedIndex: attribute<'float'>('pondBedSurface', 'float'), bedSurfaces: relevant.map(profile => profile.node.bedSurface),
        })
        object.material = styled
        styles.set(object, { original, styled, geometryId: object.geometry.uuid, transform, profiles })
      })
    }
    for (const mesh of styles.keys()) if (!seen.has(mesh)) restore(mesh)
  })
  return null
}
