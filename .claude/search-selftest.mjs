#!/usr/bin/env node
// Selbsttest der Memory-Graph-Suche (deutsch + englisch) gegen den vereinsheim-Vault (ADR-025).
// TOP1: muss auf Platz 1 ranken. Der Vault IST der Graph — kein Store/Build mehr; loadVault
// liest die Notes direkt. Aufruf: node .claude/search-selftest.mjs
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { entityToDoc } from "./graph-store.mjs"
import { loadVault, autokeywordsFor } from "./vault-loader.mjs"
import { extractKeywords } from "./keyword-extract.mjs"
import { buildIndex, search } from "./search-index.mjs"
import SYNONYMS from "./search-synonyms.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const VAULT = resolve(HERE, "..", "vault")

const TOP1 = [
  ["Liga-Modus mit Tabelle und Spielplan", "league-mode"],
  ["Ergebnisse aus Meyton importieren", "meyton-import"],
  ["Login Passwort und Sicherheit", "ringwerk-auth-security"],
  ["Rollen und Berechtigungen", "role-based-access"],
  ["Trainingstagebuch Eintrag erstellen", "training-sessions"],
  ["mentale Stärke Übungen", "mental-modules"],
  ["scoring engine", "scoring-engine"], // englische Query auf deutschem Inhalt
  ["Stechschuss bei Gleichstand", "best-of-single"],
  ["Disziplinen Luftpistole und Luftgewehr", "disciplines-and-factors"],
  ["Teilnehmern verwalten", "participants-and-enrollment"], // Dativ-Plural-Flexion
  ["wie deploye ich auf den Server", "deploy-flow"],
  ["Wie wird die Punktzahl berechnet?", "scoring-engine"],
  ["Anmeldung zum Wettbewerb", "participants-and-enrollment"],
  ["Bestenliste über die ganze Saison", "season-mode"],
  ["Backup wiederherstellen", "restore-from-backup"],
]

const { notes, entities } = loadVault(VAULT)
if (!entities.length) {
  process.stderr.write("✖ search-selftest: leerer Vault — Notes unter vault/ erwartet\n")
  process.exit(1)
}
const index = buildIndex(
  entities.map((e) => entityToDoc(e, autokeywordsFor(notes.get(e.name), notes, extractKeywords))),
)

const fails = []
for (const [q, exp] of TOP1) {
  const r = search(index, q, { synonyms: SYNONYMS, limit: 3 })
  if (r[0]?.id !== exp) fails.push(`  ✖ TOP1 "${q}"\n      erwartet: ${exp}\n      bekommen: ${r.map((x) => x.id).join(", ") || "∅"}`)
}

if (fails.length) {
  process.stderr.write(`✖ search-selftest: ${fails.length}/${TOP1.length} Fälle fehlgeschlagen\n${fails.join("\n")}\n`)
  process.exit(1)
}
process.stdout.write(`✓ search-selftest: ${TOP1.length} TOP1-Queries (de/en) korrekt gegen den Vault\n`)
