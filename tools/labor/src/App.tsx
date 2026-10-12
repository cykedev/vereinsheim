import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { parsePeriodHash } from "@vereinsheim/shot-ui/layout/sections"
import { AppFrame } from "@vereinsheim/shot-ui/layout/AppFrame"
import { areaLinks, areaOf, type Area } from "@vereinsheim/shot-ui/nav/areas"
import { periodStateFromRoute, progressRoute } from "@vereinsheim/shot-ui/nav/navigate"
import { RouteLinkProvider } from "@vereinsheim/shot-ui/nav/RouteLink"
import { cardMeta } from "@vereinsheim/shot-ui/readout/cardMeta"
import {
  DEFAULT_LIST,
  routeFromHref,
  urlFromRoute,
  type ListQuery,
  type Route,
} from "@vereinsheim/shot-ui/nav/routes"
import {
  initialPeriodState,
  periodReducer,
  type PeriodAction,
  type PeriodState,
} from "@vereinsheim/shot-ui/period/state"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"

import { CardView, type OpenedCard } from "./CardView"
import type { LaborMode, LaborView, Theme } from "./LaborPanel"
import { ListView } from "./ListView"
import { leaveFirstView } from "./loadAnchor"
import { PeriodView } from "./PeriodView"
import { PlaceholderView, type PlaceholderPage } from "./PlaceholderView"
import { OPEN_EXAMPLES, StartView } from "./StartView"
import { ThemeSwitch } from "./ThemeSwitch"
import { season, SEASON_TIME_ZONE } from "./season"
import { store } from "./store"

/** ein Abend als Anker der Scheiben-Liste (Plan N2, D1) */
const EVENING_ANCHOR = /^#\d{4}-\d{2}-\d{2}$/

/** die Bereiche, die das Labor nur als Platzhalter zeigt (Plan N3, D7) */
const PLACEHOLDERS: readonly PlaceholderPage[] = ["scan", "profile", "admin"]
const isPlaceholder = (mode: string): mode is PlaceholderPage =>
  (PLACEHOLDERS as readonly string[]).includes(mode)

/**
 * Schlüssel der Scrollstelle eines Bereichs (D4): die Adresse der Liste, des Fortschritts ohne Wahl und Wertung. Beide
 * bringt der Rückweg aus der Scheibe mit, sie ändern nicht, wo man auf der Seite ist.
 */
const listKey = (query: ListQuery) => urlFromRoute({ page: "cards", query, evening: null })
const progressKey = (state: PeriodState) =>
  urlFromRoute(progressRoute({ ...state, chosen: null, scoring: "decimal" }, null))

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
 * Das Labor (Plan L3, N2, N3): die App im Rahmen (Scheiben, Fortschritt, eine Scheibe der Saison, Platzhalter für
 * Start, Scannen, Profil, Admin) und die Beispielscheiben. Hier liegt, was alle teilen (Darstellung, Erklärungen,
 * das Blatt der Hilfe), der Zustand von Liste und Fortschritt, die geöffnete Scheibe und der Router im Speicher:
 * Jeder Link der Bausteine landet in `go`.
 */
