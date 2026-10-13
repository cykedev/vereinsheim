import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

export interface ListHeaderProps {
  /** Name der gezeigten Familie */
  familyLabel: string
  /** gezeigte Scheiben */
  cards: number
  /** die Filter (`ListControls`) */
  controls?: ReactNode
  /** Kreise rechts neben dem Titel (Plan `plans/2026-10-13-spiegel-symbole.md`): in der App die Wertung der Familie */
  actions?: ReactNode
  className?: string
}

/**
 * Kopf der Scheiben-Liste (Plan N2, Review): Titel wie im Kopf eines Zeitraums, darunter Familie und Zahl der
 * gezeigten Scheiben, dann die Filter. Die Abende darunter sind Überschriften zweiter Ebene.
 */
export function ListHeader({ familyLabel, cards, controls, actions, className }: ListHeaderProps) {
  return (
    <div data-list-header className={cn("grid gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
            Scheiben
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {`${familyLabel} · ${cards} ${cards === 1 ? "Scheibe" : "Scheiben"}`}
          </p>
        </div>
        {actions && (
          <div data-list-actions className="flex shrink-0 items-center gap-1.5">
            {actions}
          </div>
        )}
      </div>
      {controls}
    </div>
  )
}
