import type { ToolHint } from '@pascal-app/core'
import type { ContinuationContext } from '../../../lib/continuation'
import type { SnapContext } from '../../../lib/snapping-mode'
import useEditor from '../../../store/use-editor'
import { ContextualHelperPanel } from './contextual-helper-panel'

/**
 * Generic helper panel rendered from `def.toolHints` data. Matches the
 * visual styling of the hand-written `<WallHelper>` / `<ItemHelper>` /
 * etc. so registry-driven kinds get a consistent look without each kind
 * writing its own component.
 *
 * Drops the need for per-kind helper files entirely — kinds declare
 * their hints as static data in their `NodeDefinition`.
 */
export function RegisteredToolHelper({
  hints,
  shiftPressed = false,
  snapContext = null,
  continuationContext = null,
  wallSplitMode = false,
}: {
  hints: ToolHint[]
  shiftPressed?: boolean
  snapContext?: SnapContext | null
  continuationContext?: ContinuationContext | null
  wallSplitMode?: boolean
}) {
  // Live vertex count of an in-progress polygon draft, so hints gated on a
  // minimum (e.g. "Finish" at ≥ 3) only appear once they're actually possible.
  const draftVertexCount = useEditor((s) => s.draftVertexCount)
  // The snapping chip (when a context is active) already shows Shift = cycle, so
  // drop the redundant 'Cycle snapping mode' tool hint to avoid a double pill;
  // also hide draft-gated hints until the draft is far enough along.
  const visible = hints.filter(
    (hint) =>
      !(hint.key === 'Shift' && hint.label === 'Cycle snapping mode') &&
      (hint.minDraftVertices == null || draftVertexCount >= hint.minDraftVertices),
  )
  if (visible.length === 0 && !snapContext && !continuationContext) return null
  return (
    <ContextualHelperPanel
      hints={visible.map((hint) => {
        const isBypassHint = hint.key === 'Shift'
        const isSplitHint = hint.key === 'O'
        return {
          keys: [hint.key],
          label:
            shiftPressed && isBypassHint
              ? 'Guided constraints bypassed'
              : isSplitHint && wallSplitMode
                ? 'Split-on-overlap: ON'
                : hint.label,
          active: (shiftPressed && isBypassHint) || (isSplitHint && wallSplitMode),
        }
      })}
      continuationContext={continuationContext}
      snapContext={snapContext}
    />
  )
}
