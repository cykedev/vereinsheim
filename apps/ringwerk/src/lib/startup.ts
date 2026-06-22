import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { ensureSystemDisciplines } from "@/lib/disciplines/systemDisciplines"

// Wird beim App-Start einmalig aufgerufen (aus root layout.tsx).
// Legt den ersten Admin-Account an, wenn noch kein Admin in der Datenbank existiert.
// Zugangsdaten kommen aus den Umgebungsvariablen SEED_ADMIN_EMAIL und SEED_ADMIN_PASSWORD.
//
// Seed beim Start ausführen, damit neue Umgebungen ohne manuelle Zusatzschritte lauffähig sind.
// So funktioniert die Initialisierung automatisch beim ersten Docker-Start,
// ohne dass ein manueller Schritt nötig ist.
let hasRun = false

export async function runStartup(): Promise<void> {
  // Verhindert mehrfache Ausführung im gleichen Prozess (z.B. bei Hot-Reload)
  if (hasRun) return
  hasRun = true

  const createdDisciplines = await ensureSystemDisciplines(db)
  if (createdDisciplines > 0) {
    console.warn(`Standarddisziplinen angelegt: ${createdDisciplines}`)
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.warn(
      "SEED_ADMIN_EMAIL oder SEED_ADMIN_PASSWORD nicht gesetzt — kein Admin-Account wird angelegt."
    )
    return
  }

  // Prüfen ob bereits ein Admin existiert
  const existingAdmin = await db.user.findFirst({
    where: { role: "ADMIN" },
  })

  if (existingAdmin) {
    // Normaler Fall nach dem ersten Start — nichts tun
    return
  }

  // Erster Start: Admin anlegen
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  await db.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
    },
  })

  console.warn(`Admin-Account angelegt für: ${adminEmail}`)
}
