"use client"

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { teilerFromDistanceUm } from "@vereinsheim/shot-core/scoring"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue } from "../format"
import { scoreColor } from "../geometry"
import { formatScore, hasValidPosition, shotDistance, shotLabels } from "../shots"
import type { ViewState } from "../view-state"

export interface ShotReadoutProps {
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  state: ViewState
  className?: string
}

const mm = (um: number) => `${formatValue(um / 1000, 2)} mm`
const signedMm = (um: number) => `${formatSigned(um / 1000, 2)} mm`

/** der angetippte Schuss, sonst der letzte; ein Antippen, das nicht mehr passt, zählt nicht */
function shownShot(shots: readonly MetricShot[], state: ViewState) {
  const chosen = state.chosen === null ? undefined : shots[state.chosen.index]
  if (chosen) return { shot: chosen, index: state.chosen!.index, chosen: true }
  if (!shots.length) return null
  return { shot: shots[shots.length - 1], index: shots.length - 1, chosen: false }
}

/** zweite Zeile: Fehlschuss oder die andere Wertung, dazu der Innenzehner */
function detail(shot: MetricShot, scoring: ViewState["scoring"]): string {
  const other =
    shot.ring === 0
      ? "Fehlschuss"
      : scoring === "rings"
        ? `${formatScore(shot, "decimal")} in Zehnteln`
        : `Ring ${shot.ring ?? "–"}`
  return `${other}${shot.innerTen ? " · Innenzehner" : ""}`
}

/**
 * Ablesung (spiegel-ui-design): der angetippte oder letzte Schuss mit Wert und Ringwert-Farbe als Punkt, der
 * anderen Wertung klein darunter, Teiler und Abstand zur Mitte (gemessen vor der Lage) und x/y.
 * Ein Wechsel wird Screenreadern gemeldet.
 */
export function ShotReadout({ shots, state, className }: ShotReadoutProps) {
  const shown = shownShot(shots, state)
  if (!shown) {
    return (
      <section aria-live="polite" aria-label="Ablesung" className={className}>
        <p className="text-muted-foreground">Noch kein Schuss.</p>
      </section>
    )
  }
  const { shot, index, chosen } = shown
  const label = shotLabels(shots)[index]
  // wie im Fachkern: gemessener Abstand vor der Lage, verdächtige Schüsse ohne Abstand und Lage (SF-15)
  const distance = shotDistance(shot)
  const placed = hasValidPosition(shot)
  return (
    <section aria-live="polite" aria-label="Ablesung" className={cn("grid gap-3", className)}>
      <p className="text-[13px] text-muted-foreground">
        {`${shot.kind === "probe" ? "Probe" : "Schuss"} ${label} · ${chosen ? "angetippt" : "letzter Schuss"}`}
      </p>
      {/* Wert in Schriftfarbe, die Ringwert-Farbe als Punkt davor: Gold und Türkis hätten als Schrift auf
          Weiß zu wenig Kontrast; die Probe hohl wie auf der Scheibe */}
      <p className="flex items-center gap-3">
        {shot.ring !== null && (
          <span
            aria-hidden="true"
            className="inline-block size-4 shrink-0 rounded-full"
            style={
              shot.kind === "probe"
                ? { boxShadow: `inset 0 0 0 2px ${scoreColor(shot.ring)}` }
                : { background: scoreColor(shot.ring) }
            }
          />
        )}
        <span className="font-display text-5xl leading-none font-bold tabular-nums">
          {formatScore(shot, state.scoring)}
        </span>
      </p>
      <p className="text-[13px] text-foreground-2">{detail(shot, state.scoring)}</p>
      {(distance !== null || placed) && (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
          {distance !== null && (
            <>
              <dt className="text-muted-foreground">Teiler</dt>
              <dd className="font-semibold tabular-nums">
                {formatValue(teilerFromDistanceUm(distance), 1)}
              </dd>
              <dt className="text-muted-foreground">Abstand zur Mitte</dt>
              <dd className="font-semibold tabular-nums">{mm(distance)}</dd>
            </>
          )}
          {placed && (
            <>
              <dt className="text-muted-foreground">x / y</dt>
              <dd className="font-semibold tabular-nums">
                {`${signedMm(shot.xUm as number)} / ${signedMm(shot.yUm as number)}`}
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  )
}
