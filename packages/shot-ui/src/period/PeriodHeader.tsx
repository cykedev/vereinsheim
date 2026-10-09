"use client"

import { cn } from "@vereinsheim/lib/utils"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import type { ReactNode } from "react"

import { CardFilters } from "../controls/CardFilters"
import { PAGE_COLUMNS } from "../layout/columns"
import type { CompareChoice, DateRange, NamedPeriod } from "./calendar"
import { PeriodPicker } from "./PeriodPicker"
import type { PeriodAction, PeriodState } from "./state"

export interface PeriodControlsProps {
  state: PeriodState
  dispatch: (action: PeriodAction) => void
  range: DateRange
  compareRange: DateRange | null
  named: readonly NamedPeriod[]
  timeZone: string
  /** Disziplin-Familien, die es gibt (Pflicht, D5) */
  families: readonly { value: string; label: string }[]
}

/**
 * Filter im Kopf der Seite eines Zeitraums (D4–D6): der Zeitraum-Wähler, der Vergleich als Chip mit „×“, Familie,
 * Art und „mit Training nur aus Probe“. Bricht auf dem Telefon in mehrere Zeilen um.
 */
export function PeriodControls({
  state,
  dispatch,
  range,
  compareRange,
  named,
  timeZone,
  families,
}: PeriodControlsProps) {
  const clear: CompareChoice = { type: "none" }
  return (
    <div data-period-controls className="flex flex-wrap items-center gap-2">
      <PeriodPicker
        choice={state.choice}
        compare={state.compare}
        range={range}
        named={named}
        timeZone={timeZone}
        onApply={(choice, compare) => {
          if (JSON.stringify(choice) !== JSON.stringify(state.choice)) {
            dispatch({ type: "setChoice", choice })
          }
          dispatch({ type: "setCompare", compare })
        }}
      />
      {compareRange && (
        <span
          data-compare-chip
          className="inline-flex items-center gap-1 rounded-full border border-line-strong py-1 pr-1 pl-3 text-[13px] text-foreground-2"
        >
          {`mit ${compareRange.label}`}
          <button
            type="button"
            aria-label="Vergleich entfernen"
            onClick={() => dispatch({ type: "setCompare", compare: clear })}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </span>
      )}
      <CardFilters
        family={state.family}
        families={families}
        kind={state.kind}
        onFamily={(family) => dispatch({ type: "setFamily", family })}
        onKind={(kind) => dispatch({ type: "setKind", kind })}
      />
      <ToggleChip
        pressed={state.includeProbeOnly}
        onPressedChange={(include) => dispatch({ type: "setIncludeProbeOnly", include })}
      >
        mit Training nur aus Probe
      </ToggleChip>
    </div>
  )
}

export interface PeriodHeaderProps {
  /** Name des Zeitraums */
  title: string
  /** Familie, Zahl der Scheiben, Tage; mit „·“ verbunden */
  meta: readonly string[]
  /** Filter (`PeriodControls`) */
  controls: ReactNode
  /** das Ergebnis (`PeriodResult`), nur auf dem Telefon hier; ohne Scheiben null */
  result: ReactNode
  /** ein Satz zum Zeitraum (`periodSentence`); null: keiner */
  sentence: string | null
  className?: string
}

/**
 * Kopf der Seite eines Zeitraums (Plan L3, D4, D14) im Raster der Seite wie `CardHeader`: Titel und Metazeile, die
 * Filter, auf dem Telefon das Ergebnis, darunter ein Satz.
 */
export function PeriodHeader({
  title,
  meta,
  controls,
  result,
  sentence,
  className,
}: PeriodHeaderProps) {
  return (
    <div data-period-header className={cn("grid gap-3", PAGE_COLUMNS, className)}>
      <div className="grid min-w-0 content-start gap-1 md:col-start-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
          {title}
        </h1>
        {meta.length > 0 && <p className="text-[13px] text-muted-foreground">{meta.join(" · ")}</p>}
      </div>
      <div className="min-w-0 md:col-span-2">{controls}</div>
      {result && <div className="md:hidden">{result}</div>}
      {sentence && (
        <p
          data-sentence
          className="max-w-[46rem] text-[14px] leading-relaxed text-foreground-2 md:col-start-1"
        >
          {sentence}
        </p>
      )}
    </div>
  )
}
