'use client'

import { useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PondNode } from './schema'
import { createPondEditSession } from './edit-session'

export function usePondSettingsEdit(pond: PondNode | null) {
  const [patch, setPatch] = useState<Partial<PondNode>>({})
  const previewing = useRef(false)
  const session = useMemo(() => {
    let wasDragging = false
    let ownsDragging = false
    const id = pond?.id
    return createPondEditSession({
      current: () => id ? useScene.getState().nodes[id as never] as unknown as PondNode ?? null : null,
      readOnly: () => useScene.getState().readOnly,
      preview: next => {
        if (!id) return
        if (!ownsDragging) {
          wasDragging = useViewer.getState().inputDragging
          ownsDragging = true
          useViewer.getState().setInputDragging(true)
        }
        setPatch(next)
        useLiveNodeOverrides.getState().set(id, { ...next, __pondEditPreview: true })
      },
      clear: fields => {
        if (id) useLiveNodeOverrides.getState().clearFields(id, [...fields, '__pondEditPreview'])
        if (ownsDragging) useViewer.getState().setInputDragging(wasDragging)
        ownsDragging = false
        setPatch({})
      },
      commit: next => { if (id) useScene.getState().updateNode(id as never, next as never) },
    })
  }, [pond?.id])
  useEffect(() => () => session.cancel(), [session])
  return { patch, session, previewing,
    runPreview: (change: () => void) => {
      previewing.current = true
      try { change() } finally { previewing.current = false }
    },
  }
}
