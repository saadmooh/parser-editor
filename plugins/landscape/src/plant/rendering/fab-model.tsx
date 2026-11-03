'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNodeEvents } from '@pascal-app/viewer'
import { Group, Mesh } from 'three'
import { PLANT_KIND, type PlantNode } from '../domain/schema'
import { FAB_MODEL_URLS } from '../domain/models'
import { acquireFabAsset } from './fab-assets'
import { collectPlantParts } from './instance-batches'
import { registerPlantInstance } from './instance-registry'

export default function FabModel({ node, instanced = false }: { node: PlantNode; instanced?: boolean }) {
  const [model, setModel] = useState<Group | null>(null)
  const ref = useRef<Group>(null!)
  const handlers = useNodeEvents(node as never, PLANT_KIND as never)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const url = FAB_MODEL_URLS[node.preset]
  useEffect(() => {
    let cancelled = false
    setModel(null)
    if (!url) return
    const asset = acquireFabAsset(url, node.tint)
    asset.model.then((source) => {
      if (cancelled) return
      const instance = source.clone(true)
      instance.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.castShadow = true
        object.receiveShadow = true
      })
      setModel(instance)
    }).catch((error) => console.error('Failed to load FABOTANIC plant', node.preset, error))
    return () => {
      cancelled = true
      asset.release()
    }
  }, [url, node.tint, node.preset])
  useLayoutEffect(() => {
    if (!instanced || !model || !ref.current) return
    const parts = collectPlantParts(ref.current, model)
    if (!parts) return
    return registerPlantInstance({ id: node.id, root: ref.current, model, parts,
      get handlers() { return handlersRef.current } })
  }, [instanced, model, node.id])
  return <group ref={ref} scale={node.scale} dispose={null}>
    {model && <primitive object={model} dispose={null} />}
  </group>
}