export function App({ commit }: { commit: string }) {
  const [mode, setMode] = useState<LaborMode>(() => {
    // nur die Anker, die es allein auf der Seite eines Zeitraums gibt; #analysis hat auch die Scheibe, #numbers seit U1
    // nicht mehr
    const hash = typeof location === "undefined" ? "" : location.hash
    const anchor = parsePeriodHash(hash)
    if (anchor === "history" || anchor === "cards" || anchor === "numbers") return "period"
    // ein Abend (#2026-09-25) öffnet die Scheiben-Liste (Plan N2, D1)
    if (EVENING_ANCHOR.test(hash)) return "list"
    const saved = store.get("mode")
    return saved === "period" ||
      saved === "list" ||
      saved === "start" ||
      (saved && isPlaceholder(saved))
      ? saved
      : "card"
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
  // wohin man in die Liste kam: der Abend aus dem Anker, die Scheibe aus `pick` (markiert)
  const [listMark, setListMark] = useState<{ evening: string | null; pick: string | null }>({
    evening: null,
    pick: null,
  })
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
  // je Bereich die letzte Scrollstelle mit ihrer Adresse: zur selben Adresse zurück heißt an dieselbe Stelle (D4)
  const scrolls = useRef(new Map<"cards" | "progress", { key: string; y: number }>())
  // wohin „Zurück zur App“ aus den Beispielen führt
  const appRoute = useRef<Route | null>(null)
  useTheme(theme)
  useEffect(() => store.set("period.family", period.family), [period.family])
  // mit einem Abend als Anker geladen: nach dem Einhängen der Liste zu ihm springen, sofort (ohne Frame: ein Fenster,
  // das nicht zu sehen ist, bekommt keinen; Review N2)
  useEffect(() => {
    const hash = typeof location === "undefined" ? "" : location.hash
    if (EVENING_ANCHOR.test(hash)) {
      setListMark({ evening: hash.slice(1), pick: null })
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
    }
  }, [])

  const listRoute = useMemo(
    () => ({
      page: "cards" as const,
      query: list,
      evening: null,
      ...(listMark.pick ? { pick: listMark.pick } : {}),
    }),
    [list, listMark.pick]
  )
  const progressHere = useMemo(() => progressRoute(period, null), [period])
  const view: LaborView = mode === "card" && !opened ? "samples" : "app"
  // die Adresse der gezeigten Seite der App
  const currentRoute = (): Route =>
    mode === "list"
      ? listRoute
      : mode === "period"
        ? progressHere
        : mode === "card"
          ? (opened?.route ?? listRoute)
          : mode === "admin"
            ? { page: "admin", section: null }
            : { page: mode }
  // die Scrollstelle des Bereichs, den man verlässt
  const leave = () => {
    // ein Wechsel der Ansicht: der Anker beim Laden gilt nicht mehr, die neue Seite beginnt oben
    leaveFirstView()
    if (mode === "list") scrolls.current.set("cards", { key: listKey(list), y: window.scrollY })
    if (mode === "period")
      scrolls.current.set("progress", { key: progressKey(period), y: window.scrollY })
  }
  const show = (next: LaborMode) => {
    store.set("mode", next)
    setMode(next)
  }

  // Wege über Adressen (Plan N3, D3): Jeder Link der Bausteine und der Navigation landet hier, wie ein Seitenwechsel
  // in der App. Die Scheibe trägt den Zustand ihrer Herkunft, der Rückweg baut ihn aus ihrer Adresse neu; nur die
  // Scrollstelle gehört nicht in die Adresse und bleibt im Speicher
  const go = (route: Route) => {
    // über die gezeigte Zeichenkette, wie ein Link in der App: Lesen und Schreiben laufen mit (Review N1)
    const next = routeFromHref(urlFromRoute(route))
    if (next.page === "card") {
      const card = season().find((c) => c.id === next.id)
      if (!card) return
      leave()
      setOpened({
        id: card.id,
        label: card.label,
        target: card.target,
        raw: card.raw,
        official: card.card.official,
        meta: cardMeta(card.card, SEASON_TIME_ZONE),
        route: next,
        own: card.own !== undefined,
      })
      show("card")
      requestAnimationFrame(() => scrollTo(0, 0))
      return
    }
    if (next.page === "cards") {
      const query = { ...next.query, family: next.query.family ?? list.family }
      leave()
      changeList(query)
      setOpened(null)
      show("list")
      const saved = scrolls.current.get("cards")
      const y = saved?.key === listKey(query) ? saved.y : 0
      const evening = next.evening
      const pick = next.pick ?? null
      // wohin man kommt, ist markiert: der Abend aus dem Anker, die Scheibe aus `pick` (12. Oktober 2026)
      setListMark({ evening, pick })
      requestAnimationFrame(() =>
        pick
          ? document
              .querySelector(`[data-card-row="${CSS.escape(pick)}"]`)
              ?.scrollIntoView({ block: "center" })
          : evening
            ? document.getElementById(evening)?.scrollIntoView({ block: "start" })
            : scrollTo(0, y)
      )
      return
    }
    if (next.page === "progress") {
      const state = periodStateFromRoute(next, period.family)
      leave()
      changePeriod({ type: "restore", state })
      setOpened(null)
      show("period")
      const saved = scrolls.current.get("progress")
      const y = saved?.key === progressKey(state) ? saved.y : 0
      requestAnimationFrame(() => scrollTo(0, y))
      return
    }
    const page = next.page === "open" ? "start" : next.page === "trash" ? "profile" : next.page
    if (page === "start" || isPlaceholder(page)) {
      leave()
      setOpened(null)
      show(page)
      requestAnimationFrame(() => scrollTo(0, 0))
    }
  }
  // der Provider bleibt gleich, seine Links rufen immer das aktuelle `go` (nach dem Rendern gesetzt, nicht dabei)
  const goRef = useRef(go)
  useLayoutEffect(() => {
    goRef.current = go
  })
  const links = useMemo(() => ({ navigate: (route: Route) => goRef.current(route) }), [])

  const changeView = (next: LaborView) => {
    if (next === view) return
    if (next === "samples") {
      appRoute.current = currentRoute()
      leave()
      setOpened(null)
      show("card")
      scrollTo(0, 0)
    } else go(appRoute.current ?? listRoute)
  }
  // was das Blatt „Labor“ braucht; die Darstellung ist eine Einstellung der App (Seitenleiste, Profil)
  const header = { commit, mode, view, onView: changeView }
  const changeTheme = (next: Theme) => {
    store.set("theme", next)
    setTheme(next)
  }
  // die Wertung des Geräts (U2, D4): eine Einstellung in Profil; der Fortschritt folgt ihr, Liste und Start lesen sie
  const changeScoring = (next: Scoring) => {
    store.set("scoring", next)
    changePeriod({ type: "setScoring", scoring: next })
  }
  const onExplain = useCallback((next: boolean) => {
    store.set("help", next ? "1" : "0")
    setExplain(next)
  }, [])
  const current: Area | null = view === "samples" ? null : areaOf(currentRoute())

  return (
    <RouteLinkProvider value={links}>
      <AppFrame
        current={current}
        links={areaLinks({ cards: listRoute, progress: progressHere }, period.family)}
        openCount={OPEN_EXAMPLES.length}
        isAdmin
        sidebarFooter={<ThemeSwitch theme={theme} onTheme={changeTheme} />}
      >
        {mode === "card" ? (
          <CardView
            key={opened?.id ?? "beispiele"}
            header={header}
            explain={explain}
            onExplain={onExplain}
            onHelp={setHelpId}
            onScoring={changeScoring}
            opened={opened}
          />
        ) : mode === "list" ? (
          <ListView
            header={header}
            query={list}
            onQuery={(query) => {
              // ein Filter verlässt den Abend und die Scheibe, von der man kam
              setListMark({ evening: null, pick: null })
              changeList(query)
            }}
            scoring={devicesScoring()}
            evening={listMark.evening}
            pick={listMark.pick}
          />
        ) : mode === "period" ? (
          <PeriodView
            header={header}
            state={period}
            dispatch={changePeriod}
            explain={explain}
            onHelp={setHelpId}
          />
        ) : mode === "start" ? (
          <StartView header={header} scoring={devicesScoring()} family={period.family} />
        ) : (
          <PlaceholderView
            header={header}
            page={mode}
            theme={theme}
            onTheme={changeTheme}
            scoring={devicesScoring()}
            onScoring={changeScoring}
          />
        )}
      </AppFrame>
      <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
    </RouteLinkProvider>
  )
}
