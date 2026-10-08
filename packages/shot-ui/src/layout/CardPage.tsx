import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import type { PageSection } from "./sections"

type Section = { id: Exclude<PageSection, "scheibe">; node: ReactNode }

export interface CardPageProps {
  /** Kopf mit Ergebnis (CardHeader) */
  header: ReactNode
  /** Sprungleiste (SectionNav) */
  nav: ReactNode
  /** Scheibe mit Schaltern und Ablesezeile: Abschnitt „Scheibe“ */
  target: ReactNode
  /** was neben der Scheibe steht und zu ihr gehört (Ablesung, Serien), auf dem Telefon unter ihr */
  aside: ReactNode
  /** Abschnitte neben der Scheibe, unter `aside` (die Schüsse) */
  beside: readonly Section[]
  /** Abschnitte darunter in voller Breite (Zahlen, Analyse) */
  below: readonly Section[]
  className?: string
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <div id={section.id} data-section={section.id} className="min-w-0 scroll-mt-14">
      {section.node}
    </div>
  )
}

/**
 * Rahmen der Seite einer Scheibe (Plan Schritt 4, D2 und D5): auf dem Telefon eine Spalte in der Reihenfolge
 * Kopf, Leiste, Scheibe, Seite, Abschnitte. Ab 768 px steht die Scheibe links fest unter der Leiste, rechts
 * daneben, was man beim Blick auf die Scheibe braucht (Schuss, Serien, Schüsse); was Platz braucht (Zahlen,
 * Analyse), folgt darunter in voller Breite, und die Scheibe scrollt mit (User, 8. Oktober 2026). Die Scheibe
 * trägt selbst `data-section`, ein umschließender Abschnitt würde das Raster zerbrechen; der Anker `#scheibe`
 * sitzt auf dem Raster, denn ein klebendes Ziel gilt dem Browser immer als angesprungen. Der Inhalt von
 * `target` muss ab 768 px samt Leiste ins Fenster passen (höchstens `100svh − 3,5rem`), sonst ragt er beim
 * Kleben unten hinaus.
 */
export function CardPage({ header, nav, target, aside, beside, below, className }: CardPageProps) {
  return (
    <div className={cn("grid gap-5", className)}>
      {header}
      {nav}
      <div className="grid gap-7">
        {/* die Scheibe klebt nur innerhalb dieses Rasters: unter ihm beginnt die volle Breite */}
        <div
          id="scheibe"
          className="grid scroll-mt-14 gap-7 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          {/* scroll-mt-14 auch hier: der Sprung aus der Analyse zielt auf die Scheibe selbst */}
          <div
            data-section="scheibe"
            className="min-w-0 scroll-mt-14 md:sticky md:top-14 md:self-start"
          >
            {target}
          </div>
          <div className="grid min-w-0 content-start gap-7">
            {aside}
            {beside.map((section) => (
              <SectionBlock key={section.id} section={section} />
            ))}
          </div>
        </div>
        {below.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}
