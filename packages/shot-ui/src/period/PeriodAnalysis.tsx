"use client"

import type { PeriodPattern } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { Button } from "@vereinsheim/ui/button"
import { useId, type ReactNode } from "react"

import { AnalysisStrip } from "../analysis/AnalysisStrip"
import { ClockChart } from "../analysis/charts/ClockChart"
import { ChartSlot } from "../analysis/charts/frame"
import { layoutCards } from "../analysis/layout"
import { AnalysisCard, KeyValues, Note, Verdict } from "../analysis/parts"
import { formatValue } from "../format"
import { useHelpTexts } from "../help/HelpTexts"
import type { PeriodTab } from "../layout/sections"
import type { PeriodModel } from "./model"
import type { PatternState } from "./PatternPanel"
import {
  axisWords,
  OUTLIER_NOTE,
  outlierWords,
  PATTERN_FAILED,
  PATTERN_LOADING,
  POSITION_NOTE,
  positionWords,
  ROUND_NOTE,
  shapeNote,
  shapeWords,
  type PatternSentence,
} from "./patternWords"
import { RecordsCard } from "./PeriodInsights"
import { usePeriodWords } from "./PeriodWords"
import { PositionTimeline, TIMELINE_HEIGHT } from "./PositionTimeline"
import { ShapeEllipse } from "./ShapeEllipse"

/** die Reiter in der Ordnung der Scheibe; Überblick und Zeit kommen mit den Erkenntnissen über den Zeitraum */
export const PERIOD_TABS: readonly { value: PeriodTab; label: string }[] = [
  { value: "result", label: "Ergebnis" },
  { value: "precision", label: "Präzision" },
  { value: "position", label: "Lage" },
]

export interface PeriodAnalysisProps {
  tab: PeriodTab
  onTab: (tab: PeriodTab) => void
  model: Pick<PeriodModel, "records" | "cards">
  scoring: Scoring
  timeZone: string
  /** das Trefferbild des Zeitraums, geholt, sobald Präzision oder Lage offen ist */
  pattern: PatternState
  onRetry: () => void
  explain: boolean
  onHelp?: (id: string) => void
  /** ein Rekord oder ein Schwerpunkt wählt seine Scheibe */
  onChoose?: (id: string) => void
  chosen?: string | null
  /** rechts im Kopf, der Schalter „Erklärungen“ */
  action?: ReactNode
}

/** ein Urteil als Satz unter einer Karte: der erste Satz fett */
function Sentence({ words }: { words: PatternSentence }) {
  return (
    <p data-pattern-verdict className="text-[13.5px]">
      <b className="font-semibold">{words.lead}</b>
      {words.more && <span className="text-foreground-2">{` ${words.more}`}</span>}
    </p>
  )
}

/** solange das Muster lädt oder fehlt: dieselbe Zeile wie unter dem Bild */
function Pending({ state, onRetry }: { state: PatternState; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Note>{state.status === "error" ? PATTERN_FAILED : PATTERN_LOADING}</Note>
      {state.status === "error" && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Noch einmal
        </Button>
      )}
    </div>
  )
}

/**
 * Analyse über den Zeitraum in Reitern wie auf der Scheibe: Ergebnis (Rekorde), Präzision (Form über mehrere Scheiben
 * als Ellipse, L9), Lage (Lage über Zeit als zwei Zeitreihen, L10; Ausreißerrichtung, L7). Die Antwort steht unter dem Trefferbild, hier stehen die
 * Belege mit ihren Zahlen.
 */
export function PeriodAnalysis(props: PeriodAnalysisProps) {
  const { tab, onTab, explain, onHelp, action } = props
  const regionId = useId()
  const words = usePeriodWords()
  const texts = useHelpTexts()
  const label = PERIOD_TABS.find((t) => t.value === tab)?.label ?? ""
  const card = (help: string, children: ReactNode) => (
    <AnalysisCard help={help} texts={texts} explain={explain} onHelp={onHelp}>
      {children}
    </AnalysisCard>
  )
  const pattern = props.pattern.status === "ready" ? props.pattern.pattern : null
  const cards =
    tab === "result"
      ? [{ key: "rekorde", wide: true, element: <RecordsCard {...props} /> }]
      : !pattern
        ? [
            {
              key: "pending",
              wide: true,
              element: card(
                tab === "precision" ? "form-ueber-scheiben" : "lage-ueber-zeit",
                <Pending state={props.pattern} onRetry={props.onRetry} />
              ),
            },
          ]
        : tab === "precision"
          ? [{ key: "form", element: card("form-ueber-scheiben", <ShapeBody pattern={pattern} />) }]
          : [
              {
                key: "lage",
                element: card(
                  "lage-ueber-zeit",
                  <>
                    <ChartSlot height={TIMELINE_HEIGHT}>
                      {(width) => (
                        <PositionTimeline
                          overTime={pattern.overTime}
                          width={width}
                          timeZone={props.timeZone}
                          chosen={props.chosen ?? null}
                          onChoose={props.onChoose}
                        />
                      )}
                    </ChartSlot>
                    <Sentence words={positionWords(pattern.overTime)} />
                    <Note>{POSITION_NOTE}</Note>
                  </>
                ),
              },
              {
                key: "ausreisser",
                element: card(
                  "ausreisserrichtung",
                  <>
                    {pattern.outliers && (
                      <ChartSlot height={250}>
                        {(width) => (
                          <ClockChart width={width} counts={pattern.outliers?.counts ?? []} />
                        )}
                      </ChartSlot>
                    )}
                    <Sentence words={outlierWords(pattern.outliers)} />
                    <Note>{OUTLIER_NOTE}</Note>
                  </>
                ),
              },
            ]
  return (
    <section aria-label="Analyse" className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="font-display text-xl font-bold tracking-tight">Was der Zeitraum zeigt</h2>
          <p className="text-[13px] text-muted-foreground">{`Analyse über die ${words.many}`}</p>
        </div>
        {action && <div data-analysis-action>{action}</div>}
      </div>
      <AnalysisStrip value={tab} options={PERIOD_TABS} onChange={onTab} controls={regionId} />
      <div
        id={regionId}
        role="region"
        aria-label={`Thema ${label}`}
        className="@container grid gap-4"
      >
        {layoutCards(cards)}
      </div>
    </section>
  )
}

/** Inhalt der Karte „Form über mehrere Scheiben“ */
function ShapeBody({ pattern }: { pattern: PeriodPattern }) {
  const shape = pattern.shape
  if (!shape || shape.verdict === "few") return <Sentence words={shapeWords(shape)} />
  return (
    <>
      <ShapeEllipse shape={shape} />
      <KeyValues
        rows={[
          [
            "Form",
            shape.verdict === "elongated" ? (
              <Verdict tone="warn">{`länglich, ${axisWords(shape.angleRad)}`}</Verdict>
            ) : (
              <Verdict tone="none">keine klare Richtung</Verdict>
            ),
          ],
          ["Länge zu Breite", `${formatValue(shape.ratio, 2)} : 1`],
          ["Streuung σ", `${formatValue(shape.sigmaUm / 1000, 2)} mm`],
        ]}
      />
      <Note>{`${ROUND_NOTE} ${shapeNote(shape)}`}</Note>
    </>
  )
}
