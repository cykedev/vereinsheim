"use client"

import { dataCoverage } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { FALLACIES } from "@vereinsheim/shot-help/guide"
import { GLOSSARY } from "@vereinsheim/shot-help/glossary"
import { cn } from "@vereinsheim/lib/utils"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { useId, useMemo, type ReactNode } from "react"

import { HelpIcon } from "../help/HelpButton"
import { HelpButton } from "../help/HelpButton"
import { isProbeShot, seriesKeyOf } from "../shots"
import type { SeriesKey } from "../types"
import type { Layer, ViewState } from "../view-state"
import { analysisInput, type AnalysisBasis } from "./input"
import { AnalysisCard, Disclosure, Note } from "./parts"
import { TAB_CARDS, type AnalysisTab, type CardSpec } from "./tabs"

export type { AnalysisTab } from "./tabs"

/** die Reiter wie in der Spielwiese */
export const ANALYSIS_TABS: readonly { value: AnalysisTab; label: string }[] = [
  { value: "overview", label: "Überblick" },
  { value: "result", label: "Ergebnis" },
  { value: "precision", label: "Präzision" },
  { value: "position", label: "Lage" },
  { value: "time", label: "Zeit und Verlauf" },
  { value: "sighters", label: "Probe" },
]

const BASIS_TEXT: Readonly<Record<AnalysisBasis, string>> = {
  "ohne Probe": "über alle Schüsse ohne Probe",
  "nur Probe": "über alle Probeschüsse",
  alle: "über alle Schüsse",
}

/** Merkmale der Datenlage in Worten, Einzahl und Mehrzahl */
const FLAG_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  verdaechtig: ["verdächtiger Schuss", "verdächtige Schüsse"],
  fehlschuss: ["Fehlschuss", "Fehlschüsse"],
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * „Datenlage: 40 Wertungsschüsse · 9 Probeschüsse · alle mit Lage, Zeit und Wert · Wertung in Zehnteln“ (Q1). In
 * Zehnteln zählt ein Schuss ohne Zehntel mit, auch wenn er einen Ring hat; ein Training nur aus Probe heißt so
 * (Prüfung, Probe 7, 8 und 10).
 */
function coverageText(
  shots: readonly MetricShot[],
  scoring: ViewState["scoring"],
  basis: AnalysisBasis
): string {
  const coverage = dataCoverage(shots)
  // eine Trainingskarte zeigt die Probe wie Wertung, die Datenlage zählt sie als Probe
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
      ? [`${counted(probe, "Probeschuss", "Probeschüsse")}, als Training wie Wertung gezählt`]
      : [
          counted(shots.length - probe, "Wertungsschuss", "Wertungsschüsse"),
          counted(probe, "Probeschuss", "Probeschüsse"),
        ]
  return [
    `Datenlage: ${kinds.join(" · ")}`,
    missing.length ? missing.join(" · ") : "alle mit Lage, Zeit und Wert",
    `Wertung ${scoring === "rings" ? "in ganzen Ringen" : "in Zehnteln"}`,
  ].join(" · ")
}

/**
 * Breite Karten allein, Folgen schmaler Karten im Raster: zwei Spalten in Zeilen, sobald der Bereich der
 * Karten 820 px breit ist (Container, nicht Fenster: am Desktop steht die Analyse rechts neben der Scheibe),
 * beide Karten einer Zeile gleich hoch, eine einzelne Karte in der letzten Zeile über die volle Breite. Jeder
 * Abstand ist 16 px; Spalten wie in der Spielwiese ließen unter der kürzeren Spalte bis zu 360 px frei (User,
 * 8. Oktober 2026).
 */
function layout(cards: readonly CardSpec[]): ReactNode[] {
  const blocks: ReactNode[] = []
  let run: CardSpec[] = []
  const flush = () => {
    if (!run.length) return
    blocks.push(
      <div
        key={`run:${run[0].key}`}
        className="grid grid-cols-[minmax(0,1fr)] gap-4 @min-[820px]:grid-cols-2 @min-[820px]:[&>:last-child:nth-child(odd)]:col-span-2"
      >
        {run.map((card) => (
          <div key={card.key} className="grid min-w-0">
            {card.element}
          </div>
        ))}
      </div>
    )
    run = []
  }
  for (const card of cards) {
    if (card.wide) {
      flush()
      blocks.push(<div key={card.key}>{card.element}</div>)
    } else run.push(card)
  }
  flush()
  return blocks
}

