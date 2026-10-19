"use client"

import { useCallback, useState } from "react"

import { ChartSlot } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { HelpButton, HelpIcon } from "@vereinsheim/shot-ui/help/HelpButton"
import { CardList } from "@vereinsheim/shot-ui/period/CardList"
import { CardLine, CardReadout } from "@vereinsheim/shot-ui/period/CardReadout"
import type { RenderItemLink } from "@vereinsheim/shot-ui/period/links"
import type { PeriodModel } from "@vereinsheim/shot-ui/period/model"
import { PeriodChart } from "@vereinsheim/shot-ui/period/PeriodChart"
import { PeriodChartBar } from "@vereinsheim/shot-ui/period/PeriodChartBar"
import { PeriodInsights } from "@vereinsheim/shot-ui/period/PeriodInsights"
import { PeriodTiles } from "@vereinsheim/shot-ui/period/PeriodTiles"
import type { PeriodAction, PeriodState } from "@vereinsheim/shot-ui/period/state"
import { VolumeChart } from "@vereinsheim/shot-ui/period/VolumeChart"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"

import { metricHelpId } from "@/lib/help/topics"
import type { RingDistribution } from "@vereinsheim/shot-core/analysis"
import { RingBars } from "@vereinsheim/shot-ui/analysis/charts/RingBars"
import { countOf } from "@vereinsheim/shot-ui/period/words"

import type { Influence } from "@/lib/statistics/influences"
import type { LocationSummary } from "@/lib/statistics/location"
import type { OverviewTableGroup } from "@/lib/statistics/overview"
import { SESSION_WORDS } from "@/lib/statistics/words"
import { STATISTICS_METRICS } from "@/lib/statistics/page"
import type { SelfImage } from "@/lib/statistics/selfImage"

import { DisciplineOverviewTable } from "./overview"
import { StatisticsInfluences } from "./StatisticsInfluences"
import { StatisticsLocation } from "./StatisticsLocation"
import { StatisticsSelfImage } from "./StatisticsSelfImage"

export interface StatisticsPartProps {
  model: PeriodModel
  state: PeriodState
  timeZone: string
  onHelp: (id: string | null) => void
  sessionLink: RenderItemLink
  dispatch: (action: PeriodAction) => void
  jumpTo: (target: Element | null, label: string, shown?: Element | null) => void
}

const box = "rounded-2xl border border-border bg-card"

/** der Wert der Kennzahl des Verlaufs für die Einheit der Ablesung */
const readingValue = (model: PeriodModel) =>
  model.reading ? (model.values.find((v) => v.id === model.reading!.card.id) ?? null) : null

/** Verlauf mit Kennzahl, Darstellung und auf dem Telefon der Ablesezeile */
export function StatisticsChart({
  model,
  state,
  timeZone,
  onHelp,
  sessionLink,
  dispatch,
}: StatisticsPartProps) {
  const reading = model.reading
  return (
    <div className={`grid min-w-0 gap-3 p-3.5 ${box}`}>
      <PeriodChartBar
        metric={state.metric}
        view={model.compareRange ? null : model.view}
        metrics={STATISTICS_METRICS}
        onMetric={(metric) => dispatch({ type: "setMetric", metric })}
        onView={(view) => dispatch({ type: "setView", view })}
        onHelp={() => onHelp("verlauf-und-form")}
      />
      <ChartSlot height={300}>
        {(width) => (
          <PeriodChart
            // je Menge der Einheiten, Darstellung und Kennzahl neu: das Lineal fängt ohne Wahl an
            key={`${state.family}:${state.kind}:${model.range.fromMs}:${model.range.toMs}:${state.metric}:${model.view}:${model.compareRange?.fromMs ?? ""}`}
            width={width}
            model={model}
            timeZone={timeZone}
            chosen={state.chosen}
            onChoose={(id) => dispatch({ type: "pick", id })}
          />
        )}
      </ChartSlot>
      {reading && (
        <CardLine
          className="md:hidden"
          card={reading.card}
          value={readingValue(model)}
          delta={model.deltas.get(reading.card.id)}
          metric={model.metric}
          timeZone={timeZone}
          renderLink={sessionLink}
          onHelp={onHelp}
        />
      )}
    </div>
  )
}

