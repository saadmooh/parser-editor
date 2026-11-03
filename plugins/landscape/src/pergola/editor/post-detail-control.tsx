'use client'
import type { PergolaNode } from '../domain/schema'
import {
  POST_DETAIL_OPTIONS,
  validPostDetailStyle,
} from '../domain/post-details'

export function PostDetailControl({
  node,
  onUpdate,
}: {
  node: PergolaNode
  onUpdate: (patch: Partial<PergolaNode>) => void
}) {
  const choices = POST_DETAIL_OPTIONS[node.postStyle ?? 'square']
  return (
    <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">
      <span>Post detail</span>
      <select
        aria-label="Post detail"
        className="max-w-[150px] rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
        value={validPostDetailStyle(node)}
        onChange={(event) =>
          onUpdate({
            postDetailStyle: event.target
              .value as PergolaNode['postDetailStyle'],
          })
        }
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  )
}
