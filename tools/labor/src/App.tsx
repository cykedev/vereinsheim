import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { parsePeriodHash } from "@vereinsheim/shot-ui/layout/sections"
import {
  backRoute,
  listFromProgress,
  listOnEvening,
  openCard as openCardRoute,
  periodStateFromRoute,
  progressFromList,
  progressRoute,
} from "@vereinsheim/shot-ui/nav/navigate"
import {
  DEFAULT_LIST,
  routeFromHref,
  urlFromRoute,
  type CardRoute,
  type ListQuery,
  type Route,
} from "@vereinsheim/shot-ui/nav/routes"
import {
  initialPeriodState,
  periodReducer,
  type PeriodAction,
} from "@vereinsheim/shot-ui/period/state"
import { useCallback, useEffect, useReducer, useState } from "react"

import { CardView, type OpenedCard } from "./CardView"
import type { LaborMode, Theme } from "./LaborHeader"
import { ListView } from "./ListView"
import { PeriodView } from "./PeriodView"
import type { SeasonCard } from "./season"
import { store } from "./store"

/** ein Abend als Anker der Scheiben-Liste (Plan N2, D1) */
const EVENING_ANCHOR = /^#\d{4}-\d{2}-\d{2}$/

/** die Wertung des Geräts, gemerkt von der Seite einer Scheibe und eines Zeitraums; die Liste hat keine eigene */
const devicesScoring = (): Scoring => (store.get("scoring") === "rings" ? "rings" : "decimal")

function useTheme(theme: Theme) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches)
      )
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])
}

/**
 * Das Labor (Plan L3, D17): zwei Ansichten, die Seite einer Scheibe und die Seite eines Zeitraums. Hier liegt, was
 * beide teilen (Darstellung, Erklärungen, das Blatt der Hilfe), der Zustand des Zeitraums (damit „Zurück zum
 * Zeitraum“ Filter und Wahl wiederfindet) und die aus der Saison geöffnete Scheibe.
 */
