"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import type { Observation } from "../analysis/observations"
import { ObservationSymbol } from "../analysis/ObservationSymbol"
import { PAGE_COLUMNS } from "../layout/columns"

export interface CardHeaderProps {
  /** Scheibe oder Disziplin */
  title: string
  /** Datum, Stand, Beispiel …; mit „·“ verbunden */
  meta: readonly string[]
  /** das Ergebnis (`CardResult`), nur auf dem Telefon hier (ab 768 px als Box über der Ablesung); ohne Schüsse null */
  result: ReactNode
  /** die wichtigsten Beobachtungen (`keyObservations`, höchstens drei, die Lage zuerst); leer: keine */
  observations: readonly Observation[]
  /** „Alle Beobachtungen ›“: öffnet den Überblick der Analyse; ohne keinen Knopf */
  onMore?: () => void
  className?: string
}

/**
 * Kopf der Seite einer Scheibe: Titel und Metazeile, auf dem Telefon das Ergebnis, darunter die
 * wichtigsten Beobachtungen in Worten (die Antwort steht oben, nicht nach den Zahlen); auf dem Telefon nur die
 * erste, damit Kopf und Scheibe auf den ersten Bildschirm passen (Leitlinie: ein Satz und eine Zahl). Ab 768 px im Raster der
 * Seite über der Scheibe, das Ergebnis steht dann rechts als Box.
 */
export function CardHeader({
  title,
  meta,
  result,
  observations,
  onMore,
  className,
}: CardHeaderProps) {
  return (
    // kein <header>: außerhalb von <main> wäre es eine zweite Banner-Landmarke neben dem Kopf der App
    <div data-card-header className={cn("grid gap-3", PAGE_COLUMNS, className)}>
      <div className="grid min-w-0 content-start gap-1 md:col-start-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
          {title}
        </h1>
        {/* ein langer Name einer Liste aus Meyton ohne Leerzeichen bricht um statt über den Rand */}
        {meta.length > 0 && (
          <p className="text-[13px] [overflow-wrap:anywhere] text-muted-foreground">
            {meta.join(" · ")}
          </p>
        )}
      </div>
      {result && <div className="md:hidden">{result}</div>}
      {observations.length > 0 && (
        <div
          data-key-observations
          className="grid max-w-[46rem] justify-items-start gap-2 md:col-start-1"
        >
          <ul aria-label="Wichtigste Beobachtungen" className="grid gap-1.5">
            {observations.map((o, i) => (
              <li
                key={o.icon}
                data-observation={o.icon}
                className={cn(
                  "flex gap-2.5 text-[14px] leading-relaxed text-foreground-2",
                  // auf dem Telefon nur die erste: sonst rutscht die Scheibe unter die untere Leiste
                  i > 0 && "max-md:hidden"
                )}
              >
                <ObservationSymbol icon={o.icon} />
                <span className="min-w-0">{o.text}</span>
              </li>
            ))}
          </ul>
          {onMore && (
            <button
              type="button"
              data-more-observations
              onClick={onMore}
              className="cursor-pointer text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Alle Beobachtungen <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
