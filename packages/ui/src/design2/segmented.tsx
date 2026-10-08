"use client"

import { useEffect, useRef, type KeyboardEvent } from "react"

import { cn } from "@vereinsheim/lib/utils"

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  /** Name der Gruppe für Screenreader, etwa „Ausschnitt“ */
  label: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Id des Bereichs, den die Wahl steuert (`aria-controls`), etwa die Karten eines Reiters */
  controls?: string
  className?: string
}

/** Ziel einer Pfeiltaste im Umschalter; `null` für Tasten, die nichts bewegen */
export function nextIndex(current: number, key: string, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % count
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + count) % count
  if (key === "Home") return 0
  if (key === "End") return count - 1
  return null
}

/**
 * Segment-Umschalter (Design 2): eine Wahl aus wenigen Möglichkeiten, etwa Scheibe/Gruppe oder ganze
 * Ringe/Zehntel. Pfeiltasten wechseln die Wahl; nur der gewählte Knopf ist mit Tab erreichbar. Weil die
 * Pfeiltasten wählen, ist es für Screenreader eine Radiogruppe (`radiogroup`/`radio`/`aria-checked`).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  controls,
  className,
}: SegmentedProps<T>) {
  const bar = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  // ohne passende Wahl bleibt der erste Knopf der Tab-Halt
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  // scrollt die Leiste seitlich (schmaler Bildschirm), rückt die Wahl ins Bild; nur waagrecht, die Seite
  // bleibt stehen
  useEffect(() => {
    const el = bar.current
    const button = buttons.current[current]
    if (!el || !button || el.scrollWidth <= el.clientWidth) return
    const b = button.getBoundingClientRect()
    const c = el.getBoundingClientRect()
    if (b.left < c.left) el.scrollLeft += b.left - c.left - 8
    else if (b.right > c.right) el.scrollLeft += b.right - c.right + 8
  }, [current])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextIndex(current, event.key, options.length)
    if (next === null) return
    event.preventDefault()
    onChange(options[next].value)
    buttons.current[next]?.focus()
  }
  return (
    <div
      ref={bar}
      role="radiogroup"
      aria-label={label}
      aria-controls={controls}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex rounded-full border border-border bg-surface-2 p-[3px]",
        className
      )}
    >
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={(node) => {
            buttons.current[i] = node
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={i === current ? 0 : -1}
          onClick={() => onChange(option.value)}
          className="cursor-pointer rounded-full px-3.5 py-2 text-[13px] leading-none font-semibold text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-checked:bg-primary aria-checked:text-primary-foreground"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
