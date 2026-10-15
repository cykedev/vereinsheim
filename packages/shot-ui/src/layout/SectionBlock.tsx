import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

/** ein Abschnitt der Seite mit seinem Anker */
export interface PageSectionBlock<T extends string = string> {
  id: T
  node: ReactNode
}

/**
 * Abschnitt der Seite (`CardPage`, `PeriodPage`): Anker und `data-section` für die Sprungleiste, `scroll-mt-14`
 * für die 56 px hohe Leiste. `fill` füllt ab 768 px die übrige Höhe der Spalte, ohne selbst Höhe zu verlangen
 * (Größe enthalten). `last` (der letzte Abschnitt der Seite) ist mindestens so hoch wie das Fenster unter der
 * Leiste: Sonst erreicht ein kurzer Abschnitt davor die Leiste nie, und die Sprungleiste springt von ihm zum letzten
 * (etwa „Zahlen“ in einem hohen Fenster).
 */
export function SectionBlock({
  section,
  fill,
  last,
}: {
  section: PageSectionBlock
  fill?: boolean
  last?: boolean
}) {
  return (
    <div
      id={section.id}
      data-section={section.id}
      className={cn(
        "min-w-0 scroll-mt-14",
        fill && "md:min-h-60 md:flex-1 md:basis-0 md:[contain:size]",
        last && "min-h-[calc(100svh-3.5rem)]"
      )}
    >
      {section.node}
    </div>
  )
}
