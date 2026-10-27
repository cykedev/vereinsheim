"use client"

import { formatDateOnly, formatInteger } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue } from "../format"
import { HelpButton } from "../help/HelpButton"
import { basisLine } from "./basis"
import type { PeriodModel } from "./model"
import { usePeriodWords } from "./PeriodWords"
import { verdictText } from "./sentence"
import { countOf } from "./words"

export interface PeriodResultProps {
  model: Pick<PeriodModel, "summary" | "comparison" | "compareRange" | "compareShared"> &
    Partial<Pick<PeriodModel, "basis">>
  timeZone: string
  onHelp?: (id: string) => void
  className?: string
}

/**
 * Ergebnis-Box der Seite eines Zeitraums, wie `CardResult`: Ø je Schuss über alle Wertungsschüsse ([[adr-034]])
 * groß, darunter Scheiben und Wertungsschüsse und die beste Scheibe unter der häufigsten Schusszahl; mit Vergleich
 * der Unterschied mit Urteil („deutlich“ nur neben einem Urteil). Zählen nicht alle Scheiben, nennt eine Zeile die
 * Grundlage. Auf dem Telefon im Kopf, ab 768 px als Box.
 */
export function PeriodResult({ model, timeZone, onHelp, className }: PeriodResultProps) {
  const { summary, comparison, compareRange, compareShared, basis } = model
  const best = summary.best
  const words = usePeriodWords()
  return (
    <div className={cn("grid content-start gap-3", className)}>
      <div className="grid gap-1">
        <p
          data-period-result
          className="font-display text-[2.6rem] leading-none font-bold tabular-nums"
        >
          {summary.mean === null ? "–" : formatValue(summary.mean, 2)}
          {summary.mean !== null && (
            <small className="ml-2 font-sans text-[15px] font-medium text-muted-foreground">
              Ringe Ø je Schuss
            </small>
          )}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {summary.cards
            ? `${countOf(summary.cards, words)} · ${formatInteger(summary.shots)} Wertungsschüsse`
            : `keine ${words.one} mit Wert`}
        </p>
        {basis && (
          <p
            data-period-basis
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            {basisLine(basis, words)}
            {onHelp && (
              <HelpButton
                label="Grundlage und Herkunft"
                helpId="grundlage"
                onClick={() => onHelp("grundlage")}
              />
            )}
          </p>
        )}
        {best && (
          <p data-best className="text-[13px]">
            <span className="text-muted-foreground">{`beste ${words.one} zu ${best.shots} Schuss `}</span>
            <span className="font-semibold tabular-nums">{formatValue(best.value, 2)}</span>
            <span className="text-muted-foreground">{` am ${formatDateOnly(new Date(best.atMs), timeZone)}`}</span>
          </p>
        )}
        {compareRange && (
          <div data-comparison className="flex items-start justify-between gap-2 text-[13px]">
            <p>
              {comparison ? (
                <>
                  <span className="font-semibold tabular-nums">
                    {formatSigned(comparison.delta, 2)}
                  </span>
                  {` gegen ${compareRange.label} · `}
                  <span className="font-semibold">{verdictText(comparison, "higher", words)}</span>
                </>
              ) : (
                `gegen ${compareRange.label}: zu wenige ${words.many}`
              )}
            </p>
            {onHelp && (
              <HelpButton
                label="Zwei Zeiträume im Vergleich"
                helpId="zeitraum-vergleich"
                onClick={() => onHelp("zeitraum-vergleich")}
              />
            )}
          </div>
        )}
        {compareRange && compareShared > 0 && (
          <p data-compare-shared className="text-[12.5px] text-muted-foreground">
            {`${countOf(compareShared, words)} ${compareShared === 1 ? "liegt" : "liegen"} in beiden Zeiträumen und ${compareShared === 1 ? "zählt" : "zählen"} nur hier.`}
          </p>
        )}
      </div>
    </div>
  )
}
