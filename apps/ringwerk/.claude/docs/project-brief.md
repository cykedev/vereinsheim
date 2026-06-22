# Project Brief: Ringwerk

Vereinsinterne Wettbewerbs-Plattform fuer Schuetzenvereine. Bildet den gesamten internen Wettkampfbetrieb ab — von Ligen ueber Kranzlschiessen bis zum Jahrespreisschiessen.

**Vorgaenger:** 1-gegen-1 Liga-App (nur Liga-Modus). Ringwerk erweitert den Fokus auf universelle Wettbewerbsverwaltung mit konfigurierbaren Wertungsmodi und Disziplin-Korrekturfaktoren.

---

## Core Rules (non-negotiable)

1. **Server Actions** instead of API Routes for form actions
2. **No `any`** -- TypeScript strict mode
3. **No userId filter** on club-wide data -- auth via role (ADMIN/MANAGER/USER)
4. **Archive instead of delete** for data with dependencies (exception: Admin force-delete)
5. **shadcn/ui** for all UI elements -- no native browser dialogs

## Feature Implementation Order

Schema -> Migration -> Types -> Queries -> Actions -> Calculate -> Components -> Page -> Prettier -> `/check` -> Docs

## Domain Language

| Context                           | Language |
| --------------------------------- | -------- |
| UI text, error messages, comments | German   |
| Components, functions, file names | English  |
| Routes / URL segments             | English  |
| Commit messages                   | English  |
| Documentation                     | German   |

---

## Wettbewerbstypen

Ringwerk unterstuetzt drei Wettbewerbstypen, die alle auf einer gemeinsamen Scoring-Engine aufbauen:

| Typ                 | Beschreibung                                         | Beispiel                        |
| ------------------- | ---------------------------------------------------- | ------------------------------- |
| **Liga** (LEAGUE)   | Rundenbasiert mit Spielplan, Tabelle, Playoffs       | 1-gegen-1 Liga                  |
| **Event** (EVENT)   | Einmaliges Schiessen an einem Abend, Rangliste       | Kranzlschiessen, Pokalschiessen |
| **Saison** (SEASON) | Langzeit-Wettbewerb ueber Monate, beste Einzelserien | Jahrespreisschiessen            |

### Gemeinsamer Kern

- **Disziplinen** mit konfigurierbarem Teiler-Faktor
- **Serie** als universelle Ergebniseinheit (Ringe + Teiler + Disziplin + Schusszahl)
- **Scoring-Engine** mit 7 Wertungsmodi
- **Teilnehmerpool** (Vereinsmitglieder + Gaeste bei Events)

---

## Annahmen & Designentscheidungen

1. **Ein Faktor pro Disziplin** — kein getrennter Waffen-/Auflagefaktor; Admin konfiguriert den kombinierten Wert (z.B. LP Auflage = 0.6 statt separat /3 und \*1.8)
2. **Ringe brauchen keine Korrektur** — MaxRinge identisch ueber alle Disziplinen (100 Ganzringe, 109 Zehntelringe)
3. **Teiler-Faktor ist kein DSB-Standard** — vereinsintern definiert, frei konfigurierbar; uebliche Werte: LP /3.0–3.2, LG Auflage \*1.5–1.8
4. **Kein Migrationsdruck** — App ist pre-launch, aggressive Refactorings erlaubt
5. **Liga bleibt der komplexeste Modus** — Event und Saison sind strukturell einfacher
6. **Teams als spaetere Erweiterung** — kein Mannschaftswettbewerb in der Erstversion
7. **Zielwert-Modi nur fuer Events** — TARGET_ABSOLUTE, TARGET_UNDER und TARGET_OVER kommen nur bei Kranzlschiessen vor
8. **Competition als Oberbegriff** — Liga, Event und Saison sind Auspraegungen von Competition (im Datenmodell)
9. **Serie als universelle Ergebniseinheit** — ersetzt das bisherige MatchResult; optional mit Matchup verknuepft (nur Liga)
10. **Saison zeigt Mehrfach-Ranking** — beste Ringe, bester Teiler, bester Ringteiler als separate Spalten; kein einzelner "Gewinner"

---

## Risiken

| Risiko                                               | Auswirkung                                 | Mitigation                                                                             |
| ---------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Competition-Abstraktion wird zu generisch            | Viele nullable Felder, unklare Validierung | Typ-spezifische Zod-Schemas (Discriminated Unions), klare Defaults                     |
| MatchResult → Series Refactoring bricht Liga-Logik   | Tests schlagen fehl                        | Aggressive Testabdeckung vor Refactoring; pre-launch = kein Datenverlust               |
| Scoring-Engine-Komplexitaet durch 7 Modi             | Schwer testbar, Edge Cases                 | Jeder Modus als eigene Pure Function, parametrisierte Tests                            |
| Rename League → Competition beruehrt fast jede Datei | Hohes Fehlerrisiko                         | Atomarer Rename in einer dedizierten Phase, danach sofort /check                       |
| Zielwert + Faktor-Korrektur Interaktion              | Unklare Semantik                           | Faktor auf Rohwert anwenden, Zielwert in korrigiertem Raum — dokumentiert und getestet |

---

## How to Formulate Requests

### NEW_PLANNED -- Known feature

Reference `.claude/docs/features.md` or `.claude/tasks/todo.md`:

```
"Implement Phase 1 from todo.md."
"Next phase from the Ringwerk plan."
"Build the Event mode as described in features.md."
```

### NEW_UNKNOWN -- New requirement

Clearly mark as new:

```
"I'd like a statistics page for participants."
"Can we add a CSV export for results?"
"New idea: notifications when results are entered."
```

### MODIFICATION -- Change existing feature

Name the existing feature + desired change:

```
"Change scoring mode options for Events."
"Add a new scoring mode to the engine."
"Table sorting should prioritize Ringteiler over points."
```

### BUGFIX -- Report an error

Error description, ideally with context:

```
"Standings calculation shows wrong points for bye matches."
"Factor correction is not applied in Event ranking."
"Error: page crashes when a participant withdraws."
```

Also accepted: screenshots, error messages, stack traces.

### MAINTENANCE -- Cleanup

Clearly formulate as maintenance task:

```
"Refactor calculateStandings -- the function is too long."
"Clean up unused imports in src/lib/."
```
