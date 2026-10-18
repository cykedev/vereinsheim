// Uhr des Prüfbestands: `Date.now()` und `new Date()` ohne Argument liefern eine feste Zeit, die nur `advance`
// weiterstellt. So tragen `createdAt`, `updatedAt`, Rückzugs- und Seriendaten bei jedem Lauf dieselben Werte, und die
// Reihenfolge nach `createdAt` (etwa der Teilnehmer beim Spielplan) ist eindeutig.

const RealDate = Date
let now = 0

class PruefDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(now)
    else super(...(args as [string | number | Date]))
  }

  static override now(): number {
    return now
  }
}

/** Stellt die Uhr auf `start` und ersetzt `Date` im ganzen Prozess. */
export function installClock(start: Date): void {
  now = start.getTime()
  globalThis.Date = PruefDate as DateConstructor
}

/** Stellt die Uhr um `ms` weiter (Voreinstellung: eine Minute). */
export function advance(ms = 60_000): void {
  now += ms
}

/** Setzt die Uhr auf einen Zeitpunkt, der nicht vor der aktuellen Zeit liegt. */
export function setClock(at: Date): void {
  now = Math.max(now + 1_000, at.getTime())
}

export function clockNow(): Date {
  return new RealDate(now)
}

/** Gibt `Date` wieder frei (für Tests). */
export function uninstallClock(): void {
  globalThis.Date = RealDate
}
