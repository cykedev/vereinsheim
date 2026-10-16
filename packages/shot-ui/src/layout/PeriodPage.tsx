import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { JUMP_BAR } from "./bar"
import { PAGE_COLUMNS } from "./columns"
import type { PeriodSection } from "./sections"
import { SectionBlock, type PageSectionBlock } from "./SectionBlock"

type Section = PageSectionBlock<Exclude<PeriodSection, "history">>

export interface PeriodPageProps {
  /** Kopf mit Zeitraum, Filtern, auf dem Telefon dem Ergebnis und einem Satz (`PeriodHeader`) */
  header: ReactNode
  /** Sprungleiste (`SectionNav` mit `PERIOD_SECTIONS`) */
  nav: ReactNode
  /** der Verlauf mit Umschalter und Ablesezeile: Abschnitt „Verlauf“, ab 768 px fest im Bild */
  chart: ReactNode
  /** unter dem Verlauf in seiner Spalte (Umfang je Woche) */
  under: ReactNode
  /** das Ergebnis (`PeriodResult`): ab 768 px als Box oben rechts, auf dem Telefon im Kopf */
  result: ReactNode
  /** rechts unter dem Ergebnis (Ablesung einer Scheibe), auf dem Telefon nach `under` */
  aside: ReactNode
  /** Abschnitte rechts unter `aside` (Liste der Scheiben); der letzte füllt die Höhe und scrollt in sich */
  beside: readonly Section[]
  /** Abschnitte darunter in voller Breite (Zahlen, Analyse) */
  below: readonly Section[]
  /** ohne Scheiben im Zeitraum: nur Kopf und dieser Hinweis, keine leeren Gerüste */
  empty?: ReactNode
  className?: string
}

/**
 * Rahmen der Seite eines Zeitraums, im Gerüst der Seite einer Scheibe (`CardPage`): auf dem
 * Telefon eine Spalte (Kopf, Leiste, Verlauf, Umfang, Ablesung, Scheiben, Zahlen, Analyse); ab 768 px links der
 * Verlauf mit dem Umfang, fest im Bild, rechts das Ergebnis als Box, die Ablesung und die Liste der Scheiben, die
 * bis zur Unterkante reicht und in sich scrollt; darunter in voller Breite Zahlen und Analyse. Der Verlauf misst
 * sich selbst (keine Anpassung an die Fensterhöhe wie bei der Scheibe).
 */
export function PeriodPage({
  header,
  nav,
  chart,
  under,
  result,
  aside,
  beside,
  below,
  empty,
  className,
}: PeriodPageProps) {
  if (empty) {
    return (
      <div className={cn("grid gap-5", className)}>
        {header}
        <div data-period-empty className="min-w-0">
          {empty}
        </div>
      </div>
    )
  }
  return (
    <div className={cn("grid gap-5", className)}>
      {header}
      {nav}
      <div className="grid gap-7">
        <div id="history" className={cn("grid", JUMP_BAR.scrollMargin, "gap-7", PAGE_COLUMNS)}>
          <div
            data-section="history"
            className={cn(
              "grid min-w-0",
              JUMP_BAR.scrollMargin,
              "content-start gap-7 md:sticky",
              JUMP_BAR.mdTop,
              "md:self-start"
            )}
          >
            {chart}
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
