"use client"

import type { CardValue, TrendPoint } from "@vereinsheim/shot-core/analysis"
import type { MarkShot } from "@vereinsheim/shot-core/projection"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { formatDateOnly, formatShortDay } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue, unitText } from "../format"
import { HelpButton } from "../help/HelpButton"
import { MiniTarget } from "../target/MiniTarget"
import { KIND_TEXT } from "../list/KindMark"
import type { RenderItemLink } from "./links"
import { itemKind, type PeriodItem, type PeriodMetric } from "./model"
import { usePeriodWords } from "./PeriodWords"
import { CARD_WORDS, type PeriodWords } from "./words"

export interface CardReadoutProps {
  card: PeriodItem
  /**
   * die Lagen der Scheibe für die kleine Scheibe (`markShots(cardMarks(…))`); leer: „ohne Lage“; null: sie laden noch
   * (die App holt sie zu einer neuen Wahl nach), ein leerer Platz gleicher Größe
   */
  marks: readonly MarkShot[] | null
  /** das Scheibenbild der kleinen Scheibe; null: keine kleine Scheibe (Treffsicher kennt keine Lage je Schuss) */
  target: TargetImage | null
  /** Wert der Kennzahl des Verlaufs; null: die Scheibe hat keinen */
  value: CardValue | null
  /** ihr Punkt im Verlauf (Formband) */
  point: TrendPoint | null
  /** Abstand zum Schnitt der Scheiben davor (`PeriodModel.deltas`); fehlt bei der ersten */
  delta: { delta: number; n: number } | undefined
  metric: PeriodMetric
  timeZone: string
  /** gewählt oder, ohne Wahl, die neueste */
  chosen: boolean
  /** der Link „Scheibe öffnen“ (in Spiegel ein `RouteLink` mit `openCard` aus diesem Fortschritt) */
  renderLink: RenderItemLink
  /** „?“ am Abstand zum Schnitt davor; ohne kein „?“ */
  onHelp?: (id: string) => void
  /** warum die Scheibe keinen Wert der Kennzahl hat (`PeriodModel.reasons`); ohne „ohne Wert“ */
  reason?: string | null
  className?: string
}

/**
 * Das „?“ am Abstand erklärt den Abstand im Ø je Schuss (Thema „Abstand zum Schnitt davor“), in Zehnteln und in ganzen
 * Ringen (beide Wertungen sind immer umschaltbar); zeigt der Verlauf eine andere Kennzahl, gilt die Erklärung nicht
 */
const explainsDelta = (metric: PeriodMetric) =>
  metric.key === "result.decimalMean" || metric.key === "result.ringsMean"

/** „Training“, „Wettkampf“, „Training nur Probe“ */
export const cardKindText = (card: PeriodItem) => KIND_TEXT[itemKind(card)]

/** „+0,03 zum Schnitt der 5 Scheiben davor“, „… der Scheibe davor“ */
export function deltaText(
  delta: { delta: number; n: number },
  decimals: number,
  words: PeriodWords = CARD_WORDS
): string {
  const before = delta.n === 1 ? `der ${words.one} davor` : `der ${delta.n} ${words.many} davor`
  return `${formatSigned(delta.delta, decimals)} zum Schnitt ${before}`
}

/**
 * Ablesung einer Scheibe auf der Seite eines Zeitraums: Datum und Art, der Wert der Kennzahl, die Schusszahl, der
 * Abstand zum Schnitt der bis zu fünf Scheiben davor (ohne sie selbst), ob sie im Formband liegt, die kleine Scheibe
 * der Wertung und „Scheibe öffnen“.
 */
