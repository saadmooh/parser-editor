'use client'
import { type FloorplanToolContext, useEditor } from '@pascal-app/editor'
import { PlantPlacement } from './tool'

// In split view the perspective tool handles both canvases' shared events.
export default function PlantFloorplanTool(context: FloorplanToolContext) {
  const viewMode = useEditor((state) => state.viewMode)
  if (viewMode !== '2d') return null
  return <PlantPlacement {...context} />
}
