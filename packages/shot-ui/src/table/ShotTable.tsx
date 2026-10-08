"use client"

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { teilerFromDistanceUm } from "@vereinsheim/shot-core/scoring"
import { PAUSE_THRESHOLD_MS } from "@vereinsheim/shot-core/time"
import { cn } from "@vereinsheim/lib/utils"
import { useMemo } from "react"

import { formatValue } from "../format"
import { scoreColor } from "../geometry"
import { formatScore, seriesKeyOf, shotDistance, shotIntervals, shotLabels } from "../shots"
import type { SeriesKey } from "../types"
import { isSelected, type ViewState } from "../view-state"

export interface ShotTableProps {
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  state: ViewState
  /** Zeile gewählt: derselbe Schuss wie beim Antippen auf der Scheibe */
  onChoose?: (index: number, series: SeriesKey | null) => void
  className?: string
}

/** Intervall wie in der Spielwiese: Sekunden, ab drei Minuten als Pause in Minuten, ohne Abstand ein Strich */
function intervalText(ms: number | null): string {
  if (ms === null) return "–"
  return ms > PAUSE_THRESHOLD_MS
    ? `${formatValue(ms / 60_000, 0)} min`
    : `${formatValue(ms / 1000, 0)} s`
}

/** Name einer Gruppe in der Tabelle: Probe, Serie n oder Wertung ohne Serie */
const groupTitle = (key: SeriesKey | null) =>
  key === "probe" ? "Probe" : key === null ? "ohne Serie" : `Serie ${key}`

/** Teiler wie im Fachkern und auf dem Ausdruck; ohne gültigen Abstand ein Strich */
function teilerText(shot: MetricShot): string {
  const distance = shotDistance(shot)
  return distance === null ? "–" : formatValue(teilerFromDistanceUm(distance), 1)
}

/**
 * Schusstabelle (spiegel-ui-design): neuester Schuss oben, nur die Schüsse der Auswahl, je Zeile Nummer,
 * Wert mit Farbpunkt, Innenzehner, Teiler und Abstand zum vorigen Schuss. Jede Zeile wählt ihren Schuss;
 * der Knopf in der ersten Zelle ist der Weg per Tastatur und Screenreader. Zeigt sie mehrere Serien,
 * trennt eine Zeile mit dem Namen jede Serie (je ein `tbody`).
 */
export function ShotTable({ shots, state, onChoose, className }: ShotTableProps) {
  const labels = useMemo(() => shotLabels(shots), [shots])
  const intervals = useMemo(() => shotIntervals(shots), [shots])
  const indices = shots
    .map((_, i) => i)
    .filter((i) => isSelected(state.selection, seriesKeyOf(shots[i])))
    .reverse()

  // aufeinanderfolgende Zeilen derselben Serie bilden eine Gruppe
  const groups: { key: SeriesKey | null; indices: number[] }[] = []
  for (const i of indices) {
    const key = seriesKeyOf(shots[i])
    const last = groups.at(-1)
    if (last && last.key === key) last.indices.push(i)
    else groups.push({ key, indices: [i] })
  }

  if (!indices.length) {
    return <p className={cn("text-[13px] text-muted-foreground", className)}>Noch kein Schuss.</p>
  }

  return (
    <div className={cn("overflow-auto", className)}>
      <table className="w-full border-collapse text-[13px] tabular-nums">
        <caption className="sr-only">Schüsse, neuester zuerst</caption>
        <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Nr.
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              {state.scoring === "rings" ? "Ring" : "Wert"}
            </th>
            <th scope="col" className="px-2 py-1.5 text-center font-medium">
              <span className="sr-only">Innenzehner</span>
              <span aria-hidden="true">★</span>
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Teiler
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Intervall
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={String(group.key)}>
            {groups.length > 1 && (
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={5}
                  className="border-t border-border bg-surface-2 px-2 py-1 text-left text-xs font-semibold text-muted-foreground"
                >
                  {groupTitle(group.key)}
                </th>
              </tr>
            )}
            {group.indices.map((i) => {
              const shot = shots[i]
              const probe = shot.kind === "probe"
              const chosen = state.chosen?.index === i
              const color = shot.ring === null ? "var(--paper-line)" : scoreColor(shot.ring)
              const choose = onChoose ? () => onChoose(i, seriesKeyOf(shot)) : undefined
              return (
                <tr
                  key={i}
                  data-row={labels[i]}
                  data-chosen={chosen || undefined}
                  onClick={choose}
                  className={cn(
                    "border-t border-border",
                    choose && "cursor-pointer hover:bg-surface-2",
                    chosen && "bg-accent-wash"
                  )}
                >
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      aria-pressed={chosen}
                      aria-label={`${probe ? "Probe" : "Schuss"} ${labels[i]} wählen`}
                      onClick={(event) => {
                        // die Zeile wählt sonst ein zweites Mal
                        event.stopPropagation()
                        choose?.()
                      }}
                      className="-mx-1 cursor-pointer rounded px-1 font-semibold focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {labels[i]}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block size-2.5 rounded-full align-middle"
                      style={
                        probe ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color }
                      }
                    />
                    {/* feste Breite: „10,4“ und „9,0“ sind verschieden breit, die Punkte stehen trotzdem untereinander */}
                    <span className="inline-block min-w-[4ch] text-right">
                      {formatScore(shot, state.scoring)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {shot.innerTen && (
                      <>
                        <span className="sr-only">Innenzehner</span>
                        <span aria-hidden="true">★</span>
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">{teilerText(shot)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">
                    {intervalText(intervals[i])}
                  </td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}
