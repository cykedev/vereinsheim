import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import type { PageSection } from "./sections"

export interface CardPageProps {
  /** Kopf mit Ergebnis (CardHeader) */
  header: ReactNode
  /** Sprungleiste (SectionNav) */
  nav: ReactNode
  /** Scheibe mit Schaltern und Ablesezeile: Abschnitt „Scheibe“ */
  target: ReactNode
  /** was neben der Scheibe steht (Ablesung, Übersicht, Serien), auf dem Telefon unter ihr */
  aside: ReactNode
  /** die übrigen Abschnitte in Seitenreihenfolge */
  sections: readonly { id: Exclude<PageSection, "scheibe">; node: ReactNode }[]
  className?: string
}

/**
 * Rahmen der Seite einer Scheibe (Plan Schritt 4, D2 und D5): auf dem Telefon eine Spalte in der Reihenfolge
 * Kopf, Leiste, Scheibe, Seite, Abschnitte; ab 768 px steht die Scheibe links fest unter der Leiste, rechts
 * scrollt der Rest. Die Scheibe trägt selbst `data-section`, ein umschließender Abschnitt würde das Raster
 * zerbrechen.
 */
export function CardPage({ header, nav, target, aside, sections, className }: CardPageProps) {
  return (
    <div className={cn("grid gap-5", className)}>
      {header}
      {nav}
      <div className="grid gap-7 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div
          id="scheibe"
          data-section="scheibe"
          className="min-w-0 scroll-mt-14 md:sticky md:top-14 md:self-start"
        >
          {target}
        </div>
        <div className="grid min-w-0 content-start gap-7">
          {aside}
          {sections.map((section) => (
            <div
              key={section.id}
              id={section.id}
              data-section={section.id}
              className="min-w-0 scroll-mt-14"
            >
              {section.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
