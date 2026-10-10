import { db } from "@/lib/db"
import { refreshStaleProjections } from "@/lib/db/cards"
import { ensureSeedAdmin } from "@/lib/startup"

/**
 * Beim Start: das erste Admin-Konto anlegen, falls es keines gibt, und veraltete Projektionen im Hintergrund nachrechnen
 * (ADR-031: nach einer neuen `projectionVersion`; die Übersichten lesen bis dahin die alte). Ohne Datenbank startet der
 * Server trotzdem.
 */
export async function registerNode() {
  void refreshStaleProjections(db)
    .then((count) => {
      if (count) console.warn(`${count} Projektionen beim Start neu gerechnet`)
    })
    .catch((error: unknown) => console.error("Projektionen beim Start nicht nachgerechnet:", error))
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
