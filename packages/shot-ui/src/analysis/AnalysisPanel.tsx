"use client"

import { dataCoverage } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { FALLACIES } from "@vereinsheim/shot-help/guide"
import { GLOSSARY } from "@vereinsheim/shot-help/glossary"
import { cn } from "@vereinsheim/lib/utils"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import type { ReactNode } from "react"

import { HelpIcon } from "../help/HelpButton"
import { HelpDetails } from "../help/HelpDetails"
import { isProbeShot } from "../shots"
import type { Layer, ViewState } from "../view-state"
import { analysisInput, type AnalysisBasis } from "./input"
import { AnalysisCard, Note } from "./parts"
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

/** Merkmale der Datenlage in Worten */
const FLAG_WORDS: Readonly<Record<string, string>> = {
  verdaechtig: "verdächtig",
  fehlschuss: "Fehlschuss",
}

/** „Datenlage: 40 Wertung · 9 Probe · alle mit Lage, Zeit und Wert · Wertung in Zehnteln“ (Q1) */
function coverageText(shots: readonly MetricShot[], scoring: ViewState["scoring"]): string {
  const coverage = dataCoverage(shots)
  // eine Trainingskarte zeigt die Probe wie Wertung, die Datenlage zählt sie als Probe
  const probe = shots.filter(isProbeShot).length
  const missing = [
    coverage.withoutPosition ? `${coverage.withoutPosition} ohne Lage` : "",
    coverage.withoutTime ? `${coverage.withoutTime} ohne Zeit` : "",
    coverage.withoutValue ? `${coverage.withoutValue} ohne Wert` : "",
    ...Object.entries(coverage.flags).map(([flag, n]) => `${n} ${FLAG_WORDS[flag] ?? flag}`),
  ].filter(Boolean)
  return [
    `Datenlage: ${shots.length - probe} Wertung`,
    `${probe} Probe`,
    missing.length ? missing.join(" · ") : "alle mit Lage, Zeit und Wert",
    `Wertung ${scoring === "rings" ? "in ganzen Ringen" : "in Zehnteln"}`,
  ].join(" · ")
}

/**
 * Breite Karten allein, Folgen schmaler Karten im Raster: ab 861 px zwei Spalten in Zeilen, beide Karten
 * einer Zeile gleich hoch, eine einzelne Karte in der letzten Zeile über die volle Breite. Jeder Abstand ist
 * 16 px; Spalten wie in der Spielwiese ließen unter der kürzeren Spalte bis zu 360 px frei (User, 8. Oktober
 * 2026).
 */
function layout(cards: readonly CardSpec[]): ReactNode[] {
  const blocks: ReactNode[] = []
  let run: CardSpec[] = []
  const flush = () => {
    if (!run.length) return
    blocks.push(
      <div
        key={`run:${run[0].key}`}
        className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[861px]:grid-cols-2 min-[861px]:[&>:last-child:nth-child(odd)]:col-span-2"
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
  /** Schalter „Erklärungen“, derselbe wie bei den Kacheln */
  explain: boolean
  /** eine Karte schaltet eine Ebene der Scheibe (die Vertrauensellipse) */
  onToggleLayer: (layer: Layer) => void
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
  className,
}: AnalysisPanelProps) {
  const input = analysisInput(shots, state.scoring, target)
  const cards = shots.length
    ? TAB_CARDS[tab]({ input, explain, layers: state.layers, onToggleLayer })
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
      ]

  return (
    <section aria-label="Analyse" className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", className)}>
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-display text-xl font-bold tracking-tight">Was diese Scheibe zeigt</h2>
          <p className="text-[13px] text-muted-foreground">{`Analyse ${BASIS_TEXT[input.basis]}`}</p>
        </div>
        {/* auf dem Telefon eine Zeile, die in sich seitlich scrollt, statt die Seite zu verbreitern */}
        <Segmented
          label="Thema"
          value={tab}
          options={ANALYSIS_TABS}
          onChange={onTab}
          className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0 [&>button]:whitespace-nowrap"
        />
      </div>
      {layout(cards)}
      {/* ohne Schüsse keine Datenlage: sie behauptete sonst „alle mit Lage, Zeit und Wert“ */}
      {shots.length > 0 && (
        <div data-coverage="true" className="grid gap-2">
          <p className="text-[13px] text-muted-foreground">{coverageText(shots, state.scoring)}</p>
          <HelpDetails id="datenlage" open={explain} />
        </div>
      )}
      <details
        data-glossary="true"
        open={explain}
        className="rounded-2xl border border-border bg-card p-4"
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-[7px] text-[13px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
          <HelpIcon />
          Glossar: die Begriffe kurz erklärt
        </summary>
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
      </details>
      <details
        data-fallacies="true"
        open={explain}
        className="rounded-2xl border border-border bg-card p-4"
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-[7px] text-[13px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
          <HelpIcon />
          Typische Fehlschlüsse
        </summary>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[13.5px] text-foreground-2">
          {FALLACIES.map((item) => (
            <li key={item.title} data-fallacy="true">
              <b className="font-semibold text-foreground">{`${item.title}.`}</b>
              {` ${item.text}`}
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}
