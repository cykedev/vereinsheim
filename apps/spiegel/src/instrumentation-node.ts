import { db } from "@/lib/db"
import { ensureSeedAdmin } from "@/lib/startup"

/** das erste Admin-Konto anlegen, falls es keines gibt; ohne Datenbank startet der Server trotzdem */
export async function registerNode() {
  try {
    const result = await ensureSeedAdmin(db, {
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    })
    if (result === "created")
      console.warn(`Admin-Konto angelegt für ${process.env.SEED_ADMIN_EMAIL}`)
    if (result === "missing-env")
      console.warn("SEED_ADMIN_EMAIL oder SEED_ADMIN_PASSWORD fehlt: kein Admin-Konto angelegt")
  } catch (error) {
    console.error("Admin-Konto beim Start nicht geprüft:", error)
  }
}
