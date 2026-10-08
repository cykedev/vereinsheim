import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { PAGE_COLUMNS } from "../layout/columns"

export interface CardHeaderProps {
  /** Scheibe oder Disziplin */
  title: string
  /** Datum, Stand, Beispiel …; mit „·“ verbunden */
  meta: readonly string[]
  /** das Ergebnis (`CardResult`), nur auf dem Telefon hier (ab 768 px als Box über der Ablesung); ohne Schüsse null */
  result: ReactNode
  /** ein Satz zur Scheibe, die erste Beobachtung; null: keiner */
  sentence: string | null
  className?: string
}

/**
 * Kopf der Seite einer Scheibe (Plan Schritt 4, D2): Titel und Metazeile, auf dem Telefon das Ergebnis, darunter
 * ein Satz. Ab 768 px im Raster der Seite über der Scheibe, das Ergebnis steht dann rechts als Box (User,
 * 8. Oktober 2026).
 */
export function CardHeader({ title, meta, result, sentence, className }: CardHeaderProps) {
  return (
    // kein <header>: außerhalb von <main> wäre es eine zweite Banner-Landmarke neben dem Kopf der App
    <div data-card-header className={cn("grid gap-3", PAGE_COLUMNS, className)}>
      <div className="grid min-w-0 content-start gap-1 md:col-start-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
          {title}
        </h1>
        {meta.length > 0 && <p className="text-[13px] text-muted-foreground">{meta.join(" · ")}</p>}
      </div>
      {result && <div className="md:hidden">{result}</div>}
      {sentence && (
        <p
          data-sentence
          className="max-w-[46rem] text-[14px] leading-relaxed text-foreground-2 md:col-start-1"
        >
          {sentence}
        </p>
      )}
    </div>
  )
}
