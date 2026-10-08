"use client"

import { useRef, type KeyboardEvent } from "react"

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
 * Ringe/Zehntel. Pfeiltasten wechseln die Wahl; nur der gewählte Knopf ist mit Tab erreichbar.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.findIndex((option) => option.value === value)
    const next = nextIndex(Math.max(0, current), event.key, options.length)
    if (next === null) return
    event.preventDefault()
    onChange(options[next].value)
    buttons.current[next]?.focus()
  }
  return (
    <div
      role="group"
      aria-label={label}
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
          aria-pressed={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          className="cursor-pointer rounded-full px-3.5 py-2 text-[13px] leading-none font-semibold text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
