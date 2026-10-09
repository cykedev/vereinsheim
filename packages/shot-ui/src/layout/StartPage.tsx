import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { PAGE_COLUMNS } from "./columns"

/**
 * Rahmen von Start (Plan N5, Review: „die Breite passt nicht zu den restlichen Screens“): dasselbe Raster wie die Seite
 * eines Zeitraums (`PAGE_COLUMNS`). Ab 768 px links der letzte Abend (je Familie ein Block), rechts „Offen“ und darunter
 * die Form; auf dem Telefon untereinander in dieser Folge: Offen, Abend, Form. Die zweite Zeile nimmt den Rest der
 * Höhe, damit die Form direkt unter „Offen“ steht.
 */
export function StartPage({
  open,
  evenings,
  form,
  className,
}: {
  open?: ReactNode
  evenings: ReactNode
  form?: ReactNode
  className?: string
}) {
  return (
    <div
      data-start-layout
      className={cn("grid gap-4 md:grid-rows-[auto_1fr] md:items-start", PAGE_COLUMNS, className)}
    >
      {open && <div className="min-w-0 md:col-start-2 md:row-start-1">{open}</div>}
      <div className="grid min-w-0 gap-4 md:col-start-1 md:row-span-2 md:row-start-1">
        {evenings}
      </div>
      {form && <div className="min-w-0 md:col-start-2 md:row-start-2">{form}</div>}
    </div>
  )
}
