"use client"

import {
  sighterComparison,
  sighterSummary,
  sighterZeroed,
  type GroupSide,
} from "@vereinsheim/shot-core/analysis"
import type { ReactNode } from "react"

import { directionWords, durationText, formatValue } from "../../format"
import { ChartSlot } from "../charts/frame"
import { SighterChart } from "../charts/SighterChart"
import { AnalysisCard, KeyValues, Note, Verdict } from "../parts"
import type { CardContext, CardSpec } from "./index"

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="font-normal text-muted-foreground">{children}</span>
)

const mm = (um: number) => formatValue(um / 1000, 2)

/** Spalten einer Seite in „Probe gegen Wertung“: Schuss, Ø, R50, σ */
const sideCells = (side: GroupSide) => [
  String(side.n),
  side.meanRings === null ? "–" : formatValue(side.meanRings, 2),
  side.r50Um === null ? "–" : mm(side.r50Um),
  side.sigmaUm === null ? "–" : mm(side.sigmaUm),
]

/**
 * Probe: Umfang, Probe gegen Wertung, eingeschossen?, Probe auf der Scheibe. Über alle Schüsse der
 * Karte, denn die Probe gehört nicht zur Grundlage; ohne Visierverstellung (D7).
 */
export function sighterCards({ input, explain }: CardContext): CardSpec[] {
  const { all, scoring, target, basis } = input
  const summary = sighterSummary(all)
  const comparison = sighterComparison(all, scoring)
  const zeroed = sighterZeroed(all)
  const noProbe =
    basis === "nur Probe"
      ? "Nur Probeschüsse: Die anderen Reiter rechnen über sie wie über Wertung."
      : "Keine Probeschüsse."

  return [
    {
      key: "probe-umfang",
      element: (
        <AnalysisCard help="probe-umfang" explain={explain}>
          {summary ? (
            <KeyValues
              rows={[
                [
                  "Probeschüsse",
                  <>
                    {summary.count}
                    <Muted>{` (${summary.blocks} ${summary.blocks === 1 ? "Block" : "Blöcke"} à zehn)`}</Muted>
                  </>,
                ],
                [
                  "Dauer der Probe",
                  summary.durationMs === null ? "–" : durationText(summary.durationMs),
                ],
                [
                  "Bis zum ersten Wertungsschuss",
                  summary.untilMatchMs === null ? "–" : durationText(summary.untilMatchMs),
                ],
              ]}
            />
          ) : (
            <Note>{noProbe}</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "probe-gegen-wertung",
      element: (
        <AnalysisCard help="probe-gegen-wertung" explain={explain}>
          {comparison ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px] tabular-nums">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-2 py-1.5 text-left font-medium">
                        <span className="sr-only">Seite</span>
                      </th>
                      {["Schuss", "Ø", "R50 mm", "σ mm"].map((head) => (
                        <th key={head} scope="col" className="px-2 py-1.5 text-right font-medium">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["probe", "Probe", comparison.probe],
                        ["match", "Wertung", comparison.match],
                      ] as const
                    ).map(([key, name, side]) => (
                      <tr key={key} data-side={key} className="border-t border-border">
                        <th scope="row" className="px-2 py-1.5 text-left font-semibold">
                          {name}
                        </th>
                        {sideCells(side).map((cell, i) => (
                          <td key={i} className="px-2 py-1.5 text-right">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Note>
                {`Ø ${scoring === "rings" ? "in ganzen Ringen" : "in Zehnteln"}; R50 ab fünf, σ ab drei Schuss. Die Probe zählt ganz, bis zum ersten Wertungsschuss.`}
              </Note>
            </>
          ) : (
            <Note>Braucht Probe- und Wertungsschüsse.</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "eingeschossen",
      element: (
        <AnalysisCard help="eingeschossen" explain={explain}>
          {zeroed ? (
            <>
              <KeyValues
                rows={[
                  [
                    "Lage der letzten fünf",
                    <>
                      {directionWords(zeroed.center)}
                      <Muted>{` (${mm(zeroed.offsetUm)} mm)`}</Muted>
                    </>,
                  ],
                  [
                    "Versatz Probe → Wertung",
                    zeroed.matchOffsetUm === null ? "–" : `${mm(zeroed.matchOffsetUm)} mm`,
                  ],
                ]}
              />
              <div className="flex flex-wrap items-center gap-2">
                {zeroed.real ? (
                  <Verdict tone="warn">echt neben der Mitte</Verdict>
                ) : (
                  <Verdict tone="none">kein Versatz nachweisbar</Verdict>
                )}
              </div>
              <Note>
                Hotelling-T² über die letzten fünf Probeschüsse mit Lage; der Versatz zur Wertung
                zählt dieselben Schüsse.
              </Note>
            </>
          ) : (
            <Note>ab 3 Probeschüssen vor der Wertung</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "probe-auf-der-scheibe",
      element: (
        <AnalysisCard help="probe-auf-der-scheibe" ids="" explain={explain}>
          {summary ? (
            <>
              <ChartSlot height={260}>
                {(width) => <SighterChart width={width} shots={all} target={target} />}
              </ChartSlot>
              <Note>
                Probeschüsse hohl in Abgabefolge; der Schwerpunkt der Wertung als kleiner
                geviertelter Kreis.
              </Note>
            </>
          ) : (
            <Note>{noProbe}</Note>
          )}
        </AnalysisCard>
      ),
    },
  ]
}
