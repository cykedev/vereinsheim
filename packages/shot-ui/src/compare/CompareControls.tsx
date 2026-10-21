"use client"

import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { CardFilters } from "../controls/CardFilters"
import {
  DEFAULT_COMPARE,
  DEFAULT_KIND_RANGE,
  type CompareQuery,
  type CompareType,
} from "../nav/routes"
import { SIDE_COLORS } from "./ComparePicture"
import { COMPARE_KINDS, COMPARE_TYPES } from "./words"

export type CompareSideKey = "a" | "b"

/** ein Chip einer Seite: Punkt in ihrer Farbe, ihr Name und der Pfeil, der das Blatt öffnet */
function SideChip({
  side,
  name,
  onClick,
}: {
  side: CompareSideKey | null
  name: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-compare-chip={side ?? "range"}
      onClick={onClick}
      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 py-1.5 text-[13px] leading-tight font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {side && (
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: SIDE_COLORS[side] }}
        />
      )}
      {side && <span className="sr-only">{side.toUpperCase()}: </span>}
      {name}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}

/**
 * Kopf der Seite Vergleichen: oben die Art des Vergleichs, darunter in einer Zeile die Familie, die Chips der Seiten A
 * und B, bei Wettkampf und Training ein Chip für den Zeitraum, bei zwei Zeiträumen die Art für beide Seiten und am Ende
 * `actions` (in der App die Wertung der Familie, wie im Fortschritt). Ein Wechsel der Art beginnt mit ihren Vorgaben,
 * bei zwei Scheiben mit den beiden neuesten der Familie (`newest`); ein Wechsel der Familie bei zwei Scheiben ebenso.
 */
export function CompareControls({
  query,
  family,
  families,
  names,
  newest,
  onQuery,
  onPick,
  actions,
  className,
}: {
  query: CompareQuery
  /** die Familie der Seite: gewählt, sonst die von Scheibe A */
  family: string
  families: readonly { value: string; label: string }[]
  /** Namen in den Chips; bei Wettkampf und Training nur `a` (der Zeitraum) */
  names: { a: string; b: string }
  /** die Ids der neuesten Scheiben der Familie, für den Wechsel auf zwei Scheiben */
  newest: readonly string[]
  onQuery: (query: CompareQuery) => void
  onPick: (side: CompareSideKey) => void
  /** weitere Chips am Ende der Zeile, wie `PeriodControls` (die Wertung der Familie) */
  actions?: ReactNode
  className?: string
}) {
  const changeType = (type: CompareType) => {
    if (type === query.type) return
    const probeOnly = query.type === "cards" ? true : query.includeProbeOnly
    if (type === "cards") onQuery({ type, family, a: newest[0] ?? null, b: newest[1] ?? null })
    // „Trainings nur aus Probe“ bleibt, wie der Fortschritt es mitgegeben hat
    else if (type === "kind")
      onQuery({ type, family, range: DEFAULT_KIND_RANGE, includeProbeOnly: probeOnly })
    else onQuery({ ...DEFAULT_COMPARE, family, includeProbeOnly: probeOnly } as CompareQuery)
  }
  return (
    <div data-compare-controls className={cn("grid gap-2.5", className)}>
      <Segmented
        label="Was vergleichen"
        options={COMPARE_TYPES}
        value={query.type}
        onChange={changeType}
        wrap
      />
      <div className="flex flex-wrap items-center gap-2">
        <CardFilters
          family={family}
          families={families}
          // zwei Scheiben einer anderen Familie: die Seite nimmt deren neueste zwei
          onFamily={(next) =>
            onQuery(
              query.type === "cards"
                ? { type: "cards", family: next, a: null, b: null }
                : { ...query, family: next }
            )
          }
        />
        {query.type === "kind" ? (
          <SideChip side={null} name={names.a} onClick={() => onPick("a")} />
        ) : (
          <>
            <SideChip side="a" name={names.a} onClick={() => onPick("a")} />
            <SideChip side="b" name={names.b} onClick={() => onPick("b")} />
          </>
        )}
        {query.type === "periods" && (
          <Segmented
            label="Art"
            options={COMPARE_KINDS}
            value={query.kind}
            onChange={(kind) => onQuery({ ...query, kind })}
          />
        )}
        {actions && (
          <div data-compare-actions className="flex items-center gap-1.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
