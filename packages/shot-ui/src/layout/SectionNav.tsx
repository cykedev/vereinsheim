import { cn } from "@vereinsheim/lib/utils"

import { PAGE_SECTIONS, type PageSection } from "./sections"

/**
 * Sprungleiste (Plan Schritt 4, D1): klebt unter dem Kopf am oberen Rand, vier Anker zu den Abschnitten,
 * der sichtbare hervorgehoben. Optik wie die Reiterleiste der Analyse, die sie dort abdeckt; ist sie zu
 * schmal, scrollt sie in sich.
 */
export function SectionNav({
  active,
  className,
}: {
  active: PageSection | null
  className?: string
}) {
  return (
    <nav
      aria-label="Abschnitte"
      className={cn("sticky top-0 z-20 -mx-4 flex h-14 items-center bg-background px-4", className)}
    >
      <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-surface-2 p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PAGE_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? "location" : undefined}
            className="shrink-0 rounded-full px-3.5 py-2 text-[13px] leading-none font-semibold whitespace-nowrap text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=location]:bg-primary aria-[current=location]:text-primary-foreground"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
