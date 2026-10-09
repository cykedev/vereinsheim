import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { parsePeriodHash } from "@vereinsheim/shot-ui/layout/sections"
import { backRoute, periodStateFromRoute } from "@vereinsheim/shot-ui/nav/navigate"
import { RouteLinkProvider } from "@vereinsheim/shot-ui/nav/RouteLink"
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
import { useCallback, useEffect, useMemo, useReducer, useState } from "react"

import { CardView, type OpenedCard } from "./CardView"
import type { LaborMode, Theme } from "./LaborHeader"
import { ListView } from "./ListView"
import { PeriodView } from "./PeriodView"
import { season } from "./season"
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
  // die Scrollstelle, an der eine Scheibe geöffnet wurde; der Rückweg kehrt dorthin zurück
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
  // Wege über Adressen (Plan N3, D3): Jeder Link der Bausteine landet hier, wie ein Seitenwechsel in der App. Die
  // Scheibe trägt den Zustand ihrer Herkunft, der Rückweg baut ihn aus ihrer Adresse neu; nur die Scrollstelle gehört
  // nicht in die Adresse und bleibt im Speicher
  const go = useCallback(
    (route: Route) => {
      // über die gezeigte Zeichenkette, wie ein Link in der App: Lesen und Schreiben laufen mit (Review N1)
      const next = routeFromHref(urlFromRoute(route))
      const fromCard = mode === "card" && opened !== null
      // zurück aus einer Scheibe an die Stelle, an der sie geöffnet wurde; sonst oben
      const y = fromCard ? (returnTo ?? 0) : 0
      if (next.page === "card") {
        const card = season().find((c) => c.id === next.id)
        if (!card) return
        if (!fromCard) setReturnTo(window.scrollY)
        setOpened({
          id: card.id,
          label: card.label,
          target: card.target,
          raw: card.raw,
          official: card.card.official,
          route: next,
        })
        setMode("card")
        requestAnimationFrame(() => scrollTo(0, 0))
        return
      }
      if (next.page === "cards") {
        changeList({ ...next.query, family: next.query.family ?? list.family })
        store.set("mode", "list")
        setMode("list")
        setOpened(null)
        const evening = next.evening
        requestAnimationFrame(() =>
          evening
            ? document.getElementById(evening)?.scrollIntoView({ block: "start" })
            : scrollTo(0, y)
        )
        return
      }
      if (next.page === "progress") {
        changePeriod({ type: "restore", state: periodStateFromRoute(next, period.family) })
        store.set("mode", "period")
        setMode("period")
        setOpened(null)
        requestAnimationFrame(() => scrollTo(0, y))
      }
    },
    [mode, opened, returnTo, list.family, period.family, changeList, changePeriod]
  )
  const links = useMemo(() => ({ navigate: go }), [go])
  // zurück dorthin, woher die Scheibe kam, gebaut aus ihrer gezeigten Adresse (Review N1)
  const goBack = useCallback(
    (route: CardRoute) => {
      const shown = routeFromHref(urlFromRoute(route))
      go(backRoute(shown.page === "card" ? shown : route))
    },
    [go]
  )
  const onExplain = useCallback((next: boolean) => {
    store.set("help", next ? "1" : "0")
    setExplain(next)
  }, [])

  return (
    <RouteLinkProvider value={links}>
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
        <ListView header={header} query={list} onQuery={changeList} scoring={devicesScoring()} />
      ) : (
        <PeriodView
          header={header}
          state={period}
          dispatch={changePeriod}
          explain={explain}
          onHelp={setHelpId}
        />
      )}
      <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
    </RouteLinkProvider>
  )
}
