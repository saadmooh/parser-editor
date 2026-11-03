'use client'
import { type FloorplanToolContext, useEditor } from '@pascal-app/editor'
import { IrrigationPlacement } from './tool'
export default function IrrigationFloorplanTool(context: FloorplanToolContext) {
  const viewMode = useEditor((state) => state.viewMode)
  return viewMode === '2d' ? <IrrigationPlacement {...context} /> : null
}
