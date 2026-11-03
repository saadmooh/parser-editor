'use client'
import { type FloorplanToolContext, useEditor } from '@pascal-app/editor'
import { TreePlacement } from './tool'

// In split view the perspective tool handles both canvases' shared events.
export default function TreeFloorplanTool(context: FloorplanToolContext) {
  const viewMode = useEditor((state) => state.viewMode)
  if (viewMode !== '2d') return null
  return <TreePlacement {...context} />
}
