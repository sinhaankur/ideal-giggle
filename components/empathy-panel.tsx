"use client"

import { MessageSquare, Brain, HandMetal, Heart } from "lucide-react"
import type { EmpathyData } from "@/lib/companion-types"

interface EmpathyPanelProps {
  data: EmpathyData
}

const quadrants = [
  {
    key: "says" as const,
    label: "Says",
    icon: MessageSquare,
    emptyText: "Listening for direct expressions...",
  },
  {
    key: "thinks" as const,
    label: "Thinks",
    icon: Brain,
    emptyText: "Inferring beliefs and thoughts...",
  },
  {
    key: "does" as const,
    label: "Does",
    icon: HandMetal,
    emptyText: "Observing actions and behaviors...",
  },
  {
    key: "feels" as const,
    label: "Feels",
    icon: Heart,
    emptyText: "Recognizing emotional signals...",
  },
]

export function EmpathyPanel({ data }: EmpathyPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Brain className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Empathy Map
        </span>
      </div>

      {/* Quadrant Grid */}
      <div className="grid flex-1 grid-cols-2 gap-3">
        {quadrants.map(({ key, label, icon: Icon, emptyText }) => (
          <div
            key={key}
            className="flex flex-col border border-border bg-card p-3"
          >
            <div className="mb-2 flex items-center gap-1.5 border-b border-border pb-1.5">
              <Icon className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground">
                {label}
              </span>
              {data[key].length > 0 && (
                <span className="ml-auto text-[8px] text-muted-foreground">
                  {data[key].length}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {data[key].length === 0 ? (
                <p className="text-center text-[9px] italic leading-relaxed text-muted-foreground/40">
                  {emptyText}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data[key].map((item, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-muted-foreground/20 bg-background px-2 py-1 text-[10px] leading-relaxed text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="border border-border bg-card p-3">
        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          Analysis Summary
        </div>
        <div className="grid grid-cols-4 gap-2">
          {quadrants.map(({ key, label }) => (
            <div key={key} className="text-center">
              <div className="text-sm font-bold text-foreground">{data[key].length}</div>
              <div className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
