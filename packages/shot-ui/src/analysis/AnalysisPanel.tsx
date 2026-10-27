"use client"

import { dataCoverage } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { FALLACIES } from "@vereinsheim/shot-help/guide"
import { GLOSSARY } from "@vereinsheim/shot-help/glossary"
import { cn } from "@vereinsheim/lib/utils"
import { useId, useMemo, type ReactNode } from "react"

import { HelpButton } from "../help/HelpButton"
import type { Route } from "../nav/routes"
import { isProbeShot, seriesKeyOf } from "../shots"
import type { SeriesKey } from "../types"
import type { Layer, ViewState } from "../view-state"
import { analysisInput, type AnalysisBasis } from "./input"
import { AnalysisStrip } from "./AnalysisStrip"
import { layoutCards } from "./layout"
import { AnalysisCard, Disclosure, Note } from "./parts"
import { TAB_CARDS, type AnalysisTab } from "./tabs"

export type { AnalysisTab } from "./tabs"

/** die Reiter in ihrer Reihenfolge */
export const ANALYSIS_TABS: readonly { value: AnalysisTab; label: string }[] = [
  { value: "overview", label: "Überblick" },
  { value: "result", label: "Ergebnis" },
  { value: "precision", label: "Präzision" },
  { value: "position", label: "Lage" },
  { value: "time", label: "Zeit und Verlauf" },
]

const BASIS_TEXT: Readonly<Record<AnalysisBasis, string>> = {
  "nur Probe": "über alle Probeschüsse",
  alle: "über alle Schüsse",
}

/** Merkmale der Datenlage in Worten, Einzahl und Mehrzahl */
const FLAG_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  verdaechtig: ["verdächtiger Schuss", "verdächtige Schüsse"],
  fehlschuss: ["Fehlschuss", "Fehlschüsse"],
  // zählt mit 0, aber nicht in Lage und Abstand (SF-08)
  "ueber-soll": ["Schuss über der Soll-Zahl", "Schüsse über der Soll-Zahl"],
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * „Datenlage: 40 Wertungsschüsse · alle mit Lage, Zeit und Wert · Wertung in Zehnteln“ (Q1). In Zehnteln zählt ein
 * Schuss ohne Zehntel mit, auch wenn er einen Ring hat; eine Scheibe nur aus Probe heißt so, mit ihrer Art. Neben
 * Wertung zählt sie keine Probe, wie am Ausdruck.
 */
function coverageText(
  shots: readonly MetricShot[],
  scoring: ViewState["scoring"],
  basis: AnalysisBasis,
  kind: "training" | "competition"
): string {
  const coverage = dataCoverage(shots)
  // eine Karte nur aus Probe zeigt die Probe wie Wertung, die Datenlage zählt sie als Probe
  const probe = shots.filter(isProbeShot).length
  const withoutTenths =
    scoring === "decimal"
      ? shots.filter((s) => Number.isFinite(s.ring) && !Number.isFinite(s.decimalTenths)).length
      : 0
  const missing = [
    coverage.withoutPosition ? `${coverage.withoutPosition} ohne Lage` : "",
    coverage.withoutTime ? `${coverage.withoutTime} ohne Zeit` : "",
    coverage.withoutValue ? `${coverage.withoutValue} ohne Wert` : "",
    withoutTenths ? `${withoutTenths} ohne Zehntel` : "",
    ...Object.entries(coverage.flags).map(([flag, n]) =>
      FLAG_WORDS[flag] ? counted(n, ...FLAG_WORDS[flag]) : `${n} ${flag}`
    ),
  ].filter(Boolean)
  const kinds =
    basis === "nur Probe"
      ? [
          `${counted(probe, "Probeschuss", "Probeschüsse")}, als ${kind === "competition" ? "Wettkampf" : "Training"} wie Wertung gezählt`,
        ]
      : [counted(shots.length, "Wertungsschuss", "Wertungsschüsse")]
  return [
    `Datenlage: ${kinds.join(" · ")}`,
    missing.length ? missing.join(" · ") : "alle mit Lage, Zeit und Wert",
    `Wertung ${scoring === "rings" ? "in ganzen Ringen" : "in Zehnteln"}`,
  ].join(" · ")
}

export interface AnalysisPanelProps {
  /** alle Schüsse der Karte, wie die Bausteine sie bekommen (wie am Ausdruck, `asOnPrintout`) */
  shots: readonly MetricShot[]
  /** die rohe Karte vor `asOnPrintout`, für Abstände: eine Probe zwischen Wertung reißt keine Lücke (SF-04) */
  context?: readonly MetricShot[]
  state: ViewState
  target: TargetImage
  tab: AnalysisTab
  onTab: (tab: AnalysisTab) => void
  /** Schalter „Erklärungen“: der Kurzsatz an jeder Karte und Kachel */
  explain: boolean
  /** rechts im Kopf, etwa der Schalter „Erklärungen“ */
  action?: ReactNode
  /** eine Karte schaltet eine Ebene der Scheibe (die Vertrauensellipse) */
  onToggleLayer: (layer: Layer) => void
  /** „?“ an Karten und Datenlage: öffnet die Erklärung als Blatt (`HelpSheet`) */
  onHelp?: (id: string) => void
  /**
   * „Auf der Scheibe“ im Lineal eines Diagramms: den Schuss (Index in `shots`) auf der Scheibe wählen; die
   * Seite springt dann zur Scheibe. Ohne den Rückruf gibt es den Knopf nicht.
   */
  onChoose?: (index: number, series: SeriesKey | null) => void
  /** Fortschritt mit der Streuung σ der Familie dieser Scheibe; ohne sie kein Link an σ */
  sigmaRoute?: Route
  /** Fortschritt mit dem Trefferbild der Familie; ohne ihn kein Link an Form und Richtungsuhr */
  patternRoute?: Route
  /**
   * eine Scheibe ohne Einzelschüsse: Kopf und Reiter bleiben, in jedem Reiter steht statt der Karten dieser Satz mit dem
   * Grund (ein Gerüst für jede Detailtiefe)
   */
  missing?: string | null
  /** Art der Scheibe für die Datenlage einer Scheibe nur aus Probe; Vorgabe Training */
  kind?: "training" | "competition"
  className?: string
}

