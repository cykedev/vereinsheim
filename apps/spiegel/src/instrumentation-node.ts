import { db } from "@/lib/db"
import { refreshStaleDisciplineCards, refreshStaleProjections } from "@/lib/db/cards"
import { purgeExpiredTrash } from "@/lib/db/trash"
import { rereadOutdatedKeys } from "@/lib/ingest/reread"
import { sweepUploadsSoon } from "@/lib/uploads"
import { readerBundleMissing } from "@/lib/printouts/reader"
import { rereadOutdatedPrintouts } from "@/lib/printouts/reread"
import { ensureSeedAdmin } from "@/lib/startup"

const HOUR_MS = 3_600_000

/** abgelaufene Scheiben im Papierkorb endgültig löschen, danach Ausdrucke ohne Scheibe; ins Log nur Zahlen */
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
    .finally(() => sweepUploadsSoon(db))
}

/** Scheiben mit veralteter Zuordnung ihrer Disziplin nachrechnen; ins Log nur Zahlen und den Namen eines Fehlers */
function refreshDisciplines() {
  void refreshStaleDisciplineCards(db)
    .then((count) => {
      if (count) console.warn(`${count} Scheiben nach einer Zuordnung neu gerechnet`)
    })
    .catch((error: unknown) =>
      console.error(
        "Scheiben nach einer Zuordnung nicht nachgerechnet:",
        error instanceof Error ? error.name : "unbekannter Fehler"
      )
    )
}

/** Scheiben aus den Rohdaten neu lesen, die der aktuelle Adapter noch nicht kennt; ins Log nur Zahlen und den Namen */
function rereadKeys() {
  void rereadOutdatedKeys(db)
    .then(({ keys, created, failed }) => {
      if (keys)
        console.warn(`${keys} Scheiben aus den Rohdaten neu gelesen, ${created} Blöcke dazu`)
      if (failed) console.error(`${failed} Scheiben nicht neu gelesen`)
    })
    .catch((error: unknown) =>
      console.error(
        "Rohdaten nicht neu gelesen:",
        error instanceof Error ? error.name : "unbekannter Fehler"
      )
    )
}

/** gespeicherte Ausdrucke mit einer älteren Version des Lesers neu lesen; ins Log nur Zahlen und den Namen */
function rereadPrintouts() {
  void rereadOutdatedPrintouts(db)
    .then(({ read, taken, failed, missing }) => {
      if (read) console.warn(`${read} Ausdrucke neu gelesen, ${taken} mit Werten`)
      if (failed || missing)
        console.error(`${failed} Ausdrucke nicht neu gelesen, ${missing} ohne Datei`)
    })
    .catch((error: unknown) =>
      console.error(
        "Ausdrucke nicht neu gelesen:",
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
  if (readerBundleMissing()) {
    console.error("printout-reader.mjs fehlt: Ausdrucke lassen sich nicht lesen")
  }
  void refreshStaleProjections(db)
    .then((count) => {
      if (count) console.warn(`${count} Projektionen beim Start neu gerechnet`)
    })
    .catch((error: unknown) => console.error("Projektionen beim Start nicht nachgerechnet:", error))
  // Papierkorb samt Ausdrucken, Zuordnungen der Disziplinen und Neulesen: beim Start und danach stündlich; `unref` hält den Prozess nicht am Leben
  emptyExpiredTrash()
  setInterval(emptyExpiredTrash, HOUR_MS).unref()
  refreshDisciplines()
  setInterval(refreshDisciplines, HOUR_MS).unref()
  // neue Version des Adapters: ruhende ScheibenIDs neu lesen ([[adr-027]], jeder Probe-Block eine Scheibe)
  rereadKeys()
  setInterval(rereadKeys, HOUR_MS).unref()
  // neue Version des Lesers: Ausdrucke an Scheiben vom Ausdruck neu lesen ([[meyton-printout]])
  rereadPrintouts()
  setInterval(rereadPrintouts, HOUR_MS).unref()
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
