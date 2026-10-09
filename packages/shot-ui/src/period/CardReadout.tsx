"use client"

import type { CardValue, PeriodCard, TrendPoint } from "@vereinsheim/shot-core/analysis"
import type { MetricDefinition } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { formatDateOnly, formatShortDay } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue, unitText } from "../format"
import { groupView } from "../geometry"
import { hasPosition, probeOnlyAsMatch } from "../shots"
import { MiniTarget } from "../target/MiniTarget"

export interface CardReadoutProps {
  card: PeriodCard
  target: TargetImage
  /** Wert der Kennzahl des Verlaufs; null: die Scheibe hat keinen */
  value: CardValue | null
  /** ihr Punkt im Verlauf (Formband) */
  point: TrendPoint | null
  /** Abstand zum Schnitt der Scheiben davor (`PeriodModel.deltas`); fehlt bei der ersten */
  delta: { delta: number; n: number } | undefined
  metric: Readonly<MetricDefinition>
  timeZone: string
  /** gewählt oder, ohne Wahl, die neueste */
  chosen: boolean
  onOpen: (id: string) => void
  className?: string
}

const isProbeOnly = (card: PeriodCard) =>
  card.shots.length > 0 && card.shots.every((s) => s.kind === "probe")

/** „Training“, „Wettkampf“, „Training nur Probe“ */
export const cardKindText = (card: PeriodCard) =>
  card.kind === "competition" ? "Wettkampf" : isProbeOnly(card) ? "Training nur Probe" : "Training"

/** „+0,03 zum Schnitt der 5 Scheiben davor“, „… der Scheibe davor“ */
export function deltaText(delta: { delta: number; n: number }, decimals: number): string {
  const before = delta.n === 1 ? "der Scheibe davor" : `der ${delta.n} Scheiben davor`
  return `${formatSigned(delta.delta, decimals)} zum Schnitt ${before}`
}

/** die Schüsse, die die kleine Scheibe zeigt: die Wertung, bei nur Probe die Probe wie Wertung */
const shownShots = (card: PeriodCard) =>
  isProbeOnly(card) ? probeOnlyAsMatch(card.shots) : card.shots.filter((s) => s.kind === "match")

/**
 * Ablesung einer Scheibe auf der Seite eines Zeitraums (Plan L3, D9): Datum und Art, der Wert der Kennzahl, die
 * Schusszahl, der Abstand zum Schnitt der bis zu fünf Scheiben davor (ohne sie selbst, Prüfung 9. Oktober 2026),
 * ob sie im Formband liegt, die kleine Scheibe der Wertung und „Scheibe öffnen“.
 */
export function CardReadout({
  card,
  target,
  value,
  point,
  delta,
  metric,
  timeZone,
  chosen,
  onOpen,
  className,
}: CardReadoutProps) {
  const shots = shownShots(card)
  const placed = shots.filter(hasPosition)
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
          <p>{`${shots.length} Schuss${isProbeOnly(card) ? " (Probe als Training)" : ""}`}</p>
          {value && (
            <p data-delta className="tabular-nums">
              {delta ? deltaText(delta, metric.decimals) : "erste Scheibe, kein Schnitt davor"}
            </p>
          )}
          {inBand !== null && (
            <p data-in-band={inBand}>
              {inBand ? "liegt im Formband" : "liegt außerhalb des Formbands"}
            </p>
          )}
        </div>
        {placed.length > 0 ? (
          <MiniTarget
            target={target}
            view={groupView(
              target,
              placed.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
            )}
            shots={placed}
          />
        ) : (
          <p className="text-[13px] text-muted-foreground">ohne Lage</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpen(card.id)}
        className="justify-self-start cursor-pointer rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
      >
        Scheibe öffnen
      </button>
    </div>
  )
}

/**
 * Ablesezeile für das Telefon unter dem Verlauf (D9): „12.07. · 10,21 · +0,03 zum Schnitt“ und „Scheibe öffnen“.
 */
export function CardLine({
  card,
  value,
  delta,
  metric,
  timeZone,
  onOpen,
  className,
}: Pick<CardReadoutProps, "card" | "value" | "delta" | "metric" | "timeZone" | "onOpen"> & {
  className?: string
}) {
  const parts = [
    formatShortDay(new Date(card.startedAtMs), timeZone),
    value ? formatValue(value.value, metric.decimals) : "ohne Wert",
    ...(value && delta ? [`${formatSigned(delta.delta, metric.decimals)} zum Schnitt`] : []),
  ]
  return (
    <div
      data-card-line={card.id}
      className={cn("flex items-center justify-between gap-3 text-[13px]", className)}
    >
      <span className="min-w-0 font-medium text-foreground-2 tabular-nums">
        {parts.join(" · ")}
      </span>
      <button
        type="button"
        onClick={() => onOpen(card.id)}
        className="shrink-0 cursor-pointer rounded font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Scheibe öffnen
      </button>
    </div>
  )
}
