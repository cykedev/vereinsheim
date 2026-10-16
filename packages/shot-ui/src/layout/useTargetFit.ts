"use client"

import { useLayoutEffect, useState, type CSSProperties } from "react"

import { BAR_PX, EDGE_PX } from "./bar"

/** kleiner soll die Scheibe nicht werden, damit die Serien noch darunter passen */
export const MIN_TARGET_PX = 280
/** ab hier stehen Scheibe und Serien neben dem Rest (wie `md:` in Tailwind) */
const WIDE = "(min-width: 768px)"

/**
 * Wie groß die Scheibe höchstens sein darf, damit sie mit allem in ihrer Spalte (Rahmen der Karte, Serien)
 * unter der Leiste ins Fenster passt. Gemessen wird die Spalte samt Scheibe; der Rest hängt nicht an der Größe
 * der Scheibe. Bleibt weniger als `MIN_TARGET_PX`, null: Dann bleibt die Scheibe so groß, wie sie allein passt,
 * und die Serien folgen darunter.
 */
export function targetRoom(
  viewportHeight: number,
  columnHeight: number,
  boxHeight: number,
  /** Platz der unteren Leiste des Rahmens (`--app-bar`) */
  barPx = 0
) {
  // die Spalte beginnt unter der Sprungleiste und lässt unten Luft bis zum Fensterrand
  const room = Math.floor(viewportHeight - BAR_PX - EDGE_PX - barPx - (columnHeight - boxHeight))
  return room >= MIN_TARGET_PX ? room : null
}

/**
 * Misst ab 768 px die Spalte mit der Scheibe und setzt `--target-max` auf ihr, die Scheibe (`[data-target-box]`)
 * begrenzt sich damit. Gemessen wird beim Einhängen, im nächsten Frame (die Serien messen ihre Breite erst nach
 * dem Einhängen), bei jeder Größenänderung der Spalte und des Fensters. Unter 1 px Unterschied bleibt der Wert,
 * sonst könnte Runden ihn hin und her schalten.
 */
export function useTargetFit(): {
  ref: (node: HTMLElement | null) => void
  style: CSSProperties | undefined
} {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [room, setRoom] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!node) return
    const measure = () => {
      const box = node.querySelector<HTMLElement>("[data-target-box]")
      const next =
        box && window.matchMedia(WIDE).matches
          ? targetRoom(
              window.innerHeight,
              node.getBoundingClientRect().height,
              box.getBoundingClientRect().height,
              // im Rahmen der App nimmt die untere Leiste unten Platz weg; ohne Rahmen 0
              parseFloat(getComputedStyle(node).getPropertyValue("--app-bar")) || 0
            )
          : null
      setRoom((prev) => (prev !== null && next !== null && Math.abs(prev - next) < 1 ? prev : next))
    }
    measure()
    const frame = requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(node)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", measure)
      observer?.disconnect()
    }
  }, [node])
  return {
    ref: setNode,
    style: room === null ? undefined : ({ "--target-max": `${room}px` } as CSSProperties),
  }
}
