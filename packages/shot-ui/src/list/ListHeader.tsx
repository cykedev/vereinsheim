import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

export interface ListHeaderProps {
  /** Name der gezeigten Familie */
  familyLabel: string
  /** gezeigte Scheiben */
  cards: number
  /** die Filter (`ListControls`) */
  controls?: ReactNode
  className?: string
}

/**
 * Kopf der Scheiben-Liste: Titel wie im Kopf eines Zeitraums, darunter Familie und Zahl der
 * gezeigten Scheiben, dann die Filter. Die Abende darunter sind Überschriften zweiter Ebene.
 */
export function ListHeader({ familyLabel, cards, controls, className }: ListHeaderProps) {
  return (
    <div data-list-header className={cn("grid gap-3", className)}>
      <div className="grid min-w-0 gap-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
          Scheiben
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {`${familyLabel} · ${cards} ${cards === 1 ? "Scheibe" : "Scheiben"}`}
        </p>
      </div>
      {controls}
    </div>
  )
}
