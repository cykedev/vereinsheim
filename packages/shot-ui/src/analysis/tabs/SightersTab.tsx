"use client"

import {
  sighterComparison,
  sighterSummary,
  sighterZeroed,
  sightersBeforeMatch,
  type GroupSide,
} from "@vereinsheim/shot-core/analysis"
import { selectShots } from "@vereinsheim/shot-core/metrics"

import { countWord, directionName, durationText, formatValue } from "../../format"
import { isProbeShot } from "../../shots"
import { ChartSlot } from "../charts/frame"
import { SighterChart } from "../charts/SighterChart"
import { AnalysisCard, KeyValues, Muted, Note, Verdict } from "../parts"
import type { CardContext, CardSpec } from "./index"

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
export function sighterCards({ input, explain, onHelp }: CardContext): CardSpec[] {
  const { all, scoring, target, basis } = input
  const summary = sighterSummary(all)
  const comparison = sighterComparison(all, scoring)
  const zeroed = sighterZeroed(all)
  // wie das Diagramm: die Probe vor der Wertung, nur mit Lage
  const sightersWithPosition = selectShots(sightersBeforeMatch(all), { need: "position" }).length
  // Probe gibt es, aber erst nach Beginn der Wertung: Sie zählt hier nicht, und das steht da (Prüfung, Probe 4)
  const late = !summary && all.some(isProbeShot)
  const training = basis === "nur Probe"
  const noProbe = training
    ? "Nur Probeschüsse: Die anderen Reiter rechnen über sie wie über Wertung."
    : late
      ? "Keine Probeschüsse vor der Wertung; Probe nach ihrem Beginn zählt hier nicht."
      : "Keine Probeschüsse."

  return [
    {
      key: "probe-umfang",
      element: (
        <AnalysisCard help="probe-umfang" explain={explain} onHelp={onHelp}>
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
                  "Vom ersten Probeschuss bis zur Wertung",
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
        <AnalysisCard help="probe-gegen-wertung" explain={explain} onHelp={onHelp}>
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
        <AnalysisCard help="eingeschossen" explain={explain} onHelp={onHelp}>
          {/* ein Training nur aus Probe ist kein Einschießen (Prüfung, Probe 6) */}
          {zeroed && !training ? (
            <>
              <KeyValues
                rows={[
                  [
                    `Lage der letzten ${countWord(zeroed.n)} Probeschüsse`,
                    `${directionName(zeroed.center)}, ${mm(zeroed.offsetUm)} mm`,
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
                {`Hotelling-T² über die letzten ${countWord(zeroed.n)} Probeschüsse mit Lage; der Versatz zur Wertung zählt dieselben Schüsse.`}
              </Note>
              {zeroed.matchOffsetUm !== null && (
                // D3 (User, 9. Oktober 2026), Zahlen aus B21
                <Note>
                  {`Aus ${countWord(zeroed.n)} Probeschüssen ist ihr Schwerpunkt unsicher: Auch ohne jede Verschiebung liegt der Abstand zur Wertung bei fünf Probeschüssen meist bei etwa einem halben σ, in 5 von 100 Fällen über gut einem σ${zeroed.n < 5 ? "; bei weniger mehr, bei drei etwa 0,7 σ und in 5 von 100 Fällen über knapp anderthalb σ" : ""}.`}
                </Note>
              )}
            </>
          ) : (
            <Note>
              {training || late ? noProbe : "ab 3 Probeschüssen mit Lage vor der Wertung"}
            </Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "probe-auf-der-scheibe",
      element: (
        <AnalysisCard help="probe-auf-der-scheibe" ids="" explain={explain} onHelp={onHelp}>
          {summary && sightersWithPosition ? (
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
            <Note>{summary ? "Keine Probeschüsse mit Lage." : noProbe}</Note>
          )}
        </AnalysisCard>
      ),
    },
  ]
}
