"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"

import { markShots, type CardMark, type MarkShot } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { ChartSlot } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { ScoringChip } from "@vereinsheim/shot-ui/controls/ScoringChip"
import { HelpButton, HelpIcon } from "@vereinsheim/shot-ui/help/HelpButton"
import { PeriodPage } from "@vereinsheim/shot-ui/layout/PeriodPage"
import { ReturnPill } from "@vereinsheim/shot-ui/layout/ReturnPill"
import { SectionNav } from "@vereinsheim/shot-ui/layout/SectionNav"
import { PERIOD_SECTIONS, type PeriodSection } from "@vereinsheim/shot-ui/layout/sections"
import { useActiveSection } from "@vereinsheim/shot-ui/layout/useActiveSection"
import { useReturnJump } from "@vereinsheim/shot-ui/layout/useReturnJump"
import { listFromProgress, openCard, progressRoute } from "@vereinsheim/shot-ui/nav/navigate"
import { isCardId, urlFromRoute } from "@vereinsheim/shot-ui/nav/routes"
import { rangeDays } from "@vereinsheim/shot-ui/period/calendar"
import { CardList } from "@vereinsheim/shot-ui/period/CardList"
import { CardLine, CardReadout } from "@vereinsheim/shot-ui/period/CardReadout"
import { periodReading, type PeriodModel } from "@vereinsheim/shot-ui/period/model"
import { PeriodChart } from "@vereinsheim/shot-ui/period/PeriodChart"
import { PeriodChartBar } from "@vereinsheim/shot-ui/period/PeriodChartBar"
import { PeriodControls, PeriodHeader } from "@vereinsheim/shot-ui/period/PeriodHeader"
import { PeriodInsights } from "@vereinsheim/shot-ui/period/PeriodInsights"
import { PeriodResult } from "@vereinsheim/shot-ui/period/PeriodResult"
import { PeriodTiles } from "@vereinsheim/shot-ui/period/PeriodTiles"
import { periodSentence } from "@vereinsheim/shot-ui/period/sentence"
import {
  periodReducer,
  type PeriodAction,
  type PeriodState,
} from "@vereinsheim/shot-ui/period/state"
import { VolumeChart } from "@vereinsheim/shot-ui/period/VolumeChart"
import { CalendarBrowser } from "@vereinsheim/shot-ui/period/CalendarChart"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"

import { useHelp } from "@/components/shell/HelpContext"
import { Page } from "@/components/shell/Page"
import { useSavedChoice } from "@/components/shell/useSavedChoice"
import { cardMarksAction } from "@/lib/marks-actions"
import { marksById } from "@/lib/marks"
import type { PageContext } from "@/lib/page-context"
import type { FamilyOption } from "@/lib/pages"
import { rememberPeriod } from "@/lib/period-memory-client"
import { setFamilyScoring } from "@/lib/scoring-actions"

const PERIOD_IDS: readonly PeriodSection[] = PERIOD_SECTIONS.map((s) => s.id)
/** so lange ruht die Wahl, bevor sie in die Adresse geht bzw. ihre Lagen geholt werden */
const ADDRESS_DELAY_MS = 250
const MARKS_DELAY_MS = 150

/**
 * die Adresse des Fortschritts: ohne Wertung, sie ist die der Familie (gespeichert) und gehört nicht in die Adresse; ein
 * `scoring` darin gilt beim Laden nicht
 */
const addressOf = (state: PeriodState) =>
  urlFromRoute(progressRoute({ ...state, scoring: "decimal" }, null))

/**
 * Fortschritt (N7, Plan `plans/2026-10-10-spiegel-fortschritt.md`): die Seite eines Zeitraums aus `shot-ui`, das Modell
 * hat der Server gerechnet (`periodModel` aus den Projektionen, leicht gemacht). Filter schreiben die Adresse und
 * rechnen auf dem Server neu; eine Wahl (Verlauf, Liste, Rekord) bleibt im Browser: Sie ändert die Ablesung, schreibt
 * `pick` verzögert mit `replaceState` und holt die Lagen der kleinen Scheibe nach (`cardMarksAction`). Gerechnet wird in
 * der Wertung der Familie; der Schalter in der Ergebnis-Box speichert sie (`setFamilyScoring`), danach rechnet der Server
 * neu (`router.refresh()` in `useSavedChoice`, ohne zu scrollen).
 */
