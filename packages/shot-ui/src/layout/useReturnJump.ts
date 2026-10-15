"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { isOutOfView, shouldDismiss, type ReturnState } from "./jump"

/**
 * Sprung zur Scheibe mit Rücksprung. `jumpTo(element, label, shown)` scrollt nur, wenn
 * `shown` (ohne Angabe das Element) außer Sicht ist, an den Anfang des Elements, merkt die Ausgangsstelle und zeigt
 * die Pille; `back` scrollt zurück. `shown` braucht es, wo das Ziel klebt: Ein klebendes Element ist fast immer im
 * Bild, auch wenn das, was man sehen soll, längst darüber liegt. Die Pille
 * verschwindet auch, wenn man selbst zurückscrollt. Gesprungen wird sofort, wie bei den Ankern der
 * Sprungleiste: Glattes Scrollen über Tausende Pixel läuft in einem verborgenen Fenster verspätet und in der
 * Skriptprüfung gar nicht; die Pille gibt die Orientierung. Der Fokus bleibt beim auslösenden Knopf: `back`
 * und `close` geben ihn dorthin zurück (sonst fiele er beim Ausblenden der Pille auf `<body>`); `hide`
 * blendet die Pille ohne Fokuswechsel aus, etwa beim Wechsel der Karte.
 */
export function useReturnJump(topInset = 56) {
  const [pill, setPill] = useState<{ label: string; origin: number } | null>(null)
  const state = useRef<ReturnState | null>(null)
  const trigger = useRef<HTMLElement | null>(null)

  const jumpTo = useCallback(
    (element: Element | null, label: string, shown: Element | null = element) => {
      if (!element) return
      if (!isOutOfView((shown ?? element).getBoundingClientRect(), window.innerHeight, topInset))
        return
      const origin = window.scrollY
      state.current = { origin, away: false }
      const focused = document.activeElement
      trigger.current = focused instanceof HTMLElement && focused !== document.body ? focused : null
      element.scrollIntoView({ block: "start" })
      setPill({ label, origin })
    },
    [topInset]
  )

  const hide = useCallback(() => {
    state.current = null
    setPill(null)
  }, [])

  const close = useCallback(() => {
    trigger.current?.focus({ preventScroll: true })
    hide()
  }, [hide])

  const back = useCallback(() => {
    if (pill) window.scrollTo({ top: pill.origin })
    trigger.current?.focus({ preventScroll: true })
    hide()
  }, [pill, hide])

  useEffect(() => {
    if (!pill) return
    const onScroll = () => {
      if (!state.current) return
      const next = shouldDismiss(state.current, window.scrollY)
      state.current = { ...state.current, away: next.away }
      if (next.dismiss) hide()
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [pill, hide])

  return { pill, jumpTo, back, close, hide }
}
