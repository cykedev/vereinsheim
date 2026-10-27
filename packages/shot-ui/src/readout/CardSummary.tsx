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

import { Dash } from "../Dash"
import {
  CENTER_ONLY_NOTE,
  levelReasons,
  REASON_TEXT,
  type CardProvenance,
  type DetailLevel,
} from "../detail"
import { formatValue } from "../format"
import { HelpButton } from "../help/HelpButton"
import { MpiMark } from "../target/MpiMark"
import { RESULT_FACTS } from "./CardResult"

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
 * Ergebnis einer Scheibe ohne Einzelschüsse, an derselben Stelle und gebaut wie `CardResult`: groß aus den Summen in der
 * Wertung, darunter Schusszahl und Ø je Schuss, der Grund („nur Serien-Summen“, „ohne Zehntel“), bei einer Trefferlage
 * als Summe der Hinweis zum Zeichen der Mitte, dann dieselben Kennzahlen wie bei Schüssen, hier „–“ mit Grund. Ohne
 * Werte ein Strich mit „wartet auf die Anlage“, „ohne Werte“ bzw. „noch kein Schuss“ und, wie bei null Schüssen, ohne
 * Kennzahlen. Auf dem Telefon im Kopf, ab 768 px als Box (`CardPage`).
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
  const reasons = levelReasons(detail, level, card.provenance)
  return (
    <div data-card-summary={level} className={cn("grid content-start gap-3", className)}>
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
        {level !== "none" && detail.center?.from === "summary" && (
          <p
            data-center-note
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            <CenterMark />
            {CENTER_ONLY_NOTE}
          </p>
        )}
        {level !== "none" && (
          <dl
            aria-label="Kennzahlen der Scheibe"
            className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]"
          >
            {RESULT_FACTS.map(([term, key]) => (
              <div key={key} className="flex gap-1.5">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="font-semibold tabular-nums">
                  <Dash reason={REASON_TEXT.sumsOnly} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {notice}
    </div>
  )
}

/** das Zeichen des Schwerpunkts klein, für die Zeile neben der Trefferlage als Summe (wie auf der Scheibe) */
function CenterMark() {
  return (
    <svg viewBox="-1.4 -1.4 2.8 2.8" aria-hidden="true" className="size-3.5 shrink-0">
      <MpiMark x={0} y={0} radius={1} decorative />
    </svg>
  )
}
