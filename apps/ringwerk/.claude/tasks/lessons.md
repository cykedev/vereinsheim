# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-06-23 -->
<!-- Alle bisherigen Einträge konsolidiert: Regeln → docs/ (code-conventions, ui-patterns, data-model, shared-conventions); Incidents/State → Memory-Graph (.claude/graph-captured.mjs); ops-lokales → natives Auto-Memory. Langzeit-Gedächtnis ist der Memory-Graph, nicht dieser Buffer. -->

## Offen

| Datum      | Fehler                                                                                                                                                                                                                                                                                                                                                     | Regel die ihn verhindert                                                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-25 | `updateCompetition` schrieb `parseDate(null)` → `null` für Felder, die das Formular bedingt ausblendet (Hin-/Rückrunde-Stichtag bei `leagueFormat = BEST_OF_SINGLE`) → gespeicherte Stichtage wurden beim Speichern lautlos gelöscht. Alle anderen bedingten Felder im selben `update()` waren mit `undefined` geschützt — nur die beiden Stichtage nicht. | Bei bedingt gerenderten Formularfeldern im Update **drei** Wege unterscheiden: Feld fehlt in der FormData → `undefined` (Spalte nicht anfassen), leer abgeschickt → `null` (bewusst geleert), Wert → parsen. `formData.get()` liefert `null` für nicht gerenderte Inputs — das ist **nicht** dasselbe wie „vom User geleert". |

## Abgeschlossen
