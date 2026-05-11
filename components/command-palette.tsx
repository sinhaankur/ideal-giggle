"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"

export interface CommandItem {
  id: string
  label: string
  hint?: string
  shortcut?: string
  // Free-text keywords that should also match the item, so users can
  // type "private" → "Lock vault" without remembering the exact label.
  keywords?: string[]
  // Whether this item is currently actionable. Disabled items still
  // render so users see the affordance exists, but Enter is a no-op.
  disabled?: boolean
  onSelect: () => void
}

export interface CommandSection {
  id: string
  label: string
  items: CommandItem[]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  sections: CommandSection[]
}

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (item.label.toLowerCase().includes(q)) return true
  if (item.hint?.toLowerCase().includes(q)) return true
  if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return true
  return false
}

export function CommandPalette({ open, onClose, sections }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Flatten + filter for keyboard navigation.
  const flatItems = useMemo(() => {
    const out: { section: string; item: CommandItem }[] = []
    for (const section of sections) {
      for (const item of section.items) {
        if (matches(item, query)) {
          out.push({ section: section.label, item })
        }
      }
    }
    return out
  }, [sections, query])

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActiveIndex(0)
    // Defer focus by one tick so the input is mounted.
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  // Clamp active index when results shrink.
  useEffect(() => {
    if (activeIndex >= flatItems.length) {
      setActiveIndex(Math.max(0, flatItems.length - 1))
    }
  }, [flatItems.length, activeIndex])

  // Scroll the active item into view.
  useEffect(() => {
    if (!open) return
    const container = listRef.current
    if (!container) return
    const node = container.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`)
    if (node) node.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open])

  if (!open) return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((i) => Math.min(flatItems.length - 1, i + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const target = flatItems[activeIndex]
      if (target && !target.item.disabled) {
        target.item.onSelect()
        onClose()
      }
    } else if (event.key === "Escape") {
      event.preventDefault()
      onClose()
    }
  }

  // Group filtered results back under their sections for rendering.
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    flatItems.forEach(({ section, item }) => {
      if (!map.has(section)) map.set(section, [])
      map.get(section)!.push(item)
    })
    return map
  }, [flatItems])

  let runningIndex = -1

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-background/70 backdrop-blur-sm pt-20 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type to find a setting, action, or section…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground md:inline-block">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {flatItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            Array.from(grouped.entries()).map(([sectionLabel, items]) => (
              <div key={sectionLabel}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {sectionLabel}
                </div>
                {items.map((item) => {
                  runningIndex += 1
                  const isActive = runningIndex === activeIndex
                  return (
                    <button
                      key={item.id}
                      data-cmd-index={runningIndex}
                      onClick={() => {
                        if (item.disabled) return
                        item.onSelect()
                        onClose()
                      }}
                      onMouseEnter={() => setActiveIndex(runningIndex)}
                      disabled={item.disabled}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] transition-colors ${
                        item.disabled
                          ? "cursor-not-allowed text-muted-foreground/40"
                          : isActive
                            ? "bg-accent text-foreground"
                            : "text-foreground hover:bg-accent/60"
                      }`}
                    >
                      <span className="flex flex-col">
                        <span>{item.label}</span>
                        {item.hint && (
                          <span className="text-[10px] text-muted-foreground">{item.hint}</span>
                        )}
                      </span>
                      {item.shortcut && (
                        <kbd className="ml-2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
