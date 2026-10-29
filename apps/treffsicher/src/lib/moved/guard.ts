import "server-only"

import { getAuthSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

import { disciplineWritable } from "./rules"
import { MOVED_TEXTS } from "./texts"

// Die eine Prüfung für alle Schreibwege eines umgezogenen Kontos ([[adr-033]], Stufe 3). Sie steht als erste Zeile in
// jeder Fassade mit "use server", die eigene Daten ändert; `coverage.test.ts` hält fest, welche das sind.

type Refusal = { error: string }

/** Ablehnung für ein umgezogenes Konto; `null`, wenn es nicht umgezogen ist oder niemand angemeldet ist */
export async function refuseIfMoved(): Promise<Refusal | null> {
  const session = await getAuthSession()
  if (!session?.user.movedToSpiegel) return null
  return { error: MOVED_TEXTS.refusal }
}

/**
 * Ablehnung für das Anlegen oder Ändern einer Disziplin: Ein umgezogener Admin pflegt weiter die Disziplinen der
 * Anlage, eigene nicht mehr. Fehlt die Disziplin, entscheidet die Action selbst („nicht gefunden“).
 */
export async function refuseDisciplineIfMoved(
  target: { id: string } | { isSystem: boolean }
): Promise<Refusal | null> {
  const session = await getAuthSession()
  if (!session?.user.movedToSpiegel) return null

  let isSystem: boolean
  if ("isSystem" in target) {
    isSystem = target.isSystem
  } else {
    const discipline = await db.discipline.findUnique({
      where: { id: target.id },
      select: { isSystem: true },
    })
    if (!discipline) return null
    isSystem = discipline.isSystem
  }

  const user = { moved: true, isAdmin: session.user.role === "ADMIN" }
  return disciplineWritable(user, { isSystem }) ? null : { error: MOVED_TEXTS.refusal }
}