export function App({ commit }: { commit: string }) {
  const [mode, setMode] = useState<LaborMode>(() => {
    // nur die Anker, die es allein auf der Seite eines Zeitraums gibt; #numbers und #analysis haben beide Seiten
    const hash = typeof location === "undefined" ? "" : location.hash
    const anchor = parsePeriodHash(hash)
    if (anchor === "history" || anchor === "cards") return "period"
    // ein Abend (#2026-09-25) öffnet die Scheiben-Liste (Plan N2, D1)
    if (EVENING_ANCHOR.test(hash)) return "list"
    const saved = store.get("mode")
    return saved === "period" || saved === "list" ? saved : "card"
  })
  const [theme, setTheme] = useState<Theme>(() => (store.get("theme") as Theme | null) ?? "system")
  const [explain, setExplain] = useState(() => store.get("help") === "1")
  const [helpId, setHelpId] = useState<string | null>(null)
  const [period, dispatch] = useReducer(periodReducer, undefined, () =>
    initialPeriodState({
      family: store.get("period.family") === "lp-freihand" ? "lp-freihand" : "lg-freihand",
      scoring: store.get("scoring") === "rings" ? "rings" : "decimal",
    })
  )
  const [list, setList] = useState<ListQuery>(() => ({
    ...DEFAULT_LIST,
    family: store.get("period.family") === "lp-freihand" ? "lp-freihand" : "lg-freihand",
  }))
  // eine Disziplin für „Scheiben“ und „Zeitraum“: wer sie in einem wählt, findet sie im anderen wieder, auch über
  // die Leiste oben (User, 9. Oktober 2026); Filter, Zeitraum und Scrollstelle bleiben je Ansicht
  const changeList = useCallback(
    (next: ListQuery) => {
      setList(next)
      if (next.family && next.family !== period.family)
        dispatch({ type: "setFamily", family: next.family })
    },
    [period.family]
  )
  const changePeriod = useCallback((action: PeriodAction) => {
    dispatch(action)
    const family =
      action.type === "setFamily"
        ? action.family
        : action.type === "restore"
          ? action.state.family
          : null
    if (family) setList((current) => (current.family === family ? current : { ...current, family }))
  }, [])
  const [opened, setOpened] = useState<OpenedCard | null>(null)
  const [returnTo, setReturnTo] = useState<number | null>(null)
  useTheme(theme)
  useEffect(() => store.set("period.family", period.family), [period.family])
  // mit einem Abend als Anker geladen: nach dem Einhängen der Liste zu ihm springen, sofort (ohne Frame: ein Fenster,
  // das nicht zu sehen ist, bekommt keinen; Review N2)
  useEffect(() => {
    const hash = typeof location === "undefined" ? "" : location.hash
    if (EVENING_ANCHOR.test(hash))
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
  }, [])

  const changeMode = useCallback((next: LaborMode) => {
    store.set("mode", next)
    setOpened(null)
    setMode(next)
    scrollTo(0, 0)
  }, [])
  const header = {
    commit,
    mode,
    onMode: changeMode,
    theme,
    onTheme: (next: Theme) => {
      store.set("theme", next)
      setTheme(next)
    },
  }
  // Öffnen und Zurück über die Adressen (Plan N1): Die Scheibe trägt den Zustand des Zeitraums, „Zurück“ baut ihn
  // aus ihrer Adresse neu; nur die Scrollstelle gehört nicht in die Adresse und bleibt im Speicher
  const open = useCallback((card: SeasonCard, from: Route) => {
    setReturnTo(window.scrollY)
    setOpened({
      id: card.id,
      label: card.label,
      target: card.target,
      raw: card.raw,
      official: card.card.official,
      // aus der Liste in der Wertung, die die Zeile vorn zeigt: der amtlichen, ohne sie der des Geräts; aus dem
      // Fortschritt nimmt `openCard` die Wertung des Zeitraums
      route: openCardRoute(from, card.id, card.card.official ?? devicesScoring()),
    })
    setMode("card")
    requestAnimationFrame(() => scrollTo(0, 0))
  }, [])
  const openFromPeriod = useCallback(
    (card: SeasonCard) => open(card, progressRoute(period, null)),
    [open, period]
  )
  const openFromList = useCallback(
    (card: SeasonCard) => open(card, { page: "cards", query: list, evening: null }),
    [open, list]
  )
  // zurück dorthin, woher die Scheibe kam: in den Zeitraum oder in die Liste, gebaut aus ihrer Adresse
  const goBack = useCallback(
    (route: CardRoute) => {
      const y = returnTo
      // über die gezeigte Zeichenkette, wie ein Link in der App: Lesen und Schreiben laufen mit (Review N1)
      const shown = routeFromHref(urlFromRoute(route))
      const back = backRoute(shown.page === "card" ? shown : route)
      if (back.page === "progress") {
        changePeriod({ type: "restore", state: periodStateFromRoute(back, period.family) })
        setMode("period")
      } else {
        if (back.page === "cards")
          changeList({ ...back.query, family: back.query.family ?? list.family })
        setMode("list")
      }
      setOpened(null)
      // nach dem Einhängen der Seite an die gemerkte Stelle
      requestAnimationFrame(() => scrollTo(0, y ?? 0))
    },
    [returnTo, period.family, list.family, changeList, changePeriod]
  )
  // Querverweise (Plan N2, D8): Liste → Zeitraum und Zeitraum → Liste
  const toProgress = useCallback(() => {
    const target = progressFromList({ page: "cards", query: list, evening: null }, devicesScoring())
    changePeriod({ type: "restore", state: periodStateFromRoute(target, period.family) })
    store.set("mode", "period")
    setMode("period")
    scrollTo(0, 0)
  }, [list, period.family, changePeriod])
  const toList = useCallback(() => {
    changeList(listFromProgress(progressRoute(period, null)).query)
    store.set("mode", "list")
    setMode("list")
    scrollTo(0, 0)
  }, [period, changeList])
  // ein Mischabend: die andere Familie an diesem Abend zeigen, ohne Art und Merkmal, und zu ihm springen (D3)
  const showFamily = useCallback(
    (family: string, day: string) => {
      changeList(listOnEvening(list, family, day).query)
      requestAnimationFrame(() => document.getElementById(day)?.scrollIntoView({ block: "start" }))
    },
    [list, changeList]
  )
  const onExplain = useCallback((next: boolean) => {
    store.set("help", next ? "1" : "0")
    setExplain(next)
  }, [])

  return (
    <>
      {mode === "card" ? (
        <CardView
          key={opened?.id ?? "beispiele"}
          header={header}
          explain={explain}
          onExplain={onExplain}
          onHelp={setHelpId}
          opened={opened}
          onBack={goBack}
        />
      ) : mode === "list" ? (
        <ListView
          header={header}
          query={list}
          onQuery={changeList}
          scoring={devicesScoring()}
          onOpen={openFromList}
          onProgress={toProgress}
          onFamily={showFamily}
        />
      ) : (
        <PeriodView
          header={header}
          state={period}
          dispatch={changePeriod}
          explain={explain}
          onHelp={setHelpId}
          onOpen={openFromPeriod}
          onShowAll={toList}
        />
      )}
      <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
    </>
  )
}
