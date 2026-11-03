'use client'
import { SegmentedControl, useEditor } from '@pascal-app/editor'

export function PlacementContinuation() {
  const mode = useEditor((state) => state.getContinuation('point'))
  return <div role="group" aria-label="Plant placement continuation" className="space-y-2">
    <SegmentedControl value={mode} onChange={(value) => useEditor.getState().setContinuation('point', value)} options={[
      { value: 'once', label: 'Place once' }, { value: 'repeat', label: 'Repeat' },
    ]} />
    <p className="text-xs leading-5 text-muted-foreground">{mode === 'repeat' ? 'Click to place each instance. Escape finishes placement.' : 'Place one instance, then edit its properties.'}</p>
  </div>
}
