'use client'
import { useEditor } from '@pascal-app/editor'
import { PathwayPlacement } from './tool'

// Split uses the perspective listener for both canvases' shared grid events.
export default function PathwayFloorplanTool() {
  const viewMode = useEditor(state => state.viewMode)
  return viewMode === '2d' ? <PathwayPlacement render3D={false} /> : null
}
