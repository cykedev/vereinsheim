import { formatDateOnly, formatInteger } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { formatSigned, formatValue } from "../format"
import { HelpButton } from "../help/HelpButton"
import type { PeriodModel } from "./model"
import { verdictText } from "./sentence"

export interface PeriodResultProps {
  model: Pick<PeriodModel, "summary" | "comparison" | "compareRange" | "compareShared">
  timeZone: string
  /** Umschalter ganze Ringe/Zehntel; im Fortschritt seit U2 keiner, er zeigt die Wertung des Geräts (D4) */
  scoring?: ReactNode
  onHelp?: (id: string) => void
  className?: string
}

/**
 * Ergebnis-Box der Seite eines Zeitraums (Plan L3, D13), wie `CardResult`: Ø je Schuss als Mittel der Scheiben
 * groß, darunter Scheiben und Wertungsschüsse und die beste Scheibe unter der häufigsten Schusszahl; mit Vergleich
 * der Unterschied mit Urteil („bedeutsam“ nur neben einem Urteil). Auf dem Telefon im Kopf, ab 768 px als Box.
 */
export function PeriodResult({ model, timeZone, scoring, onHelp, className }: PeriodResultProps) {
  const { summary, comparison, compareRange, compareShared } = model
  const best = summary.best
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
            ? `${summary.cards} ${summary.cards === 1 ? "Scheibe" : "Scheiben"} · ${formatInteger(summary.shots)} Wertungsschüsse`
            : "keine Scheibe mit Wert"}
        </p>
        {best && (
          <p data-best className="text-[13px]">
            <span className="text-muted-foreground">{`beste Scheibe zu ${best.shots} Schuss `}</span>
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
                  <span className="font-semibold">{verdictText(comparison, "higher")}</span>
                </>
              ) : (
                `gegen ${compareRange.label}: zu wenige Scheiben`
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
            {`${compareShared} ${compareShared === 1 ? "Scheibe liegt" : "Scheiben liegen"} in beiden Zeiträumen und ${compareShared === 1 ? "zählt" : "zählen"} nur hier.`}
          </p>
        )}
      </div>
      {scoring}
    </div>
  )
}
