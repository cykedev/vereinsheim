"use client"

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"

import { formatValue } from "../format"
import { scoreColor } from "../geometry"
import type { ViewState } from "../view-state"
import { readoutDetail, readoutModel, readoutValue } from "./readout"

export interface ShotReadoutProps {
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  state: ViewState
  className?: string
}

const mm = (um: number) => `${formatValue(um / 1000, 2)} mm`

/**
 * Ablesung (spiegel-ui-design): der angetippte oder letzte Schuss, kompakt in einer Zeile: der Wert groß mit der
 * Ringwert-Farbe als Punkt, daneben die andere Wertung, Teiler und Abstand zur Mitte (gemessen vor der Lage).
 * Ohne x/y: Abstand und Teiler sagen dasselbe lesbarer (User, 8. Oktober 2026). Ein Wechsel wird
 * Screenreadern gemeldet.
 */
export function ShotReadout({ shots, state, className }: ShotReadoutProps) {
  const model = readoutModel(shots, state)
  if (!model) {
    return (
      <section aria-live="polite" aria-label="Ablesung" className={className}>
        <p className="text-muted-foreground">Noch kein Schuss.</p>
      </section>
    )
  }
  const { shot, label, chosen, distanceUm: distance, teiler } = model
  return (
    <section aria-live="polite" aria-label="Ablesung" className={cn("grid gap-2", className)}>
      <p className="text-[13px] text-muted-foreground">
        {`Schuss ${label} · ${chosen ? "angetippt" : "letzter Schuss"}`}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Wert in Schriftfarbe, die Ringwert-Farbe als Punkt davor: Gold und Türkis hätten als Schrift auf
            Weiß zu wenig Kontrast */}
        <p className="flex items-center gap-3">
          {shot.ring !== null && (
            <span
              aria-hidden="true"
              className="inline-block size-4 shrink-0 rounded-full"
              style={{ background: scoreColor(shot.ring) }}
            />
          )}
          <span className="font-display text-5xl leading-none font-bold tabular-nums">
            {readoutValue(model)}
          </span>
        </p>
        <div className="grid gap-1 text-[13px]">
          <p className="text-foreground-2">{readoutDetail(shot)}</p>
          {distance !== null && (
            <dl className="flex flex-wrap gap-x-4 gap-y-1">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Teiler</dt>
                <dd className="font-semibold tabular-nums">{formatValue(teiler as number, 1)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Abstand zur Mitte</dt>
                <dd className="font-semibold tabular-nums">{mm(distance)}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
