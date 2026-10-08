"use client"

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { distanceUm } from "@vereinsheim/shot-core/scoring"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue } from "../format"
import { scoreColor } from "../geometry"
import { formatScore, hasPosition, shotLabels } from "../shots"
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
 * Ablesung (spiegel-ui-design): der angetippte oder letzte Schuss mit Wert in seiner Ringwert-Farbe, der
 * anderen Wertung klein darunter und, wenn die Lage bekannt ist, Teiler, Abstand zur Mitte und x/y.
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
  return (
    <section aria-live="polite" aria-label="Ablesung" className={cn("grid gap-3", className)}>
      <p className="text-[13px] text-muted-foreground">
        {`${shot.kind === "probe" ? "Probe" : "Schuss"} ${label} · ${chosen ? "angetippt" : "letzter Schuss"}`}
      </p>
      <p
        className="font-display text-5xl leading-none font-bold tabular-nums"
        style={{ color: shot.ring === null ? undefined : scoreColor(shot.ring) }}
      >
        {formatScore(shot, state.scoring)}
      </p>
      <p className="text-[13px] text-foreground-2">{detail(shot, state.scoring)}</p>
      {hasPosition(shot) && (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">Teiler</dt>
          <dd className="font-semibold tabular-nums">
            {formatValue(distanceUm(shot.xUm as number, shot.yUm as number) / 10, 1)}
          </dd>
          <dt className="text-muted-foreground">Abstand zur Mitte</dt>
          <dd className="font-semibold tabular-nums">
            {mm(distanceUm(shot.xUm as number, shot.yUm as number))}
          </dd>
          <dt className="text-muted-foreground">x / y</dt>
          <dd className="font-semibold tabular-nums">
            {`${signedMm(shot.xUm as number)} / ${signedMm(shot.yUm as number)}`}
          </dd>
        </dl>
      )}
    </section>
  )
}
