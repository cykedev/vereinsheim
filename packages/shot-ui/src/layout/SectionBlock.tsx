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
 * (Größe enthalten).
 */
export function SectionBlock({ section, fill }: { section: PageSectionBlock; fill?: boolean }) {
  return (
    <div
      id={section.id}
      data-section={section.id}
      className={cn(
        "min-w-0 scroll-mt-14",
        fill && "md:min-h-60 md:flex-1 md:basis-0 md:[contain:size]"
      )}
    >
      {section.node}
    </div>
  )
}
