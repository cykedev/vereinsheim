"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { CardFilters } from "../controls/CardFilters"
import { PAGE_COLUMNS } from "../layout/columns"
import type { DateRange, NamedPeriod } from "./calendar"
import { PeriodPicker } from "./PeriodPicker"
import type { PeriodAction, PeriodState } from "./state"

export interface PeriodControlsProps {
  state: PeriodState
  dispatch: (action: PeriodAction) => void
  range: DateRange
  compareRange: DateRange | null
  named: readonly NamedPeriod[]
  timeZone: string
  /** Disziplin-Familien, die es gibt (Pflicht) */
  families: readonly { value: string; label: string }[]
  /**
   * weitere Chips in der Zeile der Filter, nach dem Chip „Filter“, wie in der Liste (in der App die Wertung der Familie
   * als Wechsel-Chip)
   */
  actions?: ReactNode
  /** der Schalter „Trainings nur aus Probe mitzählen“ im Blatt „Filter“ (Vorgabe ja) */
  probeOnlySwitch?: boolean
  /** „Vergleichen mit“ im Blatt „Filter“ (Vorgabe ja); Spiegel vergleicht auf eigener Seite */
  withCompare?: boolean
}

/**
 * Filter im Kopf der Seite eines Zeitraums in einer Zeile: die Familie als Segment, sie wechselt man am
 * häufigsten, dann der Chip, der das Blatt „Filter“ öffnet (Zeitraum, Vergleich, Art, Trainings nur aus Probe).
 */
export function PeriodControls({
  state,
  dispatch,
  range,
  compareRange,
  named,
  timeZone,
  families,
  actions,
  probeOnlySwitch,
  withCompare,
}: PeriodControlsProps) {
  return (
    <div data-period-controls className="flex flex-wrap items-center gap-2">
      <CardFilters
        family={state.family}
        families={families}
        onFamily={(family) => dispatch({ type: "setFamily", family })}
      />
      <PeriodPicker
        choice={state.choice}
        compare={state.compare}
        kind={state.kind}
        includeProbeOnly={state.includeProbeOnly}
        compareLabel={compareRange?.label ?? null}
        range={range}
        named={named}
        timeZone={timeZone}
        // eine Aktion für das ganze Blatt
        onApply={(filters) => dispatch({ type: "setFilters", filters })}
        probeOnlySwitch={probeOnlySwitch}
        withCompare={withCompare}
      />
      {actions && (
        <div data-period-actions className="flex items-center gap-1.5">
          {actions}
        </div>
      )}
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
 * Kopf der Seite eines Zeitraums im Raster der Seite wie `CardHeader`: Titel und Metazeile, die
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
