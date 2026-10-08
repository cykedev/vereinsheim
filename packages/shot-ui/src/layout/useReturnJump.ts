"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { isOutOfView, shouldDismiss, type ReturnState } from "./jump"

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * Sprung zur Scheibe mit Rücksprung (Plan Schritt 4, D6). `jumpTo(element, label)` scrollt nur, wenn das
 * Element außer Sicht ist, merkt die Ausgangsstelle und zeigt die Pille; `back` scrollt zurück. Die Pille
 * verschwindet auch, wenn man selbst zurückscrollt. Mit „Bewegung reduzieren“ ohne Animation.
 */
export function useReturnJump(topInset = 56) {
  const [pill, setPill] = useState<{ label: string; origin: number } | null>(null)
  const state = useRef<ReturnState | null>(null)

  const jumpTo = useCallback(
    (element: Element | null, label: string) => {
      if (!element) return
      if (!isOutOfView(element.getBoundingClientRect(), window.innerHeight, topInset)) return
      const origin = window.scrollY
      state.current = { origin, away: false }
      element.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" })
      setPill({ label, origin })
    },
    [topInset]
  )

  const dismiss = useCallback(() => {
    state.current = null
    setPill(null)
  }, [])

  const back = useCallback(() => {
    if (pill) window.scrollTo({ top: pill.origin, behavior: reducedMotion() ? "auto" : "smooth" })
    dismiss()
  }, [pill, dismiss])

  useEffect(() => {
    if (!pill) return
    const onScroll = () => {
      if (!state.current) return
      const next = shouldDismiss(state.current, window.scrollY)
      state.current = { ...state.current, away: next.away }
      if (next.dismiss) dismiss()
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [pill, dismiss])

  return { pill, jumpTo, back, dismiss }
}
