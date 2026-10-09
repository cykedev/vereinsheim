"use client"

import {
  cardTrend,
  fatigue,
  movingAverage,
  mpiPath,
  pauseRecovery,
  rhythmProfile,
  seriesCurve,
  seriesSpread,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey, shotNumbers } from "@vereinsheim/shot-core/metrics"
import type { ReactNode } from "react"

import { durationText, formatSigned, formatValue, percentText, ringsSigned } from "../../format"
import { CourseChart } from "../charts/CourseChart"
import { ChartSlot } from "../charts/frame"
import { RhythmChart } from "../charts/RhythmChart"
import { AnalysisCard, KeyValues, Muted, Note } from "../parts"
import type { CardContext, CardSpec } from "./index"

/** Zeichen der Legende im Verlauf, 14 px */
function LegendItem({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5 shrink-0">
        {children}
      </svg>
      {label}
    </span>
  )
}

/** Mindestzahl für die Streuung des Tempos, wie in der Kachel „Tempo“ (D8) */
const TEMPO_MISSING = "ab 4 Schuss mit Zeit"

/**
 * Zeit und Verlauf: Verlauf und Trend, Rhythmus, Tempo und Dauer, Pausen, Ermüdung, Serien im
 * Vergleich, über die Grundlage
 */
export function timeCards({
  input,
  explain,
  onHelp,
  chosenShot,
  onShowShot,
}: CardContext): CardSpec[] {
  const { base, scoring } = input
  // Lineal in Verlauf und Rhythmus: auf dem Schuss der Scheibe, „Auf der Scheibe“ zurück (Plan L1, D4)
  const numbers = shotNumbers(base)
  const chosenNumber = chosenShot ? (numbers.get(chosenShot) ?? null) : null
  const onShow = onShowShot
    ? (number: number) => {
        const shot = base.find((s) => numbers.get(s) === number)
        if (shot) onShowShot(shot)
      }
    : undefined
  const trend = cardTrend(base, scoring)
  const profile = rhythmProfile(base)
  const timed = profile.filter((p) => p.intervalMs !== null).length
  const pace = tempoSpread(base)
  const duration = computeMetric(inScoring(metricByKey("time.duration")!, scoring), base)
  // der Median wie die Kachel an der Scheibe ab 3 Schuss mit Zeit, die Streuung ab 4 (Prüfung, Zeit 6)
  const medianSeconds = computeMetric(metricByKey("time.intervalMedian")!, base)
  const recovery = pauseRecovery(base, scoring)
  const tired = fatigue(base, scoring)
  const series = seriesCurve(base, scoring)
  const spreads = seriesSpread(base)
  const path = mpiPath(base)
  const digits = scoring === "rings" ? 0 : 1

  return [
    {
      key: "verlauf-und-trend",
      wide: true,
      element: (
        <AnalysisCard help="verlauf-und-trend" wide explain={explain} onHelp={onHelp}>
          {/* wie das Diagramm: ab zwei Schuss mit Wert */}
          {movingAverage(base, scoring).length >= 2 ? (
            <>
              <ChartSlot height={230}>
                {(width) => (
                  <CourseChart
                    width={width}
                    shots={base}
                    scoring={scoring}
                    chosenNumber={chosenNumber}
                    onShow={onShow}
                  />
                )}
              </ChartSlot>
              <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground">
                <LegendItem label="Wert je Schuss">
                  <circle cx={7} cy={7} r={4} fill="var(--score-10)" />
                </LegendItem>
                <LegendItem label="Schnitt der letzten zehn">
                  <path d="M1 7h12" stroke="var(--primary)" strokeWidth={2} />
                </LegendItem>
                <LegendItem label="noch keine zehn">
                  <path d="M1 7h12" stroke="var(--primary)" strokeWidth={2} strokeDasharray="3 3" />
                </LegendItem>
                <LegendItem label="Pause">
                  <path
                    d="M7 1v12"
                    stroke="var(--warning)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                </LegendItem>
              </div>
              <Note>
                {trend
                  ? `Trend: Wert je Schuss ${formatSigned(trend.perTenShots, 2)} Ringe alle zehn Schuss (je Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)} Ringe), ${trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"} (Mann-Kendall, 95 %)` : "nicht klar"}.`
                  : "Einen Trend gibt es ab 10 Schuss."}
              </Note>
            </>
          ) : (
            <Note>{base.length >= 2 ? "ab 2 Schuss mit Wert" : "ab 2 Schuss"}</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "rhythmus",
      wide: true,
      element: (
        <AnalysisCard help="rhythmus" wide explain={explain} onHelp={onHelp}>
          {timed >= 2 ? (
            <>
              <ChartSlot height={190}>
                {(width) => (
                  <RhythmChart
                    width={width}
                    shots={base}
                    chosenNumber={chosenNumber}
                    onShow={onShow}
                  />
                )}
              </ChartSlot>
              <Note>
                Säule: Abstand zum vorigen Schuss; Linie: Median der letzten fünf Abstände, Pausen
                über drei Minuten zählen nicht hinein.
              </Note>
            </>
          ) : (
            <Note>ab 3 Schuss mit Zeit</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "tempo-und-dauer",
      element: (
        <AnalysisCard help="tempo-und-dauer" explain={explain} onHelp={onHelp}>
          {medianSeconds !== null || duration !== null ? (
            <>
              <KeyValues
                rows={[
                  [
                    "Tempo (Median)",
                    medianSeconds !== null ? (
                      `${formatValue(medianSeconds, 0)} s`
                    ) : (
                      <>
                        –<Muted> ab 3 Schuss mit Zeit</Muted>
                      </>
                    ),
                  ],
                  [
                    "Mittlere Hälfte (IQR)",
                    pace ? (
                      <>
                        {`${formatValue(pace.iqrMs / 1000, 0)} s`}
                        <Muted>{` (${pace.relative === null ? "–" : percentText(pace.relative)} vom Median)`}</Muted>
                      </>
                    ) : (
                      <>
                        –<Muted>{` ${TEMPO_MISSING}`}</Muted>
                      </>
                    ),
                  ],
                  ["Dauer", duration === null ? "–" : durationText(duration * 1000)],
                ]}
              />
              <Note>
                Konstanter ist nicht automatisch besser: Die Streuung zeigt, wie gleichmäßig du im
                Ablauf bist.
              </Note>
            </>
          ) : (
            <Note>{TEMPO_MISSING}</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "pausen",
      element: (
        <AnalysisCard help="pausen" explain={explain} onHelp={onHelp}>
          {!recovery ? (
            <Note>ab 2 Schuss mit Zeit</Note>
          ) : recovery.effects.length ? (
            <>
              <KeyValues
                rows={[
                  [
                    "Pausen",
                    `${recovery.pauses} · zusammen ${durationText(recovery.totalPauseMs)}`,
                  ],
                  ...recovery.effects.map((effect) => {
                    const interval = profile.find((p) => p.number === effect.afterShot)?.intervalMs
                    return [
                      `Vor Schuss ${effect.afterShot}`,
                      `${interval ? `${durationText(interval)} ` : ""}Pause · danach ${effect.deltaRings === null ? "–" : `Ø ${formatSigned(effect.deltaRings, 2)} Ringe je Schuss`}`,
                    ] as const
                  }),
                ]}
              />
              <Note>
                „Danach“: Ø der bis zu drei Schüsse nach der Pause gegen den Ø deiner übrigen
                Schüsse. Drei Schuss sind wenig; ein Muster zeigt der Vergleich über Abende.
              </Note>
            </>
          ) : (
            <Note>Keine Pause über drei Minuten.</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "ermuedung",
      element: (
        <AnalysisCard help="ermuedung" explain={explain} onHelp={onHelp}>
          {tired ? (
            <>
              <KeyValues
                rows={[
                  ["Erste zehn", `Ø ${formatValue(tired.firstMeanRings, 2)}`],
                  ["Letzte zehn", `Ø ${formatValue(tired.lastMeanRings, 2)}`],
                  [
                    "Unterschied je Schuss",
                    <>
                      {`${formatSigned(tired.deltaRings, 2)} Ringe`}
                      <Muted>{` (zehn Schuss: ${ringsSigned(tired.deltaRings * 10, digits)})`}</Muted>
                    </>,
                  ],
                  tired.deltaR50Um !== null && [
                    "R50 letzte gegen erste",
                    `${formatSigned(tired.deltaR50Um / 1000, 2)} mm`,
                  ],
                ]}
              />
              <Note>
                Eine Scheibe ist verrauscht; ein Muster zeigt erst der Vergleich über mehrere
                Scheiben.
              </Note>
            </>
          ) : (
            <Note>ab 20 Wertungsschüssen</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "serien-im-vergleich",
      element: (
        <AnalysisCard help="serien-im-vergleich" explain={explain} onHelp={onHelp}>
          {series.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px] tabular-nums">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-2 py-1.5 text-left font-medium">
                        Serie
                      </th>
                      <th scope="col" className="px-2 py-1.5 text-right font-medium">
                        Ergebnis
                      </th>
                      <th scope="col" className="px-2 py-1.5 text-right font-medium">
                        R50 mm
                      </th>
                      <th scope="col" className="px-2 py-1.5 text-right font-medium">
                        Versatz mm
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((p) => {
                      const r50 = spreads.find((q) => q.series === p.series)?.r50Um ?? null
                      const offset = path.find((q) => q.series === p.series)?.offsetUm
                      return (
                        <tr
                          key={p.series}
                          data-series-row={p.series}
                          className="border-t border-border"
                        >
                          <td className="px-2 py-1.5 font-semibold">
                            {`S${p.series}`}
                            <Muted>{` (${p.shots})`}</Muted>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {p.total === null ? "–" : formatValue(p.total, digits)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {r50 === null ? "–" : formatValue(r50 / 1000, 2)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {offset === undefined ? "–" : formatValue(offset / 1000, 2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Note>
                Versatz: Abstand des Serien-Schwerpunkts zum Schwerpunkt der Scheibe. R50 ab fünf
                Schuss je Serie.
              </Note>
            </>
          ) : (
            <Note>ab 1 Schuss</Note>
          )}
        </AnalysisCard>
      ),
    },
  ]
}
