"use client"

import type { CardValue, TrendPoint } from "@vereinsheim/shot-core/analysis"
import type { MarkShot, ProjectedCard } from "@vereinsheim/shot-core/projection"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { formatDateOnly, formatShortDay } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue, unitText } from "../format"
import { groupView } from "../geometry"
import { RouteLink } from "../nav/RouteLink"
import type { CardRoute } from "../nav/routes"
import { HelpButton } from "../help/HelpButton"
import { MiniTarget } from "../target/MiniTarget"
import { KIND_TEXT } from "../list/KindMark"
import { cardKind, isProbeOnly, type PeriodMetric } from "./model"

export interface CardReadoutProps {
  card: ProjectedCard
  /**
   * die Lagen der Scheibe für die kleine Scheibe (`markShots(cardMarks(…))`); leer: „ohne Lage“; null: sie laden noch
   * (die App holt sie zu einer neuen Wahl nach), ein leerer Platz gleicher Größe
   */
  marks: readonly MarkShot[] | null
  target: TargetImage
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
  /** die Adresse einer Scheibe aus diesem Fortschritt (`openCard` mit ihm als Herkunft) */
  cardRoute: (id: string) => CardRoute
  /** „?“ am Abstand zum Schnitt davor (U2, D2); ohne kein „?“ */
  onHelp?: (id: string) => void
  className?: string
}

/**
 * Das „?“ am Abstand erklärt den Abstand im Ø je Schuss (Thema „Abstand zum Schnitt davor“); zeigt der Verlauf eine
 * andere Kennzahl, gilt die Erklärung nicht (Review U2)
 */
/** die Erklärung gilt dem Ø je Schuss, in Zehnteln und in ganzen Ringen (beide Wertungen sind immer umschaltbar) */
const explainsDelta = (metric: PeriodMetric) =>
  metric.key === "result.decimalMean" || metric.key === "result.ringsMean"

/** „Training“, „Wettkampf“, „Training nur Probe“ */
export const cardKindText = (card: ProjectedCard) => KIND_TEXT[cardKind(card)]

/** „+0,03 zum Schnitt der 5 Scheiben davor“, „… der Scheibe davor“ */
export function deltaText(delta: { delta: number; n: number }, decimals: number): string {
  const before = delta.n === 1 ? "der Scheibe davor" : `der ${delta.n} Scheiben davor`
  return `${formatSigned(delta.delta, decimals)} zum Schnitt ${before}`
}

/**
 * Ablesung einer Scheibe auf der Seite eines Zeitraums (Plan L3, D9): Datum und Art, der Wert der Kennzahl, die
 * Schusszahl, der Abstand zum Schnitt der bis zu fünf Scheiben davor (ohne sie selbst, Prüfung 9. Oktober 2026),
 * ob sie im Formband liegt, die kleine Scheibe der Wertung und „Scheibe öffnen“.
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
  cardRoute,
  onHelp,
  className,
}: CardReadoutProps) {
  const unit = unitText(metric.unit)
  const band = point?.band ?? null
  const inBand = band && value ? value.value >= band.low && value.value <= band.high : null
  return (
    <div data-card-readout={card.id} className={cn("grid gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-bold">
          {chosen ? "Gewählte Scheibe" : "Neueste Scheibe"}
        </h3>
        <span className="text-[13px] text-muted-foreground">
          {`${formatDateOnly(new Date(card.startedAtMs), timeZone)} · ${cardKindText(card)}`}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] items-start gap-4">
        <div className="grid min-w-0 content-start gap-1 text-[13px]">
          <p className="font-display text-[1.6rem] leading-none font-bold tabular-nums">
            {value ? formatValue(value.value, metric.decimals) : "–"}
            {value && unit && (
              <small className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">
                {unit}
              </small>
            )}
          </p>
          <p className="text-muted-foreground">
            {value ? metric.label : `${metric.label}: ohne Wert`}
          </p>
          <p>{`${card.projection.printedShots} Schuss${isProbeOnly(card) ? " (Probe als Training)" : ""}`}</p>
          {value && (
            <div className="flex items-start justify-between gap-2">
              <p data-delta className="tabular-nums">
                {delta ? deltaText(delta, metric.decimals) : "erste Scheibe, kein Schnitt davor"}
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
        {marks === null ? (
          <span
            aria-hidden="true"
            data-marks-loading="true"
            className="block aspect-square w-full"
          />
        ) : marks.length > 0 ? (
          <MiniTarget target={target} view={groupView(target, marks)} shots={marks} />
        ) : (
          <p className="text-[13px] text-muted-foreground">ohne Lage</p>
        )}
      </div>
      <RouteLink
        route={cardRoute(card.id)}
        className="justify-self-start cursor-pointer rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
      >
        Scheibe öffnen
      </RouteLink>
    </div>
  )
}

/**
 * Ablesezeile für das Telefon unter dem Verlauf (D9): „12.07. · 10,21 · +0,03 zum Schnitt davor“ und „Scheibe
 * öffnen“.
 */
export function CardLine({
  card,
  value,
  delta,
  metric,
  timeZone,
  cardRoute,
  onHelp,
  className,
}: Pick<
  CardReadoutProps,
  "card" | "value" | "delta" | "metric" | "timeZone" | "cardRoute" | "onHelp"
> & {
  className?: string
}) {
  const parts = [
    formatShortDay(new Date(card.startedAtMs), timeZone),
    value ? formatValue(value.value, metric.decimals) : "ohne Wert",
    ...(value && delta ? [`${formatSigned(delta.delta, metric.decimals)} zum Schnitt davor`] : []),
  ]
  return (
    <div
      data-card-line={card.id}
      className={cn("flex items-center justify-between gap-3 text-[13px]", className)}
    >
      <span className="flex min-w-0 items-center gap-1 font-medium text-foreground-2 tabular-nums">
        <span className="min-w-0">{parts.join(" · ")}</span>
        {/* das „?“ am Abstand auch auf dem Telefon, wo die Ablesung als Karte fehlt (Review U2) */}
        {onHelp && value && delta && explainsDelta(metric) && (
          <HelpButton
            label="Abstand zum Schnitt davor"
            helpId="gegen-den-schnitt"
            onClick={() => onHelp("gegen-den-schnitt")}
          />
        )}
      </span>
      <RouteLink
        route={cardRoute(card.id)}
        className="shrink-0 cursor-pointer rounded font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Scheibe öffnen
      </RouteLink>
    </div>
  )
}
