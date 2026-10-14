import { db } from "@/lib/db"
import { refreshStaleProjections } from "@/lib/db/cards"
import { purgeExpiredTrash } from "@/lib/db/trash"
import { ensureSeedAdmin } from "@/lib/startup"

const HOUR_MS = 3_600_000

/** abgelaufene Scheiben im Papierkorb endgültig löschen (P2b); ins Log nur Zahlen */
function emptyExpiredTrash() {
  void purgeExpiredTrash(db, { nowMs: Date.now() })
    .then(({ purged, failed }) => {
      if (purged) console.warn(`${purged} Scheiben aus dem Papierkorb endgültig gelöscht`)
      if (failed) console.error(`${failed} Scheiben im Papierkorb nicht gelöscht`)
    })
    .catch((error: unknown) =>
      console.error(
        "Papierkorb nicht geleert:",
        error instanceof Error ? error.name : "unbekannter Fehler"
      )
    )
}

/**
 * Beim Start: das erste Admin-Konto anlegen, falls es keines gibt, den Papierkorb leeren und veraltete Projektionen im
 * Hintergrund nachrechnen (ADR-031: nach einer neuen `projectionVersion`; die Übersichten lesen bis dahin die alte).
 * Ohne Datenbank startet der Server trotzdem.
 */
export async function registerNode() {
  void refreshStaleProjections(db)
    .then((count) => {
      if (count) console.warn(`${count} Projektionen beim Start neu gerechnet`)
    })
    .catch((error: unknown) => console.error("Projektionen beim Start nicht nachgerechnet:", error))
  // Papierkorb: beim Start und danach stündlich (30 Tage, D4); `unref` hält den Prozess nicht am Leben
  emptyExpiredTrash()
  setInterval(emptyExpiredTrash, HOUR_MS).unref()
  try {
    const result = await ensureSeedAdmin(db, {
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    })
    if (result === "created")
      console.warn(`Admin-Konto angelegt für ${process.env.SEED_ADMIN_EMAIL}`)
    if (result === "restored")
      console.warn(`Kein aktiver Admin: ${process.env.SEED_ADMIN_EMAIL} ist wieder Admin`)
    if (result === "missing-env")
      console.warn("SEED_ADMIN_EMAIL oder SEED_ADMIN_PASSWORD fehlt: kein Admin-Konto angelegt")
  } catch (error) {
    console.error("Admin-Konto beim Start nicht geprüft:", error)
  }
}
