"use client"

import { cn } from "@vereinsheim/lib/utils"
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type SVGProps,
} from "react"

import { crisp } from "./frame"
import { nearestIndex, stepIndex, toSvgX } from "./ruler"

/** Hinweis in der Zeile über dem Diagramm, solange nichts gewählt ist */
export const RULER_HINT = "Tippe oder ziehe im Diagramm, um Werte abzulesen."

const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  Home: Number.NEGATIVE_INFINITY,
  End: Number.POSITIVE_INFINITY,
}

/**
 * Lineal eines Diagramms (Plan L1, D2): Tippen wählt den nächsten Wert, waagrechtes Ziehen wandert mit,
 * senkrecht scrollt die Seite weiter (`touch-action: pan-y`); ein zweites Tippen auf denselben Wert hebt die
 * Wahl auf. Mit der Tastatur Pfeil links/rechts, Pos1/Ende, Escape. `xs` sind die x-Positionen der Werte in
 * Pixeln des SVG, `width` dessen Breite; `preset` setzt die Wahl, sobald es sich ändert (die Scheibe gibt
 * den Schuss vor, D4).
 */
export function useRuler(xs: readonly number[], width: number, preset: number | null = null) {
  const [index, setIndex] = useState<number | null>(preset)
  useEffect(() => setIndex(preset), [preset])
  const drag = useRef<{ again: boolean; moved: boolean } | null>(null)
  const at = (event: PointerEvent<SVGSVGElement>) =>
    nearestIndex(xs, toSvgX(event.clientX, event.currentTarget.getBoundingClientRect(), width))

  const svgProps: SVGProps<SVGSVGElement> = {
    tabIndex: 0,
    style: { touchAction: "pan-y", cursor: "crosshair" },
    onPointerDown: (event) => {
      const i = at(event)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ein ausgelöstes Ereignis ohne echten Zeiger: ohne Fangen geht es auch
      }
      drag.current = { again: i !== null && i === index, moved: false }
      setIndex(i)
    },
    onPointerMove: (event) => {
      if (!drag.current) return
      const i = at(event)
      if (i === index) return
      drag.current.moved = true
      setIndex(i)
    },
    onPointerUp: () => {
      const gesture = drag.current
      drag.current = null
      if (gesture?.again && !gesture.moved) setIndex(null)
    },
    onPointerCancel: () => {
      drag.current = null
    },
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
      const delta = KEY_STEPS[event.key]
      if (delta !== undefined) {
        event.preventDefault()
        setIndex(stepIndex(index, delta, xs.length))
      } else if (event.key === "Escape" && index !== null) {
        event.preventDefault()
        setIndex(null)
      }
    },
  }
  return { index, setIndex, svgProps }
}

/**
 * Zeile über dem Diagramm (D3): feste Höhe, damit nichts springt; ohne Wahl der Hinweis, mit Wahl die Werte
 * und, wenn es eine gibt, die Aktion rechts (etwa „Auf der Scheibe“). Ein Wechsel wird gemeldet.
 */
export function RulerReadout({
  text,
  action,
}: {
  text: string | null
  action?: { label: string; onClick: () => void } | null
}) {
  return (
    <div
      aria-live="polite"
      data-readout
      className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]"
    >
      {text ? (
        <span className="font-medium text-foreground-2 tabular-nums">{text}</span>
      ) : (
        <span className="text-muted-foreground">{RULER_HINT}</span>
      )}
      {text && action && (
        <button
          type="button"
          onClick={action.onClick}
          className="cursor-pointer rounded font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

/** senkrechte Linie an der gewählten Stelle, ohne Zeigerereignisse */
export function RulerMark({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  return (
    <line
      data-ruler
      x1={crisp(x)}
      x2={crisp(x)}
      y1={top}
      y2={bottom}
      stroke="var(--foreground-2)"
      strokeWidth={1}
      pointerEvents="none"
    />
  )
}

/** „Werte als Tabelle“ unter dem Diagramm (D5): zugeklappt, für alle und für Screenreader */
export function ValuesTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: readonly string[]
  rows: readonly (readonly string[])[]
}) {
  return (
    <details data-values className="text-[13px]">
      <summary className="cursor-pointer font-semibold text-primary">Werte als Tabelle</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full border-collapse tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column, i) => (
                <th
                  key={column}
                  scope="col"
                  className={cn(
                    "px-2 py-1 font-medium text-muted-foreground",
                    i ? "text-right" : "text-left"
                  )}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-border">
                {row.map((cell, i) => (
                  <td key={i} className={cn("px-2 py-1", i ? "text-right" : "text-left")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