/**
 * Die Analyse einer Scheibe in fünf Reitern. Sie rechnet über die Scheibe wie am Ausdruck, bei nur Probe über die
 * Probe, nicht über die Auswahl an der Scheibe. Unter jedem Reiter die Datenlage, das
 * Glossar und die typischen Fehlschlüsse aus `shot-help`.
 */
export function AnalysisPanel({
  shots,
  context,
  state,
  target,
  tab,
  onTab,
  explain,
  onToggleLayer,
  onHelp,
  onChoose,
  sigmaRoute,
  patternRoute,
  action,
  missing = null,
  kind = "training",
  className,
}: AnalysisPanelProps) {
  const regionId = useId()
  const input = useMemo(
    () => analysisInput(shots, state.scoring, target, context),
    [shots, state.scoring, target, context]
  )
  // der auf der Scheibe gewählte Schuss, wenn er zur Grundlage gehört: Nur „Zeit und Verlauf“ hat ein Lineal,
  // das ihn zeigt; in den anderen Reitern ändert ein angetippter Schuss die Karten nicht
  const chosenShot = useMemo(() => {
    const shot = tab === "time" && state.chosen ? shots[state.chosen.index] : undefined
    return shot && input.base.includes(shot) ? shot : null
  }, [tab, state.chosen, shots, input.base])
  const onShowShot = useMemo(
    () =>
      onChoose
        ? (shot: MetricShot) => {
            const index = shots.indexOf(shot)
            if (index >= 0) onChoose(index, seriesKeyOf(shot))
          }
        : undefined,
    [onChoose, shots]
  )
  // die Karten nur neu, wenn sich ihre Eingaben ändern (die Seite reicht stabile Rückrufe)
  const cards = useMemo(
    () =>
      shots.length
        ? TAB_CARDS[tab]({
            input,
            explain,
            layers: state.layers,
            onToggleLayer,
            onHelp,
            chosenShot,
            onShowShot,
            sigmaRoute,
            patternRoute,
          })
        : [
            {
              key: "empty",
              wide: true,
              element: (
                <AnalysisCard title="Noch keine Schüsse" explain={explain}>
                  <Note>Noch keine Schüsse auf dieser Scheibe.</Note>
                </AnalysisCard>
              ),
            },
          ],
    [
      shots.length,
      tab,
      input,
      explain,
      state.layers,
      onToggleLayer,
      onHelp,
      chosenShot,
      onShowShot,
      sigmaRoute,
      patternRoute,
    ]
  )
  const tabLabel = ANALYSIS_TABS.find((t) => t.value === tab)?.label ?? ""

  return (
    <section aria-label="Analyse" className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", className)}>
      <div data-analysis-head className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="font-display text-xl font-bold tracking-tight">Was diese Scheibe zeigt</h2>
          {!missing && (
            <p className="text-[13px] text-muted-foreground">{`Analyse ${BASIS_TEXT[input.basis]}`}</p>
          )}
        </div>
        {action && <div data-analysis-action>{action}</div>}
      </div>
      <AnalysisStrip value={tab} options={ANALYSIS_TABS} onChange={onTab} controls={regionId} />
      <div
        id={regionId}
        role="region"
        aria-label={`Thema ${tabLabel}`}
        className="@container grid gap-4"
      >
        {missing ? (
          <div data-summary-missing className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[13px] text-muted-foreground">{missing}</p>
          </div>
        ) : (
          layoutCards(cards)
        )}
      </div>
      {/* ohne Schüsse keine Datenlage: sie behauptete sonst „alle mit Lage, Zeit und Wert“ */}
      {shots.length > 0 && (
        <div data-coverage="true" className="flex items-start justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">
            {coverageText(input.all, state.scoring, input.basis, kind)}
          </p>
          {onHelp && (
            <HelpButton label="Datenlage" helpId="datenlage" onClick={() => onHelp("datenlage")} />
          )}
        </div>
      )}
      <Disclosure data-glossary="true" summary="Glossar: die Begriffe kurz erklärt">
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-[13.5px] sm:grid-cols-[max-content_minmax(0,1fr)]">
          {GLOSSARY.flatMap((entry) => [
            <dt key={`${entry.term}:t`} data-term="true" className="font-semibold">
              {entry.term}
            </dt>,
            <dd key={`${entry.term}:d`} className="text-foreground-2">
              {entry.text}
            </dd>,
          ])}
        </dl>
      </Disclosure>
      <Disclosure data-fallacies="true" summary="Typische Fehlschlüsse">
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[13.5px] text-foreground-2">
          {FALLACIES.map((item) => (
            <li key={item.title} data-fallacy="true">
              <b className="font-semibold text-foreground">{`${item.title}.`}</b>
              {` ${item.text}`}
            </li>
          ))}
        </ol>
      </Disclosure>
    </section>
  )
}
