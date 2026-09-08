import "server-only"

import { APP_LOCALE } from "./format"

// DB speichert immer UTC. Diese Timezone wird ausschliesslich für die UI-Darstellung verwendet.
const DEFAULT_DISPLAY_TIME_ZONE = "Europe/Berlin"

function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(APP_LOCALE, { timeZone: value })
    return true
  } catch {
    return false
  }
}

function resolveDisplayTimeZone(raw: string | undefined): string {
  const configured = raw?.trim()
  if (!configured) return DEFAULT_DISPLAY_TIME_ZONE
  if (!isValidIanaTimeZone(configured)) return DEFAULT_DISPLAY_TIME_ZONE
  return configured
}

/** Gibt die konfigurierte Anzeige-Zeitzone zurück (Env: DISPLAY_TIME_ZONE). */
export function getDisplayTimeZone(): string {
  return resolveDisplayTimeZone(process.env.DISPLAY_TIME_ZONE)
}

// Die Formatter selbst liegen in `./format` (isomorph, auch für Client-Komponenten).
// Hier nur re-exportiert, damit bestehende `@vereinsheim/lib/dateTime`-Importe
// weiter funktionieren; neue Aufrufer importieren direkt aus `@vereinsheim/lib/format`.
export { formatDateOnly } from "./format"
