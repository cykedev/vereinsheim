"use client"

import type { ReactNode } from "react"

import { cn } from "@vereinsheim/lib/utils"

type DataAttributes = { [key: `data-${string}`]: string | undefined }

interface RoundToggleProps extends DataAttributes {
  /** Name für Screenreader: Zustand und Wirkung („Art: Training, auf Wettkampf umstellen“) */
  label: string
  /** Tooltip: der Zustand */
  title: string
  /** `gold`: hervorgehoben (etwa Wettkampf) */
  tone?: "default" | "gold"
  onClick: () => void
  /** ein Zeichen, 17 px (Symbol) oder ein kurzer Text (Bruch) */
  children: ReactNode
  className?: string
}

/**
 * Weicher Kreis (Design 2, Plan `plans/2026-10-13-spiegel-symbole.md`): ein Zustand als Zeichen, ein Tippen schaltet um.
 * 32 px, gefüllt in der Flächenfarbe mit leichtem Rahmen wie ein Segment-Umschalter (auf der Seitenfläche verschwand
 * der Kreis ohne; User, 13. Oktober 2026: „vielleicht ist der leichte rahmen immer gut“), das Zeichen leise (`quiet`,
 * eine Randinformation); Gold nur für das Hervorgehobene. Für Einstellungen neben einer großen Zahl oder in einer
 * Zeile mit Filtern (Art, Wertung), wo ein Segment-Umschalter zu viel Platz nähme.
 */
export function RoundToggle({
  label,
  title,
  tone = "default",
  onClick,
  children,
  className,
  ...data
}: RoundToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      {...data}
      className={cn(
        "relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border transition-colors focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-[17px] [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
        tone === "gold"
          ? "bg-warning-wash text-gold"
          : "bg-surface-2 text-quiet hover:bg-accent-wash hover:text-muted-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}
