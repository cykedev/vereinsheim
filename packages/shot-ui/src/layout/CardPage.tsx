"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { JUMP_BAR } from "./bar"
import { PAGE_COLUMNS } from "./columns"
import { SectionBlock, type PageSectionBlock } from "./SectionBlock"
import type { PageSection } from "./sections"
import { useTargetFit } from "./useTargetFit"

type Section = PageSectionBlock<Exclude<PageSection, "target">>

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
  /** Abschnitte darunter in voller Breite (die Analyse) */
  below: readonly Section[]
  /**
   * ohne Schüsse: statt Ergebnis, Serien, Ablesung, Abschnitten und Sprungleiste nur dieser Hinweis neben der
   * Scheibe (`NoShots`), keine leeren Gerüste
   */
  empty?: ReactNode
  className?: string
}

/**
 * Rahmen der Seite einer Scheibe: auf dem Telefon eine Spalte in der Reihenfolge
 * Kopf, Leiste, Scheibe, Serien, Seite, Abschnitte. Ab 768 px links die Scheibe mit den Serien darunter, so
 * groß, dass beide unter der Leiste ins Fenster passen (`useTargetFit`, mindestens 280 px, sonst bleibt die
 * Scheibe allein im Fenster); rechts daneben das Ergebnis als Box, die Ablesung und die Schüsse, die bis zur
 * Unterkante der Serien reichen und in sich scrollen. Was Platz braucht (die Analyse), folgt darunter in voller Breite.
 * Die Spalte der Scheibe trägt selbst `data-section`, ein umschließender Abschnitt
 * würde das Raster zerbrechen; der Anker `#target` sitzt auf dem Raster, denn ein klebendes Ziel gilt dem
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
  const { ref: fitTarget, style: fitStyle } = useTargetFit()
  if (empty) {
    return (
      <div className={cn("grid gap-5", className)}>
        {header}
        <div id="target" className={cn("grid", JUMP_BAR.scrollMargin, "gap-7", PAGE_COLUMNS)}>
          <div
            ref={fitTarget}
            style={fitStyle}
            data-section="target"
            className={cn("grid min-w-0", JUMP_BAR.scrollMargin, "content-start gap-7")}
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
        <div id="target" className={cn("grid", JUMP_BAR.scrollMargin, "gap-7", PAGE_COLUMNS)}>
          {/* Abstand zur Leiste auch hier: der Sprung aus der Analyse zielt auf die Scheibe selbst; klebt, falls
              die rechte Spalte einmal länger ist */}
          <div
            ref={fitTarget}
            style={fitStyle}
            data-section="target"
            className={cn(
              "grid min-w-0",
              JUMP_BAR.scrollMargin,
              "content-start gap-7 md:sticky",
              JUMP_BAR.mdTop,
              "md:self-start"
            )}
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
        {below.map((section, i) => (
          <SectionBlock key={section.id} section={section} last={i === below.length - 1} />
        ))}
      </div>
    </div>
  )
}
