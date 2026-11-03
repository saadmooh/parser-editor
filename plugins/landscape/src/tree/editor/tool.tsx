'use client'
import { type FloorplanToolContext, useEditor, useRegistryToolContext } from '@pascal-app/editor'
import { PlantPlacement } from '../../plant/editor/tool'

export default function TreeTool() {
  const context = useRegistryToolContext()
  const viewMode = useEditor((state) => state.viewMode)
  if (viewMode === '2d') return null
  return <TreePlacement {...context} render3D />
}

export function TreePlacement(props: Pick<FloorplanToolContext, 'activeLevelId' | 'selectNode'> & { isCameraDragging?: () => boolean; render3D?: boolean }) {
  return <PlantPlacement {...props} family="tree" />
}
