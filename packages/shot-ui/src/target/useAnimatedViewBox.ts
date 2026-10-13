"use client"

import { useEffect, useRef, useState } from "react"

import type { ViewBox } from "../types"

const DURATION_MS = 340

const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Weicher Übergang zum gewünschten Ausschnitt (340 ms, ease-out); bei „Bewegung reduzieren“ ein Sprung.
 * Zeichnet der Browser gerade keine Bilder (Hintergrund, Vorschau), steht der Ausschnitt trotzdem am Ziel.
 * Ändert sich `instantKey` (eine andere Karte), steht der neue Ausschnitt sofort, ohne Gleiten.
 */
export function useAnimatedViewBox(wanted: ViewBox, instantKey = ""): ViewBox {
  const [current, setCurrent] = useState(wanted)
  const [shownKey, setShownKey] = useState(instantKey)
  const shown = useRef(wanted)
  const lastKey = useRef(instantKey)
  if (shownKey !== instantKey) {
    // im selben Rendern umstellen, damit kein Bild mit dem alten Ausschnitt erscheint
    setShownKey(instantKey)
    setCurrent(wanted)
  }
  useEffect(() => {
    const jump = lastKey.current !== instantKey
    lastKey.current = instantKey
    const from = shown.current
    const land = () => {
      shown.current = wanted
      setCurrent(wanted)
    }
    if (jump || reducedMotion()) {
      land()
      return
    }
    if (from.x === wanted.x && from.y === wanted.y && from.w === wanted.w) return
    const t0 = performance.now()
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k
    let frame = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION_MS)
      const e = 1 - Math.pow(1 - k, 3)
      shown.current = {
        x: lerp(from.x, wanted.x, e),
        y: lerp(from.y, wanted.y, e),
        w: lerp(from.w, wanted.w, e),
      }
      setCurrent(shown.current)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    const done = setTimeout(() => {
      cancelAnimationFrame(frame)
      land()
    }, DURATION_MS + 150)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(done)
    }
    // nur die Zahlen zählen: ein neues Objekt mit demselben Ausschnitt startet keine Bewegung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.x, wanted.y, wanted.w, instantKey])
  return current
}

/**
 * Breite eines Elements in Bildschirm-Pixeln, aktuell gehalten; 0 bis zur ersten Messung. Den Rückgabe-Ref
 * als `ref` setzen: Er misst auch ein Element, das erst später erscheint (eine Leiste ohne Schüsse).
 */
export function useElementWidth(): [number, (node: Element | null) => void] {
  const [node, setNode] = useState<Element | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    // der Beobachter meldet die Breite gleich beim Anmelden, vor dem nächsten Bild
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [width, setNode]
}
