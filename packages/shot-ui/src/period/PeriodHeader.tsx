"use client"

import { cn } from "@vereinsheim/lib/utils"
import { Fragment, type ReactNode } from "react"

import { CardFilters } from "../controls/CardFilters"
import { HelpButton } from "../help/HelpButton"
import { PAGE_COLUMNS } from "../layout/columns"
import type { DateRange, NamedPeriod } from "./calendar"
import { PeriodPicker } from "./PeriodPicker"
import { usePeriodWords } from "./PeriodWords"
import type { PeriodAction, PeriodState } from "./state"
import { countOf, warmupCountText } from "./words"

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
  /** der Schalter „Einschießen mitzählen“ im Blatt „Filter“ (Vorgabe ja) */
  warmupSwitch?: boolean
  /** „Vergleichen mit“ im Blatt „Filter“ (Vorgabe ja); Spiegel vergleicht auf eigener Seite */
  withCompare?: boolean
}

/**
 * Filter im Kopf der Seite eines Zeitraums in einer Zeile: die Familie als Segment, sie wechselt man am
 * häufigsten, dann der Chip, der das Blatt „Filter“ öffnet (Zeitraum, Vergleich, Art, Einschießen).
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
  warmupSwitch,
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
        includeWarmup={state.includeWarmup}
        compareLabel={compareRange?.label ?? null}
        range={range}
        named={named}
        timeZone={timeZone}
        // eine Aktion für das ganze Blatt
        onApply={(filters) => dispatch({ type: "setFilters", filters })}
        warmupSwitch={warmupSwitch}
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

/**
 * Zahl der Scheiben im Kopf eines Zeitraums. Nicht gezähltes Einschießen steht mit seinem „?“ als eine Einheit da, die
 * nur als Ganzes umbricht; sonst stand das „?“ am Telefon am Anfang der nächsten Zeile vor dem Zeitraum
 */
export function PeriodCount({
  cards,
  warmup,
  onHelp,
}: {
  cards: number
  warmup: number
  onHelp: () => void
}) {
  const words = usePeriodWords()
  return (
    <span data-period-count>
      {countOf(cards, words)}
      {warmup > 0 && (
        <>
          {", "}
          <span data-period-warmup className="whitespace-nowrap">
            {warmupCountText(warmup)}
            <HelpButton
              label="Einschießen"
              helpId="einschiessen"
              onClick={onHelp}
              className="ml-1 align-middle"
            />
          </span>
        </>
      )}
    </span>
  )
}

export interface PeriodHeaderProps {
  /** Name des Zeitraums */
  title: string
  /** Familie, Zahl der Scheiben (auch mit „?“), Tage; mit „·“ verbunden */
  meta: readonly ReactNode[]
  /** Filter (`PeriodControls`) */
  controls: ReactNode
  /** das Ergebnis (`PeriodResult`), nur auf dem Telefon hier; ohne Scheiben null */
  result: ReactNode
  /** ein Satz zum Zeitraum (`periodSentence`); null: keiner */
  sentence: string | null
  /** ein Weg hinter dem Satz, in Spiegel „Genauer vergleichen“ auf die Seite Vergleichen */
  sentenceAction?: ReactNode
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
  sentenceAction,
  className,
}: PeriodHeaderProps) {
  return (
    <div data-period-header className={cn("grid gap-3", PAGE_COLUMNS, className)}>
      <div className="grid min-w-0 content-start gap-1 md:col-start-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
          {title}
        </h1>
        {meta.length > 0 && (
          <p className="text-[13px] text-muted-foreground">
            {/* umgebrochen wird nur zwischen den Teilen; ein Text bleibt beisammen („26.09.2026 – 29.10.2026“), ein
                Knoten bestimmt selbst, wo er umbricht (`PeriodCount`) */}
            {meta.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                {typeof part === "string" ? (
                  <span className="whitespace-nowrap">{part}</span>
                ) : (
                  part
                )}
              </Fragment>
            ))}
          </p>
        )}
      </div>
      <div className="min-w-0 md:col-span-2">{controls}</div>
      {result && <div className="md:hidden">{result}</div>}
      {sentence && (
        <p
          data-sentence
          className="max-w-[46rem] text-[14px] leading-relaxed text-foreground-2 md:col-start-1"
        >
          {sentence}
          {sentenceAction && <> {sentenceAction}</>}
        </p>
      )}
    </div>
  )
}
