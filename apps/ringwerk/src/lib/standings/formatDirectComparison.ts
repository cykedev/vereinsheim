import type { DirectComparison } from "./bestOfStandingsTypes"

/**
 * Semantischer Ton für die Direktvergleich-Zelle. Das konkrete Styling macht jeder Renderer
 * (Tabelle = Tailwind-Klassen, PDF = react-pdf-Styles) selbst — der Helfer bleibt darstellungsfrei,
 * damit Tabelle und PDF garantiert denselben Text zeigen.
 */
export type DirectComparisonTone = "win" | "loss" | "pending" | "muted"

/**
 * Formatiert die Direktvergleich-Zelle (Kriterium 4) einheitlich für Tabelle und PDF.
 * Gibt reinen Text + Ton zurück.
 */
export function formatDirectComparison(dc: DirectComparison | null): {
  text: string
  tone: DirectComparisonTone
} {
  if (!dc) return { text: "—", tone: "muted" }
  switch (dc.kind) {
    case "decided":
      // 2er-Gleichstand: konkretes Satz-Ergebnis der direkten Begegnung (eigene Sicht) + Gegner.
      return {
        text: `${dc.satz[0]}:${dc.satz[1]} · ${dc.opponent}`,
        tone: dc.result === "win" ? "win" : "loss",
      }
    case "record":
      // 3er+-Gleichstand: Mini-Liga-Bilanz (Direktsiege:Direktniederlagen) innerhalb der Gruppe.
      return { text: `${dc.wins}:${dc.losses}`, tone: dc.wins > dc.losses ? "win" : "muted" }
    case "open":
      // Direkte Begegnung (noch) nicht gespielt → alphabetisch; sichtbar machen, warum.
      return { text: dc.opponent ? `offen · ${dc.opponent}` : "offen", tone: "pending" }
    case "even":
      // Gespielt, aber gleiche Bilanz / zyklisch → alphabetisch.
      return { text: "ausgeglichen", tone: "muted" }
  }
}
