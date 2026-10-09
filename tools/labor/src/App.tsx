import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { parsePeriodHash } from "@vereinsheim/shot-ui/layout/sections"
import {
  backRoute,
  openCard as openCardRoute,
  periodStateFromRoute,
  progressRoute,
} from "@vereinsheim/shot-ui/nav/navigate"
import type { CardRoute } from "@vereinsheim/shot-ui/nav/routes"
import { initialPeriodState, periodReducer } from "@vereinsheim/shot-ui/period/state"
import { useCallback, useEffect, useReducer, useState } from "react"

import { CardView, type OpenedCard } from "./CardView"
import type { LaborMode, Theme } from "./LaborHeader"
import { PeriodView } from "./PeriodView"
import type { SeasonCard } from "./season"
import { store } from "./store"

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
    // nur die Anker, die es allein auf der Seite eines Zeitraums gibt; #zahlen und #analyse haben beide Seiten
    const anchor = typeof location === "undefined" ? null : parsePeriodHash(location.hash)
    if (anchor === "verlauf" || anchor === "scheiben") return "period"
    return store.get("mode") === "period" ? "period" : "card"
  })
  const [theme, setTheme] = useState<Theme>(() => (store.get("theme") as Theme | null) ?? "system")
  const [explain, setExplain] = useState(() => store.get("help") === "1")
  const [helpId, setHelpId] = useState<string | null>(null)
  const [period, dispatch] = useReducer(periodReducer, undefined, () =>
    initialPeriodState({
      family: store.get("period.family") === "lp-10m" ? "lp-10m" : "lg-10m",
      scoring: store.get("scoring") === "rings" ? "rings" : "decimal",
    })
  )
  const [opened, setOpened] = useState<OpenedCard | null>(null)
  const [returnTo, setReturnTo] = useState<number | null>(null)
  useTheme(theme)
  useEffect(() => store.set("period.family", period.family), [period.family])

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
  const openCard = useCallback(
    (card: SeasonCard) => {
      setReturnTo(window.scrollY)
      setOpened({
        id: card.id,
        label: card.label,
        target: card.family,
        raw: card.raw,
        route: openCardRoute(progressRoute(period, null), card.id),
      })
      setMode("card")
      requestAnimationFrame(() => scrollTo(0, 0))
    },
    [period]
  )
  const backToPeriod = useCallback(
    (route: CardRoute) => {
      const y = returnTo
      const back = backRoute(route)
      if (back.page === "progress") {
        dispatch({ type: "restore", state: periodStateFromRoute(back, period.family) })
      }
      setOpened(null)
      setMode("period")
      // nach dem Einhängen der Seite an die gemerkte Stelle
      requestAnimationFrame(() => scrollTo(0, y ?? 0))
    },
    [returnTo, period.family]
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
          onBack={backToPeriod}
        />
      ) : (
        <PeriodView
          header={header}
          state={period}
          dispatch={dispatch}
          explain={explain}
          onHelp={setHelpId}
          onOpen={openCard}
        />
      )}
      <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
    </>
  )
}
