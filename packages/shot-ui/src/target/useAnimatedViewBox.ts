"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import type { ViewBox } from "../types"

const DURATION_MS = 340

const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Weicher Übergang zum gewünschten Ausschnitt (340 ms, ease-out); bei „Bewegung reduzieren“ ein Sprung.
 * Zeichnet der Browser gerade keine Bilder (Hintergrund, Vorschau), steht der Ausschnitt trotzdem am Ziel.
 */
export function useAnimatedViewBox(wanted: ViewBox): ViewBox {
  const [current, setCurrent] = useState(wanted)
  const shown = useRef(wanted)
  useEffect(() => {
    const from = shown.current
    if (from.x === wanted.x && from.y === wanted.y && from.w === wanted.w) return
    const land = () => {
      shown.current = wanted
      setCurrent(wanted)
    }
    if (reducedMotion()) {
      land()
      return
    }
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
  }, [wanted.x, wanted.y, wanted.w])
  return current
}

/** Breite eines Elements in Bildschirm-Pixeln, aktuell gehalten; 0 bis zur ersten Messung */
export function useElementWidth(ref: RefObject<Element | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return width
}
