"use client"

import { useCallback } from "react"

import { ChartSlot } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { HelpButton } from "@vereinsheim/shot-ui/help/HelpButton"
import { CardList } from "@vereinsheim/shot-ui/period/CardList"
import { CardLine, CardReadout } from "@vereinsheim/shot-ui/period/CardReadout"
import type { RenderItemLink } from "@vereinsheim/shot-ui/period/links"
import type { PeriodModel } from "@vereinsheim/shot-ui/period/model"
import { PeriodChart } from "@vereinsheim/shot-ui/period/PeriodChart"
import { PeriodChartBar } from "@vereinsheim/shot-ui/period/PeriodChartBar"
import type { PeriodAction, PeriodState } from "@vereinsheim/shot-ui/period/state"
import { VolumeChart } from "@vereinsheim/shot-ui/period/VolumeChart"

import { STATISTICS_METRICS } from "@/lib/statistics/page"

/** was die Teile der Statistik tun können: Hilfe öffnen, eine Einheit verlinken, den Zustand ändern, springen */
export interface StatisticsActions {
  onHelp: (id: string | null) => void
  sessionLink: RenderItemLink
  dispatch: (action: PeriodAction) => void
  jumpTo: (target: Element | null, label: string, shown?: Element | null) => void
}

export interface StatisticsPartProps {
  model: PeriodModel
  state: PeriodState
  timeZone: string
  actions: StatisticsActions
}

export const box = "rounded-2xl border border-border bg-card"

/** der Wert der Kennzahl des Verlaufs für die Einheit der Ablesung */
const readingValue = (model: PeriodModel) =>
  model.reading ? (model.values.find((v) => v.id === model.reading!.card.id) ?? null) : null

/** Verlauf mit Kennzahl, Darstellung und auf dem Telefon der Ablesezeile */
export function StatisticsChart({
  model,
  state,
  timeZone,
  actions: { onHelp, sessionLink, dispatch },
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
export function StatisticsVolume({ model, state, actions: { onHelp } }: StatisticsPartProps) {
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
export function StatisticsReadout({
  model,
  timeZone,
  actions: { onHelp, sessionLink },
}: StatisticsPartProps) {
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
export function StatisticsList({
  model,
  state,
  timeZone,
  actions: { dispatch, jumpTo },
}: StatisticsPartProps) {
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
