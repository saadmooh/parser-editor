import type { ReactNode } from 'react'

export function CatalogListRow({
  label,
  thumbnail,
  active,
  disabled = false,
  chevron = false,
  onClick,
}: {
  label: string
  thumbnail: ReactNode
  active?: boolean
  disabled?: boolean
  chevron?: boolean
  onClick: () => void
}) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick}
    className="flex min-h-[43px] w-full items-center gap-2.5 border-0 border-b border-border/70 px-1 py-1 text-left text-foreground transition-colors hover:bg-accent/30 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
    style={{ background: active ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'transparent' }}>
    {thumbnail}
    <span className="min-w-0 flex-1 text-xs">{label}</span>
    {chevron && <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m6 3 5 5-5 5" /></svg>}
  </button>
}
