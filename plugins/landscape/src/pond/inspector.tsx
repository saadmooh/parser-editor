'use client'

import type { AnyNode } from '@pascal-app/core'
import { PanelWrapper } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { LANDSCAPE_CATALOG_THUMBNAILS } from '../editor/catalog-thumbnails'
import PondPanel from './panel'
import type { PondNode } from './schema'

/** The selected-node inspector owns its card; the sidebar reuses just its settings. */
export default function PondInspector({ node }: { node: AnyNode | PondNode }) {
  const setSelection = useViewer(state => state.setSelection)
  return <PanelWrapper title="Pond" width={340}
    icon={<img alt="" src={LANDSCAPE_CATALOG_THUMBNAILS.pond} className="h-10 w-12 rounded-md object-cover" />}
    onClose={() => setSelection({ selectedIds: [] })}>
    <PondPanel node={node} />
  </PanelWrapper>
}
