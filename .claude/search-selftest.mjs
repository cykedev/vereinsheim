#!/usr/bin/env node
// Selbsttest der Memory-Graph-Suche (deutsch + englisch) gegen den vereinsheim-Graph.
// TOP1: muss auf Platz 1 ranken. TOP3: muss in den Top 3 erscheinen (deutsche
// Komposita / nahe Geschwister-Entities — fein über Verschlagwortung steuerbar).
// Aufruf: node .claude/search-selftest.mjs   (nach node .claude/build-graph.mjs)
import { loadStore, loadSidecar, entityToDoc } from "./graph-store.mjs"
import { buildIndex, search } from "./search-index.mjs"
import SYNONYMS from "./search-synonyms.mjs"

const STORE = ".claude/knowledge-graph.json"
const SIDECAR = ".claude/knowledge-graph.search.json"

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
  // Komposita / nahe Geschwister — über das Projekt-Synonym-Vokabular auf Platz 1 gehoben.
  ["Wie wird die Punktzahl berechnet?", "scoring-engine"],
  ["Anmeldung zum Wettbewerb", "participants-and-enrollment"],
  ["Bestenliste über die ganze Saison", "season-mode"],
  ["Backup wiederherstellen", "restore-from-backup"],
]
const TOP3 = []

const { entities } = loadStore(STORE)
if (!entities.length) {
  process.stderr.write("✖ search-selftest: leerer Store — zuerst node .claude/build-graph.mjs\n")
  process.exit(1)
}
const autokw = loadSidecar(SIDECAR)
const index = buildIndex(entities.map((e) => entityToDoc(e, autokw[e.name] ?? "")))

const fails = []
for (const [q, exp] of TOP1) {
  const r = search(index, q, { synonyms: SYNONYMS, limit: 3 })
  if (r[0]?.id !== exp) fails.push(`  ✖ TOP1 "${q}"\n      erwartet: ${exp}\n      bekommen: ${r.map((x) => x.id).join(", ") || "∅"}`)
}
for (const [q, exp] of TOP3) {
  const r = search(index, q, { synonyms: SYNONYMS, limit: 3 })
  if (!r.some((x) => x.id === exp)) fails.push(`  ✖ TOP3 "${q}"\n      erwartet in Top3: ${exp}\n      bekommen: ${r.map((x) => x.id).join(", ") || "∅"}`)
}

if (fails.length) {
  process.stderr.write(`✖ search-selftest: ${fails.length}/${TOP1.length + TOP3.length} Fälle fehlgeschlagen\n${fails.join("\n")}\n`)
  process.exit(1)
}
process.stdout.write(`✓ search-selftest: ${TOP1.length} TOP1 + ${TOP3.length} TOP3 Queries (de/en) korrekt\n`)
