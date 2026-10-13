"use client"

import { cn } from "@vereinsheim/lib/utils"
import { useRef, useState, type KeyboardEvent, type PointerEvent, type SVGProps } from "react"

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
 * senkrecht scrollt die Seite weiter (`touch-action: pan-y`); übernimmt der Browser das Scrollen
 * (`pointercancel`), gilt wieder die Wahl davor. Ein zweites Tippen auf denselben Wert hebt die Wahl auf. Mit der
 * Tastatur Pfeil links/rechts, Pos1/Ende, Escape; das Diagramm meldet sich dafür als Schieberegler (APG-Muster),
 * `aria-valuetext` setzt das Diagramm. `xs` sind die x-Positionen der Werte in Pixeln des SVG, `width` dessen
 * Breite; `preset` setzt die Wahl, sobald es sich ändert (die Scheibe gibt den Schuss vor, D4). Ein Index
 * außerhalb von `xs` gilt als keine Wahl; die Seite hängt die Analyse ohnehin je Karte neu ein. `onPick` meldet jede
 * Wahl durch Tippen, Ziehen oder Tastatur (auch das Aufheben), nicht die Vorgabe über `preset`: So kann eine Seite
 * die Wahl teilen (Verlauf eines Zeitraums, Plan L3), ohne dass ihre eigene Vorgabe zurückkommt.
 */
export function useRuler(
  xs: readonly number[],
  width: number,
  preset: number | null = null,
  onPick?: (index: number | null) => void
) {
  const [chosen, setChosen] = useState<number | null>(preset)
  const [lastPreset, setLastPreset] = useState(preset)
  if (preset !== lastPreset) {
    // eine neue Vorgabe gilt im selben Rendern, ohne Effekt und zweites Bild
    setLastPreset(preset)
    setChosen(preset)
  }
  const pick = (i: number | null) => {
    setChosen(i)
    onPick?.(i)
  }
  const index = chosen !== null && chosen < xs.length ? chosen : null
  // eine Berührung: Wahl beim Aufsetzen (`start`), davor (`before`); gemeldet (`committed`) wird sie erst beim
  // Loslassen oder bei der ersten Bewegung, damit ein Wischen, das der Browser als Scrollen übernimmt, die Wahl der
  // Seite nicht ändert (Review, 9. Oktober 2026)
  const drag = useRef<{
    again: boolean
    moved: boolean
    committed: boolean
    start: number | null
    before: number | null
  } | null>(null)
  const at = (event: PointerEvent<SVGSVGElement>) =>
    nearestIndex(xs, toSvgX(event.clientX, event.currentTarget.getBoundingClientRect(), width))

  const svgProps: SVGProps<SVGSVGElement> = {
    tabIndex: 0,
    role: "slider",
    "aria-valuemin": 0,
    "aria-valuemax": xs.length,
    "aria-valuenow": index === null ? 0 : index + 1,
    // Safari kennt `user-select` nur mit Präfix: ohne markiert Ziehen Text (User, 9. Oktober 2026)
    style: {
      touchAction: "pan-y",
      cursor: "crosshair",
      userSelect: "none",
      WebkitUserSelect: "none",
    },
    onPointerDown: (event) => {
      // nur die Haupttaste (Finger, Stift, linke Maustaste) wählt
      if (event.button !== 0) return
      // mit der Maus beginnt sonst eine Textauswahl, die beim Ziehen über die Seite wandert; der Fokus (Pfeiltasten)
      // kommt dann nicht mehr vom Browser, also selbst setzen
      if (event.pointerType === "mouse") {
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
      }
      const i = at(event)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ein ausgelöstes Ereignis ohne echten Zeiger: ohne Fangen geht es auch
      }
      drag.current = {
        again: i !== null && i === index,
        moved: false,
        committed: false,
        start: i,
        before: index,
      }
      if (i !== index) setChosen(i)
    },
    onPointerMove: (event) => {
      if (!drag.current) return
      const i = at(event)
      if (i === index) return
      drag.current.moved = true
      drag.current.committed = true
      pick(i)
    },
    onPointerUp: () => {
      const gesture = drag.current
      drag.current = null
      if (!gesture) return
      if (gesture.again && !gesture.moved) pick(null)
      else if (!gesture.committed && gesture.start !== gesture.before) onPick?.(gesture.start)
    },
    // der Browser scrollt: die Berührung war kein Ablesen
    onPointerCancel: () => {
      const gesture = drag.current
      drag.current = null
      if (!gesture || gesture.before === index) return
      // nur zurückmelden, was schon gemeldet war; sonst ändert sich nur die eigene Anzeige zurück
      if (gesture.committed) pick(gesture.before)
      else setChosen(gesture.before)
    },
    onLostPointerCapture: () => {
      drag.current = null
    },
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
      // mit Alt, Strg oder Befehl bleibt die Taste dem Browser (etwa „Zurück“)
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const delta = KEY_STEPS[event.key]
      if (delta !== undefined) {
        event.preventDefault()
        pick(stepIndex(index, delta, xs.length))
      } else if (event.key === "Escape" && index !== null) {
        event.preventDefault()
        pick(null)
      }
    },
  }
  return { index, svgProps }
}

/**
 * Zeile über dem Diagramm (D3): feste Höhe von zwei Zeilen, damit das Diagramm beim Ziehen nicht springt;
 * ohne Wahl der Hinweis, mit Wahl die Werte. Die Aktion (etwa „Auf der Scheibe“) hat immer ihren Platz und ist
 * ohne Wahl unsichtbar. Gemeldet wird nur der Text, nicht der Knopf.
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
      data-readout
      className="grid h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 text-[13px]"
    >
      <span
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "line-clamp-2",
          text ? "font-medium text-foreground-2 tabular-nums" : "text-muted-foreground"
        )}
      >
        {text ?? RULER_HINT}
      </span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          aria-hidden={text ? undefined : true}
          tabIndex={text ? undefined : -1}
          className={cn(
            "cursor-pointer rounded font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring",
            !text && "invisible"
          )}
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
      <summary className="cursor-pointer font-semibold text-primary">
        Werte als Tabelle<span className="sr-only">{`: ${caption}`}</span>
      </summary>
      {/* der Bereich scrollt bei vielen Zeilen in sich und ist deshalb selbst per Tastatur erreichbar */}
      <div
        tabIndex={0}
        role="region"
        aria-label={caption}
        className="mt-2 max-h-64 overflow-auto rounded focus-visible:outline-2 focus-visible:outline-ring"
      >
        <table className="w-full border-collapse tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column, i) => (
                <th
                  key={i}
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
                {row.map((cell, i) =>
                  i ? (
                    <td key={i} className="px-2 py-1 text-right">
                      {cell}
                    </td>
                  ) : (
                    <th key={i} scope="row" className="px-2 py-1 text-left font-normal">
                      {cell}
                    </th>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