export function CardReadout({
  card,
  marks,
  target,
  value,
  point,
  delta,
  metric,
  timeZone,
  chosen,
  renderLink,
  onHelp,
  reason = null,
  className,
}: CardReadoutProps) {
  const words = usePeriodWords()
  const unit = unitText(metric.unit)
  const band = point?.band ?? null
  const inBand = band && value ? value.value >= band.low && value.value <= band.high : null
  return (
    <div data-card-readout={card.id} className={cn("grid gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-bold">
          {chosen ? `Gewählte ${words.one}` : `Neueste ${words.one}`}
        </h3>
        <span className="text-[13px] text-muted-foreground">
          {`${formatDateOnly(new Date(card.startedAtMs), timeZone)} · ${cardKindText(card)}`}
        </span>
      </div>
      <div className={cn("grid items-start gap-4", target && "grid-cols-[minmax(0,1fr)_96px]")}>
        <div className="grid min-w-0 content-start gap-1 text-[13px]">
          <p className="font-display text-[1.6rem] leading-none font-bold tabular-nums">
            {/* der Grund steht sichtbar darunter */}
            {value ? formatValue(value.value, metric.decimals) : "–"}
            {value && unit && (
              <small className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">
                {unit}
              </small>
            )}
          </p>
          <p className="text-muted-foreground">
            {value ? metric.label : `${metric.label}: ${reason ?? "ohne Wert"}`}
          </p>
          <p>{`${card.shots} Schuss${card.probeOnly ? " (Probe als Training)" : ""}`}</p>
          {value && (
            <div className="flex items-start justify-between gap-2">
              <p data-delta className="tabular-nums">
                {delta
                  ? deltaText(delta, metric.decimals, words)
                  : `erste ${words.one}, kein Schnitt davor`}
              </p>
              {onHelp && explainsDelta(metric) && (
                <HelpButton
                  label="Abstand zum Schnitt davor"
                  helpId="gegen-den-schnitt"
                  onClick={() => onHelp("gegen-den-schnitt")}
                />
              )}
            </div>
          )}
          {inBand !== null && (
            <p data-in-band={inBand}>
              {inBand ? "liegt im Formband" : "liegt außerhalb des Formbands"}
            </p>
          )}
        </div>
        {!target ? null : marks === null ? (
          <span
            aria-hidden="true"
            data-marks-loading="true"
            className="block aspect-square w-full"
          />
        ) : (
          // ohne Lagen je Schuss die Scheibe leise, wie die kleinen Scheiben gemessener Scheiben ohne Schwerpunkt
          <MiniTarget target={target} shots={marks} placeholder={!marks.length} />
        )}
      </div>
      {renderLink(card.id, {
        className:
          "justify-self-start cursor-pointer rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring",
        children: `${words.one} öffnen`,
      })}
    </div>
  )
}

/**
 * Ablesezeile für das Telefon unter dem Verlauf: „12.07. · 10,21 · +0,03 zum Schnitt davor“ und „Scheibe
 * öffnen“.
 */
export function CardLine({
  card,
  value,
  delta,
  metric,
  timeZone,
  renderLink,
  onHelp,
  reason = null,
  className,
}: Pick<
  CardReadoutProps,
  "card" | "value" | "delta" | "metric" | "timeZone" | "renderLink" | "onHelp" | "reason"
> & {
  className?: string
}) {
  const words = usePeriodWords()
  const parts = [
    formatShortDay(new Date(card.startedAtMs), timeZone),
    value ? formatValue(value.value, metric.decimals) : (reason ?? "ohne Wert"),
    ...(value && delta ? [`${formatSigned(delta.delta, metric.decimals)} zum Schnitt davor`] : []),
  ]
  return (
    <div
      data-card-line={card.id}
      className={cn("flex items-center justify-between gap-3 text-[13px]", className)}
    >
      <span className="flex min-w-0 items-center gap-1 font-medium text-foreground-2 tabular-nums">
        <span className="min-w-0">{parts.join(" · ")}</span>
        {/* das „?“ am Abstand auch auf dem Telefon, wo die Ablesung als Karte fehlt */}
        {onHelp && value && delta && explainsDelta(metric) && (
          <HelpButton
            label="Abstand zum Schnitt davor"
            helpId="gegen-den-schnitt"
            onClick={() => onHelp("gegen-den-schnitt")}
          />
        )}
      </span>
      {renderLink(card.id, {
        className:
          "shrink-0 cursor-pointer rounded font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring",
        children: `${words.one} öffnen`,
      })}
    </div>
  )
}
