import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { JUMP_BAR } from "./bar"

/** ein Abschnitt der Seite mit seinem Anker */
export interface PageSectionBlock<T extends string = string> {
  id: T
  node: ReactNode
}

/**
 * Abschnitt der Seite (`CardPage`, `PeriodPage`): Anker und `data-section` für die Sprungleiste, `JUMP_BAR.scrollMargin`
 * für die Leiste (`BAR_PX`). `fill` füllt ab 768 px die übrige Höhe der Spalte, ohne selbst Höhe zu verlangen
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
        "min-w-0",
        JUMP_BAR.scrollMargin,
        fill && "md:min-h-60 md:flex-1 md:basis-0 md:[contain:size]",
        last && JUMP_BAR.screenBelow
      )}
    >
      {section.node}
    </div>
  )
}
