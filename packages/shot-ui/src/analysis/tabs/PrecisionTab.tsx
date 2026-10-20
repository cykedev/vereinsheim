"use client"

import {
  groupShape,
  outlierLoss,
  outliers,
  ringWidths,
  sigmaEstimate,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"

import { axisText, formatValue, ringsText } from "../../format"
import { RouteLink } from "../../nav/RouteLink"
import { ChartSlot } from "../charts/frame"
import { ShapeChart } from "../charts/ShapeChart"
import { NO_OUTLIERS } from "../../reasons"
import { AnalysisCard, IntervalBar, KeyValues, Muted, Note } from "../parts"
import type { CardContext, CardSpec } from "./index"

const mm = (um: number) => formatValue(um / 1000, 2)

/** Präzision: σ, Maße der Gruppe, Form der Gruppe, Ausreißer, alle über die Grundlage */
export function precisionCards({ input, explain, onHelp, sigmaRoute }: CardContext): CardSpec[] {
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
  const one = outlying?.flagged.length === 1
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
                {`σ aus ${sigma.n} Schuss, für wenige Schüsse korrigiert. Er hängt kaum von der Schusszahl ab.${sigmaRoute ? " Deshalb zeigt Fortschritt die Streuung über alle deine Scheiben als σ." : ""}`}
              </Note>
              {sigmaRoute && (
                <RouteLink
                  route={sigmaRoute}
                  className="w-fit text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Streuung im Fortschritt ›
                </RouteLink>
              )}
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
              ["Streukreis (Durchmesser)", mmOr(metric("group.enclosingDiameter"))],
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
            Der Streukreis wird mit der Schusszahl größer. R50 fällt bei wenigen Schüssen leicht zu
            klein aus. Scheiben mit verschiedenen Schusszahlen vergleichst du deshalb über σ.
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
                  [
                    shape.without.length ? "Halbachsen (ohne Ausreißer)" : "Halbachsen",
                    `${mm(shape.majorUm)} · ${mm(shape.minorUm)} mm`,
                  ],
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
                    // der Test steht in der Formel der Hilfe, nicht in der Zeile
                    shape.elongated ? "ja, mit 95 %" : "nicht nachweisbar",
                  ],
                  [
                    "Ausrichtung",
                    shape.showAngle ? (
                      axisText(shape.angleRad)
                    ) : (
                      <Muted>
                        {shape.elongated
                          ? "Winkel erst ab 10 Schuss ohne Ausreißer"
                          : "kein Winkel: Streckung nicht nachweisbar"}
                      </Muted>
                    ),
                  ],
                ]}
              />
              <Note>
                Ellipse und Mitte ohne die Ausreißer (rote Punkte). Die Ellipse reicht doppelt so
                weit wie die Halbachsen (2a, 2b); bei einer runden Gruppe liegen etwa 86 % der
                Treffer darin.
              </Note>
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
                    // zur Mitte hin bringen sie Ringe: keine „negativen Kosten“
                    loss && loss.loss < 0 ? "Wirkung" : "Kosten",
                    loss && loss.loss < 0 ? (
                      <>
                        {`${one ? "bringt" : "bringen"} ${ringsText(-loss.loss, digits)} mehr`}
                        <Muted>{` als der Median der übrigen (${one ? "liegt" : "liegen"} zur Mitte hin)`}</Muted>
                      </>
                    ) : loss ? (
                      <>
                        {ringsText(loss.loss, digits)}
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
            <Note>{NO_OUTLIERS}</Note>
          )}
        </AnalysisCard>
      ),
    },
  ]
}
