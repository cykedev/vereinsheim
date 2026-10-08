"use client"

import {
  longestRun,
  ringDistribution,
  shareAtLeast,
  shotExtremes,
  type TeilerRef,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"

import { formatValue, percentText } from "../../format"
import { RingBars } from "../charts/RingBars"
import type { AnalysisInput } from "../input"
import { AnalysisCard, IntervalBar, KeyValues, Note } from "../parts"
import type { CardContext, CardSpec } from "./index"

/** Schwellen der Quoten (Spielwiese `resultTab`): ganze Ringe, sonst nach Waffe */
export function shareThresholds({ scoring, target }: AnalysisInput): [number, string][] {
  if (scoring === "rings") {
    return [
      [100, "Ring 10"],
      [90, "ab Ring 9"],
    ]
  }
  return target.weapon === "lg"
    ? [
        [100, "ab 10,0"],
        [105, "ab 10,5"],
      ]
    : [
        [100, "ab 10,0"],
        [90, "ab 9,0"],
      ]
}

function TeilerList({ refs }: { refs: readonly TeilerRef[] }) {
  return (
    <>
      {refs.map((ref, i) => (
        <span key={ref.number}>
          {i > 0 && " · "}
          {formatValue(ref.teiler, 1)}
          <span className="font-normal text-muted-foreground">{` (${ref.number})`}</span>
        </span>
      ))}
    </>
  )
}

/** Ergebnis: Ergebnis, Ringverteilung, beste und weiteste Teiler, Quoten, alle über die Grundlage */
export function resultCards({ input, explain }: CardContext): CardSpec[] {
  const { base, scoring } = input
  const metric = (key: string) => computeMetric(inScoring(metricByKey(key)!, scoring), base)
  const total = metric("result.decimal")
  const mean = metric("result.decimalMean")
  const dist = ringDistribution(base)
  const extremes = shotExtremes(base)
  const shares = shareThresholds(input).flatMap(([tenths, label]) => {
    const share = shareAtLeast(base, scoring, tenths)
    return share ? [{ label, share }] : []
  })
  const run = longestRun(base, scoring, 100)

  return [
    {
      key: "ergebnis",
      element: (
        <AnalysisCard help="ergebnis" explain={explain}>
          {total === null ? (
            <Note>ab 1 Schuss</Note>
          ) : (
            <KeyValues
              rows={[
                ["Ergebnis", `${formatValue(total, scoring === "rings" ? 0 : 1)} Ringe`],
                ["Ø je Schuss", mean === null ? "–" : formatValue(mean, 2)],
                ["Schuss", String(base.length)],
              ]}
            />
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "ringverteilung",
      element: (
        <AnalysisCard help="ringverteilung" explain={explain}>
          {dist.n ? (
            <>
              <RingBars dist={dist} />
              <Note>{`${dist.innerTens} Innenzehner · n = ${dist.n}`}</Note>
            </>
          ) : (
            <Note>ab 1 Schuss</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "extreme-und-teiler",
      element: (
        <AnalysisCard help="extreme-und-teiler" explain={explain}>
          {extremes ? (
            <>
              <KeyValues
                rows={[
                  ["Beste Teiler", <TeilerList key="best" refs={extremes.bestTeiler} />],
                  ["Weiteste Teiler", <TeilerList key="widest" refs={extremes.widestTeiler} />],
                ]}
              />
              <Note>
                In Klammern die Schussnummer. Der kleinste Teiler ist dein bester Schuss, der größte
                dein schwächster; bei gleichem Teiler zählt der frühere.
              </Note>
            </>
          ) : (
            <Note>ab 1 Schuss mit Lage</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "quoten",
      element: (
        <AnalysisCard help="quoten" explain={explain}>
          {shares.length ? (
            <>
              <div className="grid gap-2.5 text-[13.5px] tabular-nums">
                {shares.map(({ label, share }) => (
                  <div
                    key={label}
                    data-share={label}
                    className="grid grid-cols-[6.4rem_minmax(0,1fr)_6.2rem] items-center gap-3"
                  >
                    <span className="text-foreground-2">{label}</span>
                    <IntervalBar
                      value={share.rate}
                      low={share.low}
                      high={share.high}
                      min={0}
                      max={1}
                      label={`${label}: ${percentText(share.rate)}, 95 % von ${percentText(share.low)} bis ${percentText(share.high)}`}
                    />
                    <span className="text-right font-semibold">
                      {percentText(share.rate)}
                      <small className="ml-1 text-[12.5px] font-medium text-muted-foreground">
                        {`· ${share.count}/${share.n}`}
                      </small>
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-[6.4rem_minmax(0,1fr)_6.2rem] gap-3">
                  <span />
                  <div className="flex justify-between gap-2 font-mono text-xs text-muted-foreground">
                    <span>0 %</span>
                    <span>50 %</span>
                    <span>100 %</span>
                  </div>
                  <span />
                </div>
              </div>
              <Note>
                {`Balken: 95-%-Bereich nach Wilson, Punkt: gemessene Quote. Längste Folge ${scoring === "rings" ? "mit Ring 10" : "ab 10,0"}: ${run.length ? `${run.length} Schuss ab Schuss ${run.start}` : "keine"}.`}
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
