"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { MouseEvent } from "react"

import { PAGE_SECTIONS } from "./sections"

/**
 * Sprung zum Abschnitt ohne den Sprung des Browsers: In einer `data:`-Seite (Vorschau) oder einem Rahmen mit
 * Sandbox blockt der Browser die Navigation zum Anker, dann sprang die Leiste nirgends hin (User, 9. Oktober
 * 2026). Die Leiste scrollt selbst, sofort wie zuvor, und schreibt den Anker, wo der Browser es erlaubt. Ein
 * Klick mit Taste (neuer Tab) bleibt dem Browser.
 */
export function jumpToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ block: "start" })
  try {
    history.pushState(null, "", `#${id}`)
  } catch {
    // ohne Verlauf (data:-Seite, Sandbox) gilt der Sprung ohne Anker in der Adresse
  }
}

/** Spalten auf dem Telefon je Zahl der Abschnitte; Klassen wörtlich für Tailwind */
const PHONE_COLUMNS: Readonly<Record<number, string>> = {
  3: "max-sm:grid-cols-3",
  4: "max-sm:grid-cols-4",
}

/**
 * Sprungleiste (Plan Schritt 4, D1): klebt unter dem Kopf am oberen Rand, Anker zu den Abschnitten (drei auf der
 * Scheibe, vier im Zeitraum), der sichtbare hervorgehoben. Optik wie die Reiterleiste der Analyse, die sie auf dem
 * Telefon abdeckt. Dort teilen sich die Einträge die Breite, nichts wird angeschnitten (User, 8. Oktober 2026).
 */
export function SectionNav({
  active,
  sections = PAGE_SECTIONS,
  className,
}: {
  active: string | null
  /** Abschnitte in Seitenreihenfolge; ohne Angabe die der Seite einer Scheibe */
  sections?: readonly { id: string; label: string }[]
  className?: string
}) {
  return (
    <nav
      aria-label="Abschnitte"
      // mit Fokus über dem Streifen der Analyse, der sie auf dem Telefon sonst abdeckt
      className={cn(
        "sticky top-0 z-20 -mx-4 flex h-14 items-center bg-background px-4 focus-within:z-40",
        className
      )}
    >
      <div
        className={cn(
          "inline-flex rounded-full border border-border bg-surface-2 p-[3px] max-sm:grid max-sm:w-full",
          PHONE_COLUMNS[sections.length] ?? PHONE_COLUMNS[4]
        )}
      >
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => jumpToSection(event, section.id)}
            aria-current={active === section.id ? "location" : undefined}
            className="rounded-full px-3.5 py-2 text-center text-[13px] leading-none font-semibold whitespace-nowrap text-foreground-2 max-sm:px-1 focus-visible:outline-2 focus-visible:outline-ring aria-[current=location]:bg-primary aria-[current=location]:text-primary-foreground"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