export function ProgressScreen({
  model: base,
  state,
  marks: initialMarks,
  families,
  context,
}: {
  /** leichtes Modell vom Server, mit der Ablesung zur Wahl der Adresse */
  model: PeriodModel
  state: PeriodState
  /** die Lagen der Scheibe, die die Ablesung beim Laden zeigt */
  marks: Record<string, CardMark[]>
  families: FamilyOption[]
  context: PageContext
}) {
  const router = useRouter()
  const help = useHelp()
  const onHelp = useCallback((id: string | null) => id && help(id), [help])
  const { timeZone, named } = context
  // die Wertung der Familie als Wechsel-Chip in der Zeile der Filter
  const familyScoring = useSavedChoice({
    value: state.scoring,
    scope: state.family,
    save: (scoring) => setFamilyScoring(state.family, scoring),
    notSaved: "Die Wertung ließ sich nicht speichern.",
  })
  const active = useActiveSection(PERIOD_IDS)
  const { pill, jumpTo, back, close } = useReturnJump()
  const [explain, setExplain] = useState(false)
  // Umfang als Säulen je Woche oder als Kalender der Trainingstage (T7); wie gezeichnet, nicht in der Adresse
  const [volumeView, setVolumeView] = useState<"weeks" | "calendar">("weeks")

  const search = useSearchParams()
  const [pending, startTransition] = useTransition()

  // die Lagen der kleinen Scheibe: die vom Server, weitere zu einer neuen Wahl nachgeholt und gemerkt
  const [marks, setMarks] = useState<ReadonlyMap<string, readonly MarkShot[]>>(() =>
    marksById(initialMarks)
  )
  // die Wahl lebt im Browser. Beim ersten Zeichnen gilt `pick` der Adresse: Nach Zurück im Browser zeigt der Router den
  // Stand vom Server ohne die Wahl, die Adresse trägt sie (Review). Ein neuer Stand vom Server (Filter) bringt seine
  // eigene Wahl und die Lagen ihrer Ablesung mit
  const [chosen, setChosen] = useState(() => {
    const pick = search.get("pick")
    return pick && isCardId(pick) ? pick : state.chosen
  })
  const [seen, setSeen] = useState(state)
  const [dirty, setDirty] = useState(false)
  if (seen !== state) {
    setSeen(state)
    setChosen(state.chosen)
    setDirty(false)
    setMarks((previous) => new Map([...previous, ...marksById(initialMarks)]))
  }
  const current: PeriodState = useMemo(() => ({ ...state, chosen }), [state, chosen])
  const model = useMemo(() => ({ ...base, reading: periodReading(base, chosen) }), [base, chosen])

  const dispatch = useCallback(
    (action: PeriodAction) => {
      const next = periodReducer(current, action)
      if (action.type === "choose" || action.type === "pick") {
        // das Lineal meldet jede Bewegung: nur die Ablesung, die Adresse folgt verzögert (unten)
        setChosen(next.chosen)
        setDirty(true)
        return
      }
      // ein übernommener Zeitraum gilt auch beim nächsten Öffnen (User, 15. Oktober 2026), nie das bloße Öffnen
      if (action.type === "setFilters" || action.type === "setChoice") rememberPeriod(next.choice)
      // die Seite bleibt, wo sie ist (die Schalter stehen im Verlauf, der ab 768 px klebt)
      startTransition(() => router.push(addressOf(next), { scroll: false }))
    },
    [current, router]
  )

  // die Wahl in die Adresse, erst wenn sie ruht: Ein Zug über den Verlauf wählt bei jeder Bewegung, und Browser
  // begrenzen `replaceState` (Safari wirft). Nicht während eine Navigation läuft, sonst bricht der Router sie ab (Review)
  const address = useMemo(() => addressOf(current), [current])
  useEffect(() => {
    if (!dirty || pending) return
    const timer = setTimeout(() => {
      window.history.replaceState(null, "", `${address}${window.location.hash}`)
    }, ADDRESS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [address, dirty, pending])

  const reading = model.reading
  const readingId = reading?.card.id ?? null
  // die Lagen der Ablesung, erst wenn die Wahl ruht; eine Antwort gilt für ihre Scheibe, auch wenn schon eine andere
  // gewählt ist. Ein Fehler wird nicht gemerkt, die nächste Wahl versucht es wieder (Review)
  useEffect(() => {
    if (!readingId || marks.has(readingId)) return
    const timer = setTimeout(() => {
      cardMarksAction(readingId)
        .then((result) => {
          if ("success" in result)
            setMarks((previous) =>
              new Map(previous).set(readingId, result.data ? markShots(result.data) : [])
            )
        })
        .catch(() => {})
    }, MARKS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [readingId, marks])

  const readingValue = reading ? (model.values.find((v) => v.id === reading.card.id) ?? null) : null
  // die Wege als Adressen: eine Scheibe mit diesem Fortschritt als Herkunft, in ihrer Wertung; „Alle in Scheiben zeigen“
  // ohne Wertung
  const cardRoute = (id: string) => openCard(progressRoute(current, null), id)
  const here = progressRoute({ ...current, scoring: "decimal" }, null)
  const chooseFromList = useCallback(
    (id: string) => {
      // nur eine neue Wahl holt den Verlauf ins Bild, das Abwählen nicht
      if (id !== chosen) jumpTo(document.querySelector('[data-section="history"]'), "Scheiben")
      dispatch({ type: "choose", id })
    },
    [dispatch, jumpTo, chosen]
  )
  const chooseFromRecord = useCallback(
    (id: string) => {
      if (chosen !== id) dispatch({ type: "choose", id })
      // nach oben zur gewählten Scheibe: an den Anfang von Verlauf und Ablesung, sobald die Ablesung außer Sicht ist
      const shown = [...document.querySelectorAll("[data-card-readout], [data-card-line]")].find(
        (el) => el.getClientRects().length > 0
      )
      jumpTo(document.getElementById("history"), "Analyse", shown ?? null)
    },
    [dispatch, jumpTo, chosen]
  )

  const option = families.find((f) => f.value === state.family)
  const target = TARGETS[option?.targetId ?? "lp-10m"]
  const result = <PeriodResult model={model} timeZone={timeZone} onHelp={onHelp} />
  const sentence = periodSentence(model)
  // Training nur aus Probe zählt nur mit dem Schalter: sonst steht es in der Liste, aber nicht im Ergebnis
  const excluded = model.excludedProbeOnly
  const cardsText = `${model.cards.length} Scheiben${excluded ? `, ${excluded} nur Probe nicht gezählt` : ""}`
  const empty = model.cards.length === 0

  return (
    <Page>
      <PeriodPage
        header={
          <PeriodHeader
            title={model.range.label}
            meta={[option?.label ?? "", cardsText, rangeDays(model.range, timeZone)]}
            controls={
              // die Wertung der Familie in der Zeile der Filter wie in der Liste, ein Fehler darunter (User,
              // 13. Oktober 2026)
              <div className="grid gap-2">
                <PeriodControls
                  state={current}
                  dispatch={dispatch}
                  range={model.range}
                  compareRange={model.compareRange}
                  named={named}
                  timeZone={timeZone}
                  families={families}
                  actions={
                    <ScoringChip
                      scoring={familyScoring.shown}
                      texts={{ rings: "In ganzen Ringen", decimal: "In Zehnteln" }}
                      label="Wertung"
                      onChange={familyScoring.change}
                    />
                  }
                />
                {familyScoring.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {familyScoring.error}
                  </p>
                )}
              </div>
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
          <div className="grid min-w-0 gap-3 rounded-2xl border border-border bg-card p-3.5">
            <PeriodChartBar
              metric={state.metric}
              view={model.compareRange ? null : model.view}
              onMetric={(metric) => dispatch({ type: "setMetric", metric })}
              onView={(view) => dispatch({ type: "setView", view })}
              onHelp={() => onHelp("verlauf-und-form")}
            />
            <ChartSlot height={300}>
              {(width) => (
                <PeriodChart
                  // je Menge der Scheiben, Darstellung und Kennzahl neu: das Lineal fängt ohne Wahl an
                  key={`${state.family}:${state.kind}:${state.includeProbeOnly}:${model.range.fromMs}:${model.range.toMs}:${state.metric}:${model.view}:${model.compareRange?.fromMs ?? ""}`}
                  width={width}
                  model={model}
                  timeZone={timeZone}
                  chosen={chosen}
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
                timeZone={timeZone}
                cardRoute={cardRoute}
                onHelp={onHelp}
              />
            )}
          </div>
        }
        under={
          <div className="grid gap-2 rounded-2xl border border-border bg-card p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">
                {volumeView === "weeks" ? "Umfang je Woche" : "Trainingstage"}
              </h2>
              <div className="flex items-center gap-2">
                <Segmented
                  label="Umfang zeigen als"
                  options={[
                    { value: "weeks", label: "Wochen" },
                    { value: "calendar", label: "Kalender" },
                  ]}
                  value={volumeView}
                  onChange={setVolumeView}
                />
                <HelpButton
                  label="Trainingsumfang"
                  helpId="trainingsumfang"
                  onClick={() => onHelp("trainingsumfang")}
                />
              </div>
            </div>
            {volumeView === "weeks" ? (
              <ChartSlot height={170}>
                {(width) => (
                  <VolumeChart
                    key={`${state.family}:${state.kind}:${model.range.fromMs}:${model.range.toMs}`}
                    width={width}
                    weeks={model.weeks}
                  />
                )}
              </ChartSlot>
            ) : (
              <CalendarBrowser
                // ein neuer Zeitraum beginnt wieder an seinem Ende (Rückmeldung 8)
                key={`${state.family}:${state.kind}:${model.calendar.from}:${model.calendar.to}`}
                end={model.calendar.to}
                period={{ from: model.calendar.from, to: model.calendar.to }}
                today={model.calendar.today}
                days={model.calendar.all}
                dayRoute={(day) => {
                  // an den Abend, ohne die Wahl des Verlaufs: sonst wäre in der Liste eine fremde Scheibe markiert (Review)
                  const { pick: _pick, ...list } = listFromProgress(here)
                  // ein Tag außerhalb des Zeitraums (geblättert) steht nur in der Liste ohne Zeitraum
                  const inPeriod = day >= model.calendar.from && day <= model.calendar.to
                  return {
                    ...list,
                    query: inPeriod ? list.query : { ...list.query, range: null },
                    evening: day,
                  }
                }}
              />
            )}
          </div>
        }
        result={result}
        aside={
          reading && (
            <div className="rounded-2xl border border-border bg-card p-4 max-md:hidden">
              <CardReadout
                card={reading.card}
                marks={marks.get(reading.card.id) ?? null}
                target={target}
                value={readingValue}
                point={reading.point}
                delta={model.deltas.get(reading.card.id)}
                metric={model.metric}
                timeZone={timeZone}
                chosen={reading.chosen}
                cardRoute={cardRoute}
                onHelp={onHelp}
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
                  timeZone={timeZone}
                  chosen={chosen}
                  onChoose={chooseFromList}
                  showAll={listFromProgress(here)}
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
              <div className="grid gap-2">
                <div className="flex justify-end">
                  <ToggleChip pressed={explain} icon={<HelpIcon />} onPressedChange={setExplain}>
                    Erklärungen
                  </ToggleChip>
                </div>
                <PeriodInsights
                  model={model}
                  scoring={state.scoring}
                  timeZone={timeZone}
                  explain={explain}
                  onHelp={onHelp}
                  onChoose={chooseFromRecord}
                  chosen={chosen}
                />
              </div>
            ),
          },
        ]}
      />
      <ReturnPill label={pill?.label ?? null} onReturn={back} onDismiss={close} />
    </Page>
  )
}