/** Umfang je Woche; einen Kalender gibt es nicht, das Tagebuch filtert nicht nach Tagen */
export function StatisticsVolume({ model, state, onHelp }: StatisticsPartProps) {
  return (
    <div className={`grid gap-2 p-3.5 ${box}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">Umfang je Woche</h2>
        <HelpButton
          label="Trainingsumfang"
          helpId="trainingsumfang"
          onClick={() => onHelp("trainingsumfang")}
        />
      </div>
      <ChartSlot height={170}>
        {(width) => (
          <VolumeChart
            key={`${state.family}:${state.kind}:${model.range.fromMs}:${model.range.toMs}`}
            width={width}
            weeks={model.weeks}
          />
        )}
      </ChartSlot>
    </div>
  )
}

/** Ablesung der gewählten oder neuesten Einheit, ohne kleine Scheibe (keine Lage je Schuss) */
export function StatisticsReadout({ model, timeZone, onHelp, sessionLink }: StatisticsPartProps) {
  const reading = model.reading
  if (!reading) return null
  return (
    <div className={`p-4 max-md:hidden ${box}`}>
      <CardReadout
        card={reading.card}
        marks={[]}
        target={null}
        value={readingValue(model)}
        point={reading.point}
        delta={model.deltas.get(reading.card.id)}
        metric={model.metric}
        timeZone={timeZone}
        chosen={reading.chosen}
        renderLink={sessionLink}
        onHelp={onHelp}
      />
    </div>
  )
}

/** Liste der Einheiten des Zeitraums; eine neue Wahl holt den Verlauf ins Bild */
export function StatisticsList({ model, state, timeZone, dispatch, jumpTo }: StatisticsPartProps) {
  const choose = useCallback(
    (id: string) => {
      if (id !== state.chosen)
        jumpTo(document.querySelector('[data-section="history"]'), "Einheiten")
      dispatch({ type: "choose", id })
    },
    [dispatch, jumpTo, state.chosen]
  )
  return (
    <div id="card-list" className={`p-2 md:flex md:max-h-full md:flex-col ${box}`}>
      <CardList
        className="md:min-h-0"
        cards={model.cards}
        values={model.values}
        deltas={model.deltas}
        metric={model.metric}
        timeZone={timeZone}
        chosen={state.chosen}
        onChoose={choose}
      />
    </div>
  )
}

type AnalysisTab = "records" | "location" | "influences" | "selfImage"

/** Einflüsse und Selbstbild über die Einheiten des Zeitraums, vom Server gerechnet */
export interface StatisticsAnalysisData {
  influences: Influence[]
  selfImage: SelfImage
  /** Tabelle der Serien je Einheit; null ohne Einheit */
  overview: OverviewTableGroup | null
  location: LocationSummary
  rings: RingDistribution
}

/** Analyse: Rekorde, dazu Einflüsse und Selbstbild, wenn der Server sie mitgibt */
function StatisticsAnalysis({
  model,
  state,
  timeZone,
  onHelp,
  dispatch,
  jumpTo,
  analysis,
}: StatisticsPartProps & { analysis: StatisticsAnalysisData }) {
  const [explain, setExplain] = useState(false)
  const [tab, setTab] = useState<AnalysisTab>("records")
  const chooseFromRecord = (id: string) => {
    if (state.chosen !== id) dispatch({ type: "choose", id })
    const shown = [...document.querySelectorAll("[data-card-readout], [data-card-line]")].find(
      (el) => el.getClientRects().length > 0
    )
    jumpTo(document.getElementById("history"), "Analyse", shown ?? null)
  }
  return (
    <div className="grid gap-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Reiter der Analyse"
          value={tab}
          options={[
            { value: "records", label: "Rekorde" },
            { value: "location", label: "Trefferlage" },
            { value: "influences", label: "Einflüsse" },
            { value: "selfImage", label: "Selbstbild" },
          ]}
          onChange={setTab}
          // vier Reiter sind am schmalen Telefon breiter als die Seite: dort scrollen sie in sich
          scroll
        />
        <ToggleChip pressed={explain} icon={<HelpIcon />} onPressedChange={setExplain}>
          Erklärungen
        </ToggleChip>
      </div>
      {tab === "records" ? (
        <PeriodInsights
          model={model}
          scoring={state.scoring}
          timeZone={timeZone}
          explain={explain}
          onHelp={onHelp}
          onChoose={chooseFromRecord}
          chosen={state.chosen}
        />
      ) : tab === "location" ? (
        <StatisticsLocation summary={analysis.location} timeZone={timeZone} />
      ) : tab === "influences" ? (
        <StatisticsInfluences rows={analysis.influences} />
      ) : (
        <StatisticsSelfImage image={analysis.selfImage} />
      )}
    </div>
  )
}

/** Zahlen und Analyse unter Verlauf und Liste */
export function statisticsBelow(props: StatisticsPartProps & { analysis: StatisticsAnalysisData }) {
  return [
    {
      id: "numbers" as const,
      node: (
        <div className="grid min-w-0 gap-4">
          <PeriodTiles
            tiles={props.model.tiles}
            compareLabel={props.model.compareRange?.label ?? null}
            onHelp={(key) => props.onHelp(metricHelpId(key))}
          />
          {props.analysis.rings.n > 0 && (
            <article data-period-rings className={`grid gap-3 p-4 ${box}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-bold">Ringverteilung</h3>
                <span className="text-[13px] text-muted-foreground">
                  {`${props.analysis.rings.n} Wertungsschüsse aus ${countOf(
                    props.model.cards.length,
                    SESSION_WORDS
                  )}`}
                </span>
              </div>
              <RingBars dist={props.analysis.rings} />
            </article>
          )}
          {props.analysis.overview && (
            <DisciplineOverviewTable group={props.analysis.overview} timeZone={props.timeZone} />
          )}
        </div>
      ),
    },
    { id: "analysis" as const, node: <StatisticsAnalysis {...props} /> },
  ]
}
