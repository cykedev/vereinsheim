// Gemeinsamer Rahmen für den Aufbau: Sitzung der handelnden Person, Uhr, Teilnehmer-Pool und Disziplinen. Jede
// schreibende Operation läuft über `act`: Uhr eine Minute weiter, Action aufrufen, Fehler der Action als Abbruch melden.

import type { Session } from "next-auth"

import type { ActionResult } from "@/lib/types"

import { advance } from "./clock"
import type { PersonName } from "./names"
import type { Ringwerk } from "./ringwerk"
import type { DisciplineKey } from "./scenarios"
import { setPruefSession } from "./stubs/next-auth"

export interface PoolParticipant extends PersonName {
  id: string
}

export interface Context {
  rw: Ringwerk
  /** Teilnehmer aus der Verwaltung, in Anlage-Reihenfolge. */
  pool: PoolParticipant[]
  /** Ehemalige Mitglieder: nur im archivierten Event, danach deaktiviert. */
  formerPool: PoolParticipant[]
  longNamePool: PoolParticipant[]
  disciplines: Record<DisciplineKey, string>
  /** Öffentliches Passwort für Wettbewerbe mit `public: "passwort"`. */
  publicPassword: string
  /** Bezeichnung des laufenden Szenarios für Fehlermeldungen. */
  scenario: string
}

export interface Actor {
  id: string
  role: "ADMIN" | "MANAGER" | "USER"
}

export function actAs(actor: Actor): void {
  const session: Session = {
    user: { id: actor.id, role: actor.role, sessionVersion: 0, name: null },
    expires: "2099-12-31T00:00:00.000Z",
  }
  setPruefSession(session)
}

/** Ruft eine Action auf und bricht ab, wenn sie einen Fehler meldet. */
export async function act<T>(
  ctx: Pick<Context, "scenario">,
  label: string,
  call: () => Promise<ActionResult<T>>
): Promise<T | undefined> {
  advance()
  const result = await call()
  if ("error" in result) {
    throw new Error(`${ctx.scenario}: ${label} fehlgeschlagen: ${JSON.stringify(result.error)}`)
  }
  return result.data
}

/** FormData aus einem Objekt; `undefined` und `false` fehlen wie ein nicht angehakter Schalter. */
export function formData(fields: Record<string, string | number | boolean | undefined>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === false) continue
    data.set(key, value === true ? "on" : String(value))
  }
  return data
}

/** Datum als Formularwert (`YYYY-MM-DD`). */
export function dateField(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}
