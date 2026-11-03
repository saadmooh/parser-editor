'use client'
import { type AnyNodeId, useLiveNodeOverrides, useRegistry } from '@pascal-app/core'
import { useNodeEvents, useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import { useEditor } from '@pascal-app/editor'
import type { Group } from 'three'
import type { PathwayNode } from '../domain/schema'
import { PATHWAY_KIND } from '../domain/schema'
import { PathwayExtensionControls } from '../editor/extension-controls'
import { PathwayJunctionControls } from '../editor/junction-controls'
import { PathwayCurveControls } from '../editor/curve-controls'
import { buildPathwayGeometry, createPathwayMaterial, disposePathwayGeometry } from './geometry'
import { applyLandscapePaintedMaterials } from '../../ground-access/shared/paint'

export default function PathwayRenderer({ node }: { node: PathwayNode }) {
  const ref = useRef<Group>(null!)
  useRegistry(node.id, PATHWAY_KIND, ref)
  const override = useLiveNodeOverrides((state) => state.overrides.get(node.id))
  const renderedNode = useMemo(() => override ? { ...node, ...override } as PathwayNode : node,
    [node, override])
  const selected = useViewer((state) =>
    ((state.selection as { selectedIds?: AnyNodeId[] }).selectedIds ?? []).includes(node.id as AnyNodeId))
  const drawing = useEditor((state) => state.mode === 'build' && state.tool === PATHWAY_KIND)
  const handlers = useNodeEvents(node as never, PATHWAY_KIND as never)
  const material = useMemo(() => createPathwayMaterial(renderedNode),
    [renderedNode.finish, renderedNode.color])
  useEffect(() => () => { material.dispose(); material.map?.dispose() }, [material])
  const geometry = useMemo(() => {
    const built = buildPathwayGeometry(renderedNode, undefined, material)
    applyLandscapePaintedMaterials(built, renderedNode.paintedMaterials, (mesh) => mesh.userData.slotId ?? null, false)
    return built
  }, [renderedNode, material])
  useEffect(() => () => disposePathwayGeometry(geometry, false), [geometry])
  return <group ref={ref} visible={renderedNode.visible !== false} {...(drawing ? {} : handlers)}>
    <primitive object={geometry} />
    {selected && !drawing && <PathwayExtensionControls node={renderedNode} />}
    {selected && !drawing && <PathwayJunctionControls node={renderedNode} />}
    {selected && !drawing && <PathwayCurveControls node={renderedNode} />}
  </group>
}
