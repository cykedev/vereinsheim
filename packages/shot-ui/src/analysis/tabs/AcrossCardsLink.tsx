import type { Route } from "../../nav/routes"
import { RouteLink } from "../../nav/RouteLink"

/**
 * „Über alle Scheiben im Fortschritt ›“ unter einer Karte, deren Frage erst viele Scheiben beantworten (Form der Gruppe,
 * Richtungsuhr): führt zum Trefferbild der Familie. Ohne Weg (geteilte Scheibe) nichts.
 */
export function AcrossCardsLink({ route }: { route?: Route }) {
  if (!route) return null
  return (
    <RouteLink
      route={route}
      className="w-fit text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
    >
      Über alle Scheiben im Fortschritt ›
    </RouteLink>
  )
}
