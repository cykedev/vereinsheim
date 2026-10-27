"use client"

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import {
  inScoring,
  metricByKey,
  sumsResult,
  sumsShots,
  summaryValue,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import type { CardDetail } from "@vereinsheim/shot-core/projection"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import {
  CENTER_ONLY_NOTE,
  emptyText,
  missingSentence,
  REASON_TEXT,
  summaryReasons,
  type CardProvenance,
  type DetailLevel,
} from "../detail"
import { formatValue } from "../format"
import { HelpButton } from "../help/HelpButton"
import { SumSeries } from "../series/SumSeries"

/** was die Seite ohne Einzelschüsse von der Scheibe braucht: ihre Summen und ihre Herkunft */
type SummaryCard = Pick<PeriodCard, "sums"> & { provenance?: CardProvenance }

export interface SummaryResultProps {
  card: SummaryCard
  detail: CardDetail
  /** Serien-Summen, Gesamtergebnis oder nichts; mit Schüssen zeigt die Seite `CardResult` */
  level: Exclude<DetailLevel, "shots">
  scoring: Scoring
  /** Kreise (Art, Wertung) rechts in der Zeile der großen Zahl */
  actions?: ReactNode
  /** ein Hinweis unten, etwa ein Fehler beim Speichern */
  notice?: ReactNode
  /** öffnet die Erklärung „Grundlage und Herkunft“; ohne kein „?“ */
  onHelp?: (id: string) => void
  className?: string
}

/**
 * Ergebnis einer Scheibe ohne Einzelschüsse, aufgebaut wie `CardResult`: groß aus den Summen in der Wertung, darunter
 * Schusszahl und Ø je Schuss, dann der Grund („nur Serien-Summen“, „ohne Zehntel“). Ohne Werte ein Strich mit „wartet
 * auf die Anlage“ bzw. „ohne Werte“. Auf dem Telefon im Kopf, ab 768 px oben in `CardSummary`.
 */
export function SummaryResult({
  card,
  detail,
  level,
  scoring,
  actions,
  notice,
  onHelp,
  className,
}: SummaryResultProps) {
  const result = level === "none" ? null : sumsResult(card.sums, scoring)
  const mean = summaryValue(inScoring(metricByKey("result.decimalMean")!, scoring), card.sums)
  const reasons =
    level === "none"
      ? [card.provenance === "printout" ? REASON_TEXT.waiting : REASON_TEXT.noValues]
      : summaryReasons(detail, level)
  return (
    <div className={cn("grid content-start gap-3", className)}>
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p data-result className="font-display text-[2.6rem] leading-none font-bold tabular-nums">
            {result === null ? "–" : formatValue(result.tenths / 10, scoring === "rings" ? 0 : 1)}
            {result !== null && (
              <small className="ml-2 font-sans text-[15px] font-medium text-muted-foreground">
                Ringe
              </small>
            )}
          </p>
          {actions && (
            <div data-result-actions className="ml-auto flex shrink-0 items-center gap-1.5">
              {actions}
            </div>
          )}
        </div>
        {level !== "none" && (
          <p className="text-[13px] text-muted-foreground">
            {[
              `${sumsShots(card.sums)} Schuss`,
              mean ? `Ø ${formatValue(mean.value, 2)} je Schuss` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p
          data-summary-reason
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
        >
          {reasons.join(" · ")}
          {onHelp && (
            <HelpButton
              label="Grundlage und Herkunft"
              helpId="grundlage"
              onClick={() => onHelp("grundlage")}
            />
          )}
        </p>
      </div>
      {notice}
    </div>
  )
}

/** kleines goldenes Kreuz wie auf der Scheibe, für die Zeile neben der Trefferlage als Summe */
function GoldCross() {
  return (
    <svg viewBox="-6 -6 12 12" aria-hidden="true" className="size-3 shrink-0">
      <path d="M-5 0H5M0-5V5" stroke="var(--gold)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export interface CardSummaryProps {
  /** das Ergebnis (`SummaryResult`): ab 768 px oben in der Box, auf dem Telefon steht es im Kopf */
  result: ReactNode
  level: Exclude<DetailLevel, "shots">
  card: SummaryCard
  detail: CardDetail
  scoring: Scoring
  /** Platz für den Ausdruck (PDF und ID vom Ausdruck), am Ende der Box */
  printout?: ReactNode
  className?: string
}

/**
 * Die Box neben der Scheibe ohne Einzelschüsse (`CardPage` mit `empty`): oben das Ergebnis, bei Serien-Summen die
 * Serien als Kacheln, dann ein Satz, was fehlt, bei einer Trefferlage als Summe der Hinweis zum goldenen Kreuz. Ohne
 * Werte statt dessen ein Satz, wann sie kommen.
 */
export function CardSummary({
  result,
  level,
  card,
  detail,
  scoring,
  printout,
  className,
}: CardSummaryProps) {
  return (
    <div
      data-card-summary={level}
      className={cn(
        "grid content-start gap-4 rounded-2xl border border-border bg-card p-5",
        className
      )}
    >
      <div className="max-md:hidden">{result}</div>
      {level === "series" && card.sums && <SumSeries series={card.sums.series} scoring={scoring} />}
      <div className="grid gap-1.5">
        <p data-summary-missing className="text-[13px] text-muted-foreground">
          {level === "none" ? emptyText(card.provenance) : missingSentence(detail)}
        </p>
        {level !== "none" && detail.center?.from === "summary" && (
          <p
            data-center-note
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            <GoldCross />
            {CENTER_ONLY_NOTE}
          </p>
        )}
      </div>
      {printout}
    </div>
  )
}