export interface AnalysisPanelProps {
  /** alle Schüsse der Karte, wie die Bausteine sie bekommen */
  shots: readonly MetricShot[]
  state: ViewState
  target: TargetImage
  tab: AnalysisTab
  onTab: (tab: AnalysisTab) => void
  /** Schalter „Erklärungen“: der Kurzsatz an jeder Karte und Kachel */
  explain: boolean
  /** rechts im Kopf, etwa der Schalter „Erklärungen“ (seit U1 hier, der Abschnitt „Zahlen“ entfiel) */
  action?: ReactNode
  /** eine Karte schaltet eine Ebene der Scheibe (die Vertrauensellipse) */
  onToggleLayer: (layer: Layer) => void
  /** „?“ an Karten und Datenlage: öffnet die Erklärung als Blatt (`HelpSheet`), Plan Schritt 4 D3 */
  onHelp?: (id: string) => void
  /**
   * „Auf der Scheibe“ im Lineal eines Diagramms: den Schuss (Index in `shots`) auf der Scheibe wählen; die
   * Seite springt dann zur Scheibe (Plan L1, D4). Ohne den Rückruf gibt es den Knopf nicht.
   */
  onChoose?: (index: number, series: SeriesKey | null) => void
  className?: string
}

/**
 * Die Analyse einer Scheibe (Spielwiese, SP-1.10) in sechs Reitern. Sie rechnet über alle Schüsse ohne
 * Probe, bei nur Probe über die Probe (D1), nicht über die Auswahl an der Scheibe. Unter jedem Reiter die
 * Datenlage, das Glossar und die typischen Fehlschlüsse aus `shot-help`.
 */
export function AnalysisPanel({
  shots,
  state,
  target,
  tab,
  onTab,
  explain,
  onToggleLayer,
  onHelp,
  onChoose,
  action,
  className,
}: AnalysisPanelProps) {
  const regionId = useId()
  const input = useMemo(
    () => analysisInput(shots, state.scoring, target),
    [shots, state.scoring, target]
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
    [shots.length, tab, input, explain, state.layers, onToggleLayer, onHelp, chosenShot, onShowShot]
  )
  const tabLabel = ANALYSIS_TABS.find((t) => t.value === tab)?.label ?? ""

  return (
    <section aria-label="Analyse" className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", className)}>
      <div data-analysis-head className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="font-display text-xl font-bold tracking-tight">Was diese Scheibe zeigt</h2>
          <p className="text-[13px] text-muted-foreground">{`Analyse ${BASIS_TEXT[input.basis]}`}</p>
        </div>
        {action && <div data-analysis-action>{action}</div>}
      </div>
      {/* Streifen, der klebt: auf dem Telefon über der Sprungleiste (nie zwei Leisten), ab 768 px unter ihr;
          die Leiste ist eine Zeile, die in sich seitlich scrollt, statt die Seite zu verbreitern */}
      <div className="sticky top-0 z-30 flex h-14 items-center bg-background max-md:-mx-4 max-md:px-4 md:top-14 md:z-10">
        <Segmented
          label="Thema"
          value={tab}
          options={ANALYSIS_TABS}
          onChange={onTab}
          controls={regionId}
          className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0 [&>button]:whitespace-nowrap"
        />
      </div>
      <div
        id={regionId}
        role="region"
        aria-label={`Thema ${tabLabel}`}
        className="@container grid gap-4"
      >
        {layout(cards)}
      </div>
      {/* ohne Schüsse keine Datenlage: sie behauptete sonst „alle mit Lage, Zeit und Wert“ */}
      {shots.length > 0 && (
        <div data-coverage="true" className="flex items-start justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">
            {coverageText(shots, state.scoring, input.basis)}
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
