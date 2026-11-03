'use client'
import { type AnyNodeId, getLevelElevations, sceneRegistry, useLiveNodeOverrides, useLiveTransforms, useRegistry, useScene } from '@pascal-app/core'
import { useNodeEvents, useSceneAtmosphere, useViewer } from '@pascal-app/viewer'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Frustum, Matrix4, Sphere, Vector3, type Group } from 'three'
import { pondWaterQuality } from './water-quality'
import { POND_KIND, PondNode } from './schema'
import { pondTerrainContextKey } from './terrain-input'
import { buildPondGeometry, pondRockKey, updatePondDetails, updatePondWater } from './geometry'
import { retainPondGeometry } from './lifetime'
import { getPondWaterState, pausePondWater, setPondWaterQuality, updatePondWaterSettings } from './water'

export default function PondRenderer({ node }: { node: PondNode }) {
  const ref = useRef<Group>(null!)
  const atmosphere = useSceneAtmosphere()
  useRegistry(node.id, POND_KIND, ref)
  const handlers = useNodeEvents(node as never, POND_KIND as never)
  const live = useLiveTransforms(state => state.get(node.id as AnyNodeId))
  const override = useLiveNodeOverrides(state => state.overrides.get(node.id))
  const contextKey = useScene(state => pondTerrainContextKey(node, state.nodes))
  const sceneNodes = useScene.getState().nodes
  const design = PondNode.parse({ ...node, ...override })
  const previewGeometry = Boolean(override && ['width', 'depth', 'shape', 'outline', 'basinDepth', 'elevation', 'waterDrop', 'bankWidth', 'thickness'].some(key => key in override))
  const key = JSON.stringify([design.width, design.depth, design.shape, design.outline, design.basinDepth,
    design.elevation, design.waterDrop, design.bankWidth, design.thickness, design.position, design.rotation, contextKey, previewGeometry])
  const geometry = useMemo(() => buildPondGeometry(design, { sceneNodes } as never, previewGeometry, atmosphere), [key, atmosphere])
  useLayoutEffect(() => { updatePondDetails(geometry, design) }, [geometry, pondRockKey(design), design.rockBorderColorVariation, design.rockBorderMoss, design.fishCount, design.fishSize, design.fishType])
  useEffect(() => retainPondGeometry(geometry), [geometry])
  useLayoutEffect(() => { updatePondWaterSettings(geometry, design) }, [geometry, design.waterPreset, design.waterColor, design.rippleStrength, design.waterClarity, design.reflectionStrength, design.refractionStrength, design.sunGlints, design.underwaterLight, design.waveSpeed, design.waveSettling, design.rain, design.fishResponse])
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    const resume = () => { if (document.visibilityState !== 'hidden') invalidate() }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [invalidate])
  const bounds = useMemo(() => {
    const water = geometry.getObjectByName('pond-water') as import('three').Mesh
    water.geometry.computeBoundingSphere()
    const sphere = water.geometry.boundingSphere!.clone()
    sphere.radius += design.bankWidth * 2 + 1.5
    sphere.center.y = water.position.y
    return sphere
  }, [geometry])
  const frame = useMemo(() => ({ frustum: new Frustum(), matrix: new Matrix4(), sphere: new Sphere(), centre:new Vector3(),edge:new Vector3(),right:new Vector3() }), [])
  const parentLevels = useMemo(() => {
    const levels: { id: AnyNodeId; baseY: number }[] = [], seen = new Set<string>()
    const elevations = getLevelElevations(sceneNodes)
    let parentId = design.parentId
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId)
      const parent = sceneNodes[parentId as AnyNodeId]
      if (!parent || parent.type === 'site') break
      if (parent.type === 'level') levels.push({ id: parent.id, baseY: elevations.get(parent.id)?.baseY ?? 0 })
      parentId = parent.parentId
    }
    return levels
  }, [contextKey, design.parentId])
  useFrame(({ clock, camera, size }) => {
    const root = ref.current
    // Site excavation never follows exploded-view offsets or level lerping.
    // Cancel only the difference from the authored stack datum already used
    // by pondSiteDesign; all pond contents remain together at the site height.
    if (root) {
      let presentationOffset = 0
      for (const level of parentLevels) {
        const object = sceneRegistry.nodes.get(level.id)
        if (object) presentationOffset += object.position.y - level.baseY
      }
      root.position.y = (live?.position ?? design.position)[1] - presentationOffset
    }
    let visible = design.visible !== false && document.visibilityState !== 'hidden'
    for (let object = root; object; object = object.parent as Group) if (!object.visible) visible = false
    if (root && visible) {
      root.updateWorldMatrix(true, false)
      frame.sphere.copy(bounds).applyMatrix4(root.matrixWorld)
      frame.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frame.frustum.setFromProjectionMatrix(frame.matrix)
      visible = frame.frustum.intersectsSphere(frame.sphere)
    }
    if (!visible || !design.animated) { pausePondWater(geometry, clock.elapsedTime); return }
    frame.centre.copy(frame.sphere.center).project(camera)
    frame.right.setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(frame.sphere.radius)
    frame.edge.copy(frame.sphere.center).add(frame.right).project(camera)
    const radiusPixels=Math.abs(frame.edge.x-frame.centre.x)*size.width/2
    const water=geometry.getObjectByName('pond-water') as import('three').Mesh
    const quality=getPondWaterState(water)!.surface.quality
    setPondWaterQuality(geometry,pondWaterQuality(quality,radiusPixels,useViewer.getState().inputDragging))
    updatePondWater(geometry, clock.elapsedTime); invalidate()
  })
  return <group ref={ref} position={live?.position ?? design.position}
    rotation={[0, live?.rotation ?? design.rotation[1], 0]} visible={node.visible !== false} {...handlers}>
    <primitive object={geometry} dispose={null} />
  </group>
}
