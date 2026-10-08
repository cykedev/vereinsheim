"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { PAGE_COLUMNS } from "./columns"
import type { PageSection } from "./sections"
import { useTargetFit } from "./useTargetFit"

type Section = { id: Exclude<PageSection, "scheibe">; node: ReactNode }

export interface CardPageProps {
  /** Kopf mit Ergebnis (CardHeader) */
  header: ReactNode
  /** Sprungleiste (SectionNav) */
  nav: ReactNode
  /** Scheibe mit Schaltern und Ablesezeile: Abschnitt „Scheibe“; der Kasten der Scheibe trägt `data-target-box` */
  target: ReactNode
  /** das Ergebnis (`CardResult`): ab 768 px als Box oben rechts, auf dem Telefon steht es im Kopf */
  result: ReactNode
  /** was in der Spalte der Scheibe unter ihr steht (Serien) */
  under: ReactNode
  /** was rechts unter dem Ergebnis steht (Ablesung), auf dem Telefon nach `under` */
  aside: ReactNode
  /** Abschnitte rechts unter `aside` (die Schüsse); der letzte füllt die Höhe und scrollt in sich */
  beside: readonly Section[]
  /** Abschnitte darunter in voller Breite (Zahlen, Analyse) */
  below: readonly Section[]
  /**
   * ohne Schüsse: statt Ergebnis, Serien, Ablesung, Abschnitten und Sprungleiste nur dieser Hinweis neben der
   * Scheibe (`NoShots`), keine leeren Gerüste (User, 8. Oktober 2026)
   */
  empty?: ReactNode
  className?: string
}

function SectionBlock({ section, fill }: { section: Section; fill?: boolean }) {
  return (
    <div
      id={section.id}
      data-section={section.id}
      // füllt ab 768 px die übrige Höhe der Spalte, ohne selbst Höhe zu verlangen (Größe enthalten)
      className={cn(
        "min-w-0 scroll-mt-14",
        fill && "md:min-h-60 md:flex-1 md:basis-0 md:[contain:size]"
      )}
    >
      {section.node}
    </div>
  )
}

/**
 * Rahmen der Seite einer Scheibe (Plan Schritt 4, D2 und D5): auf dem Telefon eine Spalte in der Reihenfolge
 * Kopf, Leiste, Scheibe, Serien, Seite, Abschnitte. Ab 768 px links die Scheibe mit den Serien darunter, so
 * groß, dass beide unter der Leiste ins Fenster passen (`useTargetFit`, mindestens 280 px, sonst bleibt die
 * Scheibe allein im Fenster); rechts daneben das Ergebnis als Box, die Ablesung und die Schüsse, die bis zur
 * Unterkante der Serien reichen und in sich scrollen. Was Platz braucht (Zahlen, Analyse), folgt darunter in voller Breite
 * (User, 8. Oktober 2026). Die Spalte der Scheibe trägt selbst `data-section`, ein umschließender Abschnitt
 * würde das Raster zerbrechen; der Anker `#scheibe` sitzt auf dem Raster, denn ein klebendes Ziel gilt dem
 * Browser immer als angesprungen.
 */
export function CardPage({
  header,
  nav,
  target,
  result,
  under,
  aside,
  beside,
  below,
  empty,
  className,
}: CardPageProps) {
  const fit = useTargetFit()
  if (empty) {
    return (
      <div className={cn("grid gap-5", className)}>
        {header}
        <div id="scheibe" className={cn("grid scroll-mt-14 gap-7", PAGE_COLUMNS)}>
          <div
            ref={fit.ref}
            style={fit.style}
            data-section="scheibe"
            className="grid min-w-0 scroll-mt-14 content-start gap-7"
          >
            {target}
          </div>
          <div className="min-w-0">{empty}</div>
        </div>
      </div>
    )
  }
  return (
    <div className={cn("grid gap-5", className)}>
      {header}
      {nav}
      <div className="grid gap-7">
        <div id="scheibe" className={cn("grid scroll-mt-14 gap-7", PAGE_COLUMNS)}>
          {/* scroll-mt-14 auch hier: der Sprung aus der Analyse zielt auf die Scheibe selbst; klebt, falls
              die rechte Spalte einmal länger ist */}
          <div
            ref={fit.ref}
            style={fit.style}
            data-section="scheibe"
            className="grid min-w-0 scroll-mt-14 content-start gap-7 md:sticky md:top-14 md:self-start"
          >
            {target}
            {under}
          </div>
          <div className="grid min-w-0 content-start gap-7 md:flex md:flex-col">
            <div
              data-result-box
              className="rounded-2xl border border-border bg-card p-4 max-md:hidden"
            >
              {result}
            </div>
            {aside}
            {beside.map((section, i) => (
              <SectionBlock key={section.id} section={section} fill={i === beside.length - 1} />
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
