// Einmal beim Start des Servers (nicht beim Build): das erste Admin-Konto anlegen, falls es keines gibt. Ohne
// Datenbank startet der Server trotzdem; die Anmeldung meldet dann den Fehler.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const [{ db }, { ensureSeedAdmin }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/startup"),
  ])
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
