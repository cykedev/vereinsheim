"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react"

import { ScoringChip } from "@vereinsheim/shot-ui/controls/ScoringChip"
import { HelpTextsProvider } from "@vereinsheim/shot-ui/help/HelpTexts"
import { PeriodPage } from "@vereinsheim/shot-ui/layout/PeriodPage"
import { ReturnPill } from "@vereinsheim/shot-ui/layout/ReturnPill"
import { SectionNav } from "@vereinsheim/shot-ui/layout/SectionNav"
import { useActiveSection } from "@vereinsheim/shot-ui/layout/useActiveSection"
import { useReturnJump } from "@vereinsheim/shot-ui/layout/useReturnJump"
import { isCardId } from "@vereinsheim/shot-ui/nav/routes"
import { rangeDays } from "@vereinsheim/shot-ui/period/calendar"
import type { RenderItemLink } from "@vereinsheim/shot-ui/period/links"
import { periodReading, type PeriodModel } from "@vereinsheim/shot-ui/period/model"
import { PeriodControls, PeriodHeader } from "@vereinsheim/shot-ui/period/PeriodHeader"
import { PeriodResult } from "@vereinsheim/shot-ui/period/PeriodResult"
import { PeriodWordsProvider } from "@vereinsheim/shot-ui/period/PeriodWords"
import { periodSentence } from "@vereinsheim/shot-ui/period/sentence"
import {
  periodReducer,
  type PeriodAction,
  type PeriodState,
} from "@vereinsheim/shot-ui/period/state"
import { countOf } from "@vereinsheim/shot-ui/period/words"
import { useHelp } from "@vereinsheim/ui/design2/help-sheet"

import { helpHeading } from "@/lib/help/topics"
import { statisticsUrl, type DisciplineOption } from "@/lib/statistics/page"
import { SESSION_WORDS, STATISTICS_SECTIONS } from "@/lib/statistics/words"

import {
  statisticsBelow,
  StatisticsChart,
  StatisticsList,
  StatisticsReadout,
  StatisticsVolume,
} from "./StatisticsParts"

/** so lange ruht die Wahl, bevor sie in die Adresse geht */
const ADDRESS_DELAY_MS = 250
const SECTION_IDS = STATISTICS_SECTIONS.map((s) => s.id)

/**
 * Statistik: die Seite eines Zeitraums aus `shot-ui` wie Spiegels Fortschritt, das Modell hat der Server gerechnet.
 * Filter schreiben die Adresse und rechnen auf dem Server neu; eine Wahl (Verlauf, Liste, Rekord) bleibt im Browser und
 * geht verzögert mit `replaceState` in die Adresse. Die Wertung steht nur bei Disziplinen in Zehnteln zur Wahl.
 */
export function StatisticsScreen({
  model: base,
  state,
  options,
  timeZone,
  analysis,
}: {
  model: PeriodModel
  state: PeriodState
  options: DisciplineOption[]
  timeZone: string
  /** Einflüsse und Selbstbild über die Einheiten des Zeitraums, vom Server gerechnet */
  analysis?: { influences: ReactNode; selfImage: ReactNode }
}) {
  const router = useRouter()
  const help = useHelp()
  const onHelp = useCallback((id: string | null) => id && help(id), [help])
  const active = useActiveSection(SECTION_IDS)
  const { pill, jumpTo, back, close } = useReturnJump()
  const search = useSearchParams()
  const [pending, startTransition] = useTransition()
  const option = options.find((o) => o.value === state.family)
  const switchable = option?.switchable ?? false

  // die Wahl lebt im Browser; beim ersten Zeichnen gilt `pick` der Adresse (Zurück im Browser)
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
  }
  const current: PeriodState = useMemo(() => ({ ...state, chosen }), [state, chosen])
  const model = useMemo(() => ({ ...base, reading: periodReading(base, chosen) }), [base, chosen])

  const dispatch = useCallback(
    (action: PeriodAction) => {
      const next = periodReducer(current, action)
      if (action.type === "choose" || action.type === "pick") {
        setChosen(next.chosen)
        setDirty(true)
        return
      }
      const nextSwitchable = options.find((o) => o.value === next.family)?.switchable ?? false
      startTransition(() => router.push(statisticsUrl(next, nextSwitchable), { scroll: false }))
    },
    [current, options, router]
  )

  // die Wahl in die Adresse, erst wenn sie ruht und keine Navigation läuft
  const address = useMemo(() => statisticsUrl(current, switchable), [current, switchable])
  useEffect(() => {
    if (!dirty || pending) return
    const timer = setTimeout(() => {
      window.history.replaceState(null, "", `${address}${window.location.hash}`)
    }, ADDRESS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [address, dirty, pending])

  const sessionLink: RenderItemLink = (id, props) => <Link href={`/sessions/${id}`} {...props} />
  const result = <PeriodResult model={model} timeZone={timeZone} onHelp={onHelp} />
  const empty = model.cards.length === 0
  const parts = { model, state: current, timeZone, onHelp, sessionLink, dispatch, jumpTo }

  return (
    <HelpTextsProvider lookup={helpHeading}>
      <PeriodWordsProvider words={SESSION_WORDS}>
        <PeriodPage
          header={
            <PeriodHeader
              title={model.range.label}
              meta={[
                option?.label ?? "",
                countOf(model.cards.length, SESSION_WORDS),
                rangeDays(model.range, timeZone),
              ]}
              controls={
                <PeriodControls
                  state={current}
                  dispatch={dispatch}
                  range={model.range}
                  compareRange={model.compareRange}
                  named={[]}
                  timeZone={timeZone}
                  families={options}
                  probeOnlySwitch={false}
                  actions={
                    switchable && (
                      <ScoringChip
                        scoring={state.scoring}
                        texts={{ rings: "In ganzen Ringen", decimal: "In Zehnteln" }}
                        label="Wertung"
                        onChange={(scoring) => dispatch({ type: "setScoring", scoring })}
                      />
                    )
                  }
                />
              }
              result={empty ? null : result}
              sentence={empty ? null : periodSentence(model, SESSION_WORDS)}
            />
          }
          nav={<SectionNav active={active} sections={STATISTICS_SECTIONS} />}
          empty={
            empty ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-[14px] text-foreground-2">
                Keine Einheit in diesem Zeitraum. Wähle oben einen längeren Zeitraum oder eine
                andere Art.
              </p>
            ) : undefined
          }
          chart={<StatisticsChart {...parts} />}
          under={<StatisticsVolume {...parts} />}
          result={result}
          aside={<StatisticsReadout {...parts} />}
          beside={[{ id: "cards", node: <StatisticsList {...parts} /> }]}
          below={statisticsBelow({ ...parts, analysis })}
        />
        <ReturnPill label={pill?.label ?? null} onReturn={back} onDismiss={close} />
      </PeriodWordsProvider>
    </HelpTextsProvider>
  )
}
