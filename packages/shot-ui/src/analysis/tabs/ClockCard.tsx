"use client"

import { directionClock } from "@vereinsheim/shot-core/analysis"
import { centroid } from "@vereinsheim/shot-core/geometry"
import { selectShots, type MetricShot } from "@vereinsheim/shot-core/metrics"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { useState } from "react"

import { ClockChart } from "../charts/ClockChart"
import { ChartSlot } from "../charts/frame"
import { AnalysisCard, Note } from "../parts"

export type ClockReference = "center" | "mpi"

const REFERENCES = [
  { value: "center", label: "um die Mitte" },
  { value: "mpi", label: "um den Schwerpunkt" },
] as const

/**
 * Richtungsuhr (L6) als Karte: Bezug Mitte oder Schwerpunkt ist ihr eigener Zustand (D6), nicht der der
 * Scheibe. `initialReference` setzt den Start, etwa für Tests.
 */
export function ClockCard({
  shots,
  explain,
  initialReference = "center",
}: {
  shots: readonly MetricShot[]
  explain: boolean
  initialReference?: ClockReference
}) {
  const [reference, setReference] = useState<ClockReference>(initialReference)
  const points = selectShots(shots, { need: "position" }).map((s) => ({
    xUm: s.xUm as number,
    yUm: s.yUm as number,
  }))
  const origin = reference === "mpi" ? centroid(points) : { xUm: 0, yUm: 0 }
  const clock = origin ? directionClock(shots, origin) : null

  return (
    <AnalysisCard help="richtungsuhr" explain={explain}>
      {clock && clock.n ? (
        <>
          <Segmented
            label="Bezugspunkt"
            options={REFERENCES}
            value={reference}
            onChange={setReference}
            className="w-fit"
          />
          <ChartSlot height={250}>
            {(width) => <ClockChart width={width} counts={clock.counts} />}
          </ChartSlot>
          <Note>
            {`Zahl der Treffer je Uhrzeit, 12 ist oben. Die Fläche wächst mit der Zahl.${clock.reliable ? "" : " Unter 30 Schuss ist die Uhr ein Bild, kein Befund."}`}
          </Note>
        </>
      ) : (
        <Note>ab 1 Schuss mit Lage</Note>
      )}
    </AnalysisCard>
  )
}
