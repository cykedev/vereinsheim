import type { FamilyId } from "@vereinsheim/shot-core/discipline"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { ChartSlot } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { ScoringSwitch } from "@vereinsheim/shot-ui/controls/ScoringSwitch"
import { HelpButton } from "@vereinsheim/shot-ui/help/HelpButton"
import { PeriodPage } from "@vereinsheim/shot-ui/layout/PeriodPage"
import { ReturnPill } from "@vereinsheim/shot-ui/layout/ReturnPill"
import { SectionNav } from "@vereinsheim/shot-ui/layout/SectionNav"
import { PERIOD_SECTIONS, type PeriodSection } from "@vereinsheim/shot-ui/layout/sections"
import { useActiveSection } from "@vereinsheim/shot-ui/layout/useActiveSection"
import { useReturnJump } from "@vereinsheim/shot-ui/layout/useReturnJump"
import { rangeDays } from "@vereinsheim/shot-ui/period/calendar"
import { CardList } from "@vereinsheim/shot-ui/period/CardList"
import { CardLine, CardReadout } from "@vereinsheim/shot-ui/period/CardReadout"
import { periodModel, periodReading, PERIOD_CHART_METRICS } from "@vereinsheim/shot-ui/period/model"
import { PeriodChart } from "@vereinsheim/shot-ui/period/PeriodChart"
import { PeriodControls, PeriodHeader } from "@vereinsheim/shot-ui/period/PeriodHeader"
import { PeriodInsights } from "@vereinsheim/shot-ui/period/PeriodInsights"
import { PeriodResult } from "@vereinsheim/shot-ui/period/PeriodResult"
import { PeriodTiles } from "@vereinsheim/shot-ui/period/PeriodTiles"
import { periodSentence } from "@vereinsheim/shot-ui/period/sentence"
import type { PeriodAction, PeriodState } from "@vereinsheim/shot-ui/period/state"
import { VolumeChart } from "@vereinsheim/shot-ui/period/VolumeChart"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { useCallback, useEffect, useMemo } from "react"

import { progressRoute } from "@vereinsheim/shot-ui/nav/navigate"
import { urlFromRoute } from "@vereinsheim/shot-ui/nav/routes"

import { LaborHeader, type LaborHeaderProps } from "./LaborHeader"
import {
  NAMED_PERIODS,
  season,
  SEASON_NOW_MS,
  SEASON_TIME_ZONE,
  targetOfFamily,
  type SeasonCard,
} from "./season"
import { exposePeriodForTest } from "./testHook"

/** die Familien der Saison wie im Fachkern; Auflage gibt es in ihr nicht */
const FAMILIES: readonly { value: FamilyId; label: string }[] = [
  { value: "lg-freihand", label: "Luftgewehr" },
  { value: "lp-freihand", label: "Luftpistole" },
]
const PERIOD_IDS: readonly PeriodSection[] = PERIOD_SECTIONS.map((s) => s.id)
const TZ = SEASON_TIME_ZONE

export interface PeriodViewProps {
  header: Omit<LaborHeaderProps, "children" | "hint">
  state: PeriodState
  dispatch: (action: PeriodAction) => void
  explain: boolean
  onHelp: (helpId: string | null) => void
  /** „Scheibe öffnen“: die Scheibe in der Ansicht „Scheibe“ zeigen */
  onOpen: (card: SeasonCard) => void
}

/**
 * Die Seite eines Zeitraums im Labor (Plan L3, Task 14): die Saison aus `season()`, gefiltert nach der Familie der
 * Seite, alles Gerechnete aus `periodModel`, die Bausteine aus `shot-ui/period`. Der Zustand kommt aus `App`, damit
 * „Zurück zum Zeitraum“ Filter und Wahl wiederfindet.
 */
