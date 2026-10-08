"use client"

import {
  groupShape,
  outlierLoss,
  outliers,
  ringWidths,
  sigmaEstimate,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"
import type { ReactNode } from "react"

import { formatValue } from "../../format"
import { ChartSlot } from "../charts/frame"
import { ShapeChart } from "../charts/ShapeChart"
import { AnalysisCard, IntervalBar, KeyValues, Note } from "../parts"
import type { CardContext, CardSpec } from "./index"

const mm = (um: number) => formatValue(um / 1000, 2)

/** zurückgenommener Zusatz hinter einem Wert */
const Muted = ({ children }: { children: ReactNode }) => (
  <span className="font-normal text-muted-foreground">{children}</span>
)

/** Präzision: σ, Maße der Gruppe, Form der Gruppe, Ausreißer, alle über die Grundlage */
export function precisionCards({ input, explain, onHelp }: CardContext): CardSpec[] {
  const { base, scoring, target } = input
  const sigma = sigmaEstimate(base)
  const metric = (key: string) => computeMetric(inScoring(metricByKey(key)!, scoring), base)
  const mmOr = (v: number | null) => (v === null ? "–" : `${formatValue(v, 2)} mm`)
  const r50 = metric("group.r50")
  const sdX = metric("group.sdX")
  const sdY = metric("group.sdY")
  const shape = groupShape(base)
  const outlying = outliers(base)
  const loss = outlierLoss(base, scoring)
  const digits = scoring === "rings" ? 0 : 1
  const max = sigma ? Math.ceil((sigma.high / 1000) * 1.25 * 2) / 2 : 0

  return [
    {
      key: "praezision-sigma",
      element: (
        <AnalysisCard help="praezision-sigma" explain={explain} onHelp={onHelp}>
          {sigma ? (
            <>
              <div className="font-display text-[1.9rem] leading-none font-bold tabular-nums">
                {mm(sigma.sigma)}
                <small className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">
                  mm
                </small>
              </div>
              <div className="grid gap-1.5">
                <IntervalBar
                  value={sigma.sigma / 1000}
                  low={sigma.low / 1000}
                  high={sigma.high / 1000}
                  min={0}
                  max={max}
                  label={`σ ${mm(sigma.sigma)} mm, 95 % von ${mm(sigma.low)} bis ${mm(sigma.high)} mm`}
                />
                <div className="flex justify-between gap-2 font-mono text-xs text-muted-foreground">
                  <span>0</span>
                  <span>{`${formatValue(max, 1)} mm`}</span>
                </div>
              </div>
              <KeyValues rows={[["95-%-Bereich", `${mm(sigma.low)} bis ${mm(sigma.high)} mm`]]} />
              <Note>
                {`Rayleigh-σ aus ${sigma.n} Schuss, um c4 korrigiert: Er hängt kaum von der Schusszahl ab und taugt für den Vergleich über Abende.`}
              </Note>
            </>
          ) : (
            <Note>ab 3 Schuss</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "masse-der-gruppe",
      element: (
        <AnalysisCard help="masse-der-gruppe" explain={explain} onHelp={onHelp}>
          <KeyValues
            rows={[
              ["Streukreis", mmOr(metric("group.enclosingDiameter"))],
              ["R50", mmOr(r50)],
              [
                "R50 in Ringbreiten",
                r50 === null ? (
                  "–"
                ) : (
                  <>
                    {formatValue(ringWidths(r50 * 1000, target), 2)}
                    <Muted>{` (R50 durch ${formatValue(target.ringWidthUm / 1000, 1)} mm)`}</Muted>
                  </>
                ),
              ],
              [
                "Streuung x · y",
                sdX === null || sdY === null
                  ? "–"
                  : `${formatValue(sdX, 2)} · ${formatValue(sdY, 2)} mm`,
              ],
            ]}
          />
          <Note>
            Der Streukreis wird mit der Schusszahl größer, R50 fällt bei wenigen Schüssen leicht zu
            klein aus; über Abende mit verschiedenen Schusszahlen vergleicht σ.
          </Note>
        </AnalysisCard>
      ),
    },
    {
      key: "form-der-gruppe",
      element: (
        <AnalysisCard help="form-der-gruppe" explain={explain} onHelp={onHelp}>
          {shape ? (
            <>
              <ChartSlot height={220}>
                {(width) => <ShapeChart width={width} shots={base} />}
              </ChartSlot>
              <KeyValues
                rows={[
                  ["Halbachsen", `${mm(shape.majorUm)} · ${mm(shape.minorUm)} mm`],
                  [
                    "Verhältnis a/b",
                    <>
                      {Number.isFinite(shape.ratio) ? formatValue(shape.ratio, 2) : "∞"}
                      <Muted>
                        {` · gestreckt ab ${formatValue(shape.ratioLimit, 2)} bei ${shape.n} Schuss`}
                        {shape.without.length > 0 &&
                          ` (ohne Ausreißer ${shape.without.join(", ")})`}
                      </Muted>
                    </>,
                  ],
                  [
                    "Gestreckt?",
                    shape.elongated ? (
                      <>
                        ja, mit 95 %
                        <Muted>{` (Mauchly W ${formatValue(shape.sphericity, 2)})`}</Muted>
                      </>
                    ) : (
                      <>
                        nicht nachweisbar
                        <Muted>{` (W ${formatValue(shape.sphericity, 2)})`}</Muted>
                      </>
                    ),
                  ],
                  [
                    "Ausrichtung",
                    shape.showAngle ? (
                      `${formatValue((shape.angleRad * 180) / Math.PI, 0)}° gegen die Waagrechte`
                    ) : (
                      <Muted>
                        {shape.elongated
                          ? "Winkel erst ab 10 Schuss"
                          : "rund im Rahmen des Zufalls"}
                      </Muted>
                    ),
                  ],
                ]}
              />
              <Note>Ellipse: 2 σ entlang der Hauptachsen, ohne die Ausreißer (rote Punkte).</Note>
            </>
          ) : (
            <Note>ab 3 Schuss</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "ausreisser",
      element: (
        <AnalysisCard help="ausreisser" explain={explain} onHelp={onHelp}>
          {outlying ? (
            <>
              <KeyValues
                rows={[
                  [
                    "Ausreißer",
                    outlying.flagged.length
                      ? outlying.flagged.map((f) => `Schuss ${f.number}`).join(", ")
                      : "keine",
                  ],
                  outlying.flagged.length > 0 && [
                    "Kosten",
                    loss ? (
                      <>
                        {`${formatValue(loss.loss, digits)} Ringe`}
                        <Muted> gegen den Median der übrigen</Muted>
                      </>
                    ) : (
                      <>
                        –<Muted> unbekannt, ein Wert fehlt</Muted>
                      </>
                    ),
                  ],
                ]}
              />
              <Note>
                Schrittweise geprüft: der weiteste gegen die übrigen, ab 10 Schuss dann ohne ihn der
                nächste (F-Test mit Bonferroni). In einer runden normalen Gruppe meldet die Regel in
                höchstens etwa 5 % der Scheiben einen Ausreißer, bei gestreckten Gruppen öfter. Kein
                Schuss fällt aus der Wertung.
              </Note>
            </>
          ) : (
            <Note>ab 5 Schuss</Note>
          )}
        </AnalysisCard>
      ),
    },
  ]
}