export function PeriodView({ header, state, dispatch, explain, onHelp, onOpen }: PeriodViewProps) {
  const active = useActiveSection(PERIOD_IDS)
  const { pill, jumpTo, back, close } = useReturnJump()
  const all = season()
  const family = all.filter((c) => c.family === state.family)
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all])
  // das Modell ohne die Wahl: eine neue Wahl rechnet nur die Ablesung neu (Review, 9. Oktober 2026)
  const { choice, compare, kind, includeProbeOnly, metric, view } = state
  const base = useMemo(
    () =>
      periodModel({
        cards: family.map((c) => c.card),
        state: {
          choice,
          compare,
          family: state.family,
          kind,
          includeProbeOnly,
          scoring: state.scoring,
          metric,
          view,
          chosen: null,
        },
        nowMs: SEASON_NOW_MS,
        timeZone: TZ,
        named: NAMED_PERIODS,
      }),
    // die Saison ist fest: der Zustand ohne Wahl genügt
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [choice, compare, state.family, kind, includeProbeOnly, state.scoring, metric, view]
  )
  const model = useMemo(
    () => ({ ...base, reading: periodReading(base, state.chosen) }),
    [base, state.chosen]
  )
  useEffect(() => exposePeriodForTest({ cards: family.map((c) => c.card), state, model }))
  const target = TARGETS[targetOfFamily(state.family)]
  const sentence = periodSentence(model)
  const reading = model.reading
  const readingValue = reading ? (model.values.find((v) => v.id === reading.card.id) ?? null) : null
  const open = useCallback(
    (id: string) => {
      const card = byId.get(id)
      if (card) onOpen(card)
    },
    [byId, onOpen]
  )
  const chooseFromList = useCallback(
    (id: string) => {
      // nur eine neue Wahl holt den Verlauf ins Bild, das Abwählen nicht
      if (id !== state.chosen)
        jumpTo(document.querySelector('[data-section="history"]'), "Scheiben")
      dispatch({ type: "choose", id })
    },
    [dispatch, jumpTo, state.chosen]
  )
  const chooseFromRecord = useCallback(
    (id: string) => {
      if (state.chosen !== id) dispatch({ type: "choose", id })
      jumpTo(document.querySelector('[data-section="history"]'), "Analyse")
    },
    [dispatch, jumpTo, state.chosen]
  )

  const scoring = (
    <ScoringSwitch
      scoring={state.scoring}
      onChange={(next) => dispatch({ type: "setScoring", scoring: next })}
    />
  )
  const result = <PeriodResult model={model} timeZone={TZ} scoring={scoring} onHelp={onHelp} />
  const familyLabel = FAMILIES.find((f) => f.value === state.family)?.label ?? ""
  // Training nur aus Probe zählt nur mit dem Schalter (L2, D8): sonst steht es in der Liste, aber nicht im Ergebnis
  const excluded = model.excludedProbeOnly
  const cardsText = `${model.cards.length} Scheiben${excluded ? `, ${excluded} nur Probe nicht gezählt` : ""}`
  const empty = model.cards.length === 0

  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      <LaborHeader
        {...header}
        address={urlFromRoute(progressRoute(state, null))}
        hint="Erfundene Saison vom 6. April bis 27. September 2026: Luftgewehr mit Formknick im Juni und neuer Munition ab August, Luftpistole; „jetzt“ ist der 30. September."
      />
      <PeriodPage
        header={
          <PeriodHeader
            title={model.range.label}
            meta={[familyLabel, cardsText, rangeDays(model.range, TZ)]}
            controls={
              <PeriodControls
                state={state}
                dispatch={dispatch}
                range={model.range}
                compareRange={model.compareRange}
                named={NAMED_PERIODS}
                timeZone={TZ}
                families={FAMILIES}
              />
            }
            result={empty ? null : result}
            sentence={empty ? null : sentence}
          />
        }
        nav={<SectionNav active={active} sections={PERIOD_SECTIONS} />}
        empty={
          empty ? (
            <p className="rounded-2xl border border-border bg-card p-4 text-[14px] text-foreground-2">
              Keine Scheibe in diesem Zeitraum. Wähle oben einen längeren Zeitraum oder eine andere
              Art.
            </p>
          ) : undefined
        }
        chart={
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                label="Kennzahl"
                value={state.metric}
                options={PERIOD_CHART_METRICS.map((m) => ({ value: m.key, label: m.label }))}
                onChange={(metric) => dispatch({ type: "setMetric", metric })}
              />
              <div className="ml-auto flex items-center gap-2">
                {!model.compareRange && (
                  <Segmented
                    label="Darstellung des Verlaufs"
                    value={model.view}
                    options={[
                      { value: "cards", label: "je Scheibe" },
                      { value: "months", label: "je Monat" },
                    ]}
                    onChange={(view) => dispatch({ type: "setView", view })}
                  />
                )}
                <HelpButton
                  label="Verlauf und Form"
                  helpId="verlauf-und-form"
                  onClick={() => onHelp("verlauf-und-form")}
                />
              </div>
            </div>
            <ChartSlot height={300}>
              {(width) => (
                <PeriodChart
                  // je Menge der Scheiben, Darstellung und Kennzahl neu: das Lineal fängt ohne Wahl an
                  key={`${state.family}:${state.kind}:${state.includeProbeOnly}:${model.range.fromMs}:${model.range.toMs}:${state.metric}:${model.view}:${model.compareRange?.fromMs ?? ""}`}
                  width={width}
                  model={model}
                  timeZone={TZ}
                  chosen={state.chosen}
                  onChoose={(id) => dispatch({ type: "pick", id })}
                />
              )}
            </ChartSlot>
            {reading && (
              <CardLine
                className="md:hidden"
                card={reading.card}
                value={readingValue}
                delta={model.deltas.get(reading.card.id)}
                metric={model.metric}
                timeZone={TZ}
                onOpen={open}
              />
            )}
          </div>
        }
        under={
          <div className="grid gap-2 rounded-2xl border border-border bg-card p-3.5">
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
        }
        result={result}
        aside={
          reading && (
            <div className="rounded-2xl border border-border bg-card p-4 max-md:hidden">
              <CardReadout
                card={reading.card}
                target={target}
                value={readingValue}
                point={reading.point}
                delta={model.deltas.get(reading.card.id)}
                metric={model.metric}
                timeZone={TZ}
                chosen={reading.chosen}
                onOpen={open}
              />
            </div>
          )
        }
        beside={[
          {
            id: "cards",
            node: (
              <div
                id="card-list"
                className="rounded-2xl border border-border bg-card p-2 md:flex md:max-h-full md:flex-col"
              >
                <CardList
                  className="md:min-h-0"
                  cards={model.cards}
                  values={model.values}
                  deltas={model.deltas}
                  metric={model.metric}
                  timeZone={TZ}
                  chosen={state.chosen}
                  onChoose={chooseFromList}
                />
              </div>
            ),
          },
        ]}
        below={[
          {
            id: "numbers",
            node: (
              <PeriodTiles
                tiles={model.tiles}
                compareLabel={model.compareRange?.label ?? null}
                onHelp={(key) => onHelp(helpForMetric(key)?.id ?? null)}
              />
            ),
          },
          {
            id: "analysis",
            node: (
              <PeriodInsights
                model={model}
                scoring={state.scoring}
                timeZone={TZ}
                explain={explain}
                onHelp={onHelp}
                onChoose={chooseFromRecord}
              />
            ),
          },
        ]}
      />
      <ReturnPill label={pill?.label ?? null} onReturn={back} onDismiss={close} />
    </div>
  )
}
