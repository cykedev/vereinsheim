# Plan: SP-1.11 Hilfe und Erklärungen

- **Anlass:** Wunsch des Users vom 6. Oktober 2026: „ich verstehe zwar nicht alle, d.h. wir sollten eine
  gute dokumentation und hilfe, auch in der anwendung vorsehen. das ist wichtig.“ Roadmap SP-1.11.
- **Entscheidung des Users:** eigenes Paket `packages/shot-help` mit Texten, Glossar und Einstieg; ein Test
  erzwingt einen Text für jede Kennzahl der Registry und jede Auswertung; der Vault-Leitfaden
  `vault/spiegel/spiegel-statistics-help.md` wird daraus erzeugt.
- **Branch:** `feat/spiegel-help` (von `main`, Stand `ba4ea2d`)
- **Datum:** 2026-10-06

## 1. Context (warum)

Die Analyse aus SP-1.10 rechnet viel, aber nicht jede Zahl erklärt sich selbst. Heute stehen die
Erklärungen zweimal: handgeschrieben im Vault-Leitfaden und als Kopie in der Spielwiese (`HELP`,
`GLOSSARY`). Zwei Kopien laufen auseinander ([[next-dist-dir-shared-with-dev-server]] beschreibt dieselbe
Klasse von Problem), und nichts erzwingt, dass eine neue Kennzahl eine Erklärung bekommt.

Ziel: **eine Quelle** für alle Erklärungen, als Daten in einem Paket, das App, Spielwiese und Doku nutzen.
Ein Test macht fehlende Erklärungen zum roten Gate, so wie der Paar-Test die Wertungen erzwingt. Die
Oberfläche (SP-1.8) zeigt die Texte später an jeder Kachel und Karte; hier entstehen Daten, Prüfungen und
die erzeugte Doku. Die Spielwiese zeigt sie sofort.

## 2. Entscheidungen

- **E1 Eigenes Paket `@vereinsheim/shot-help`** (User). Rein, isomorph, ohne Laufzeit-Abhängigkeit;
  `@vereinsheim/shot-core` nur als `devDependency` für die Tests. Der Fachkern bleibt reine Rechnung.
- **E2 Themen statt Einzel-IDs:** Eine Erklärung (`HelpTopic`) gehört zu einer Karte der Oberfläche und
  deckt mehrere Katalog-IDs und Registry-Schlüssel ab (etwa „Bester und schwächster Schuss“ für E6, E7,
  E8 und `result.bestTeiler`). Jede Registry-Kennzahl gehört zu **genau einem** Thema (eindeutiges „?“
  an der Kachel), jede Katalog-ID einer Auswertung zu **mindestens einem**.
- **E3 Welche Auswertungen es gibt, sagt `shot-core`:** neues `ANALYSIS_CATALOG` in
  `packages/shot-core/src/analysis/catalog.ts`, Funktionsname → Katalog-IDs (33 Funktionen). Ein Test in
  `shot-core` erzwingt, dass jede exportierte Funktion von `./analysis` dort steht; ein Test in
  `shot-help` erzwingt für jede dort genannte ID eine Erklärung. So kann keine neue Auswertung ohne
  Erklärung ins Gate.
- **E4 Aufbau einer Erklärung** wie im Leitfaden: Titel, ein Satz für Kachel und Tooltip (`short`),
  `what` (Was), `read` (So liest du es), `act` (Was du tun kannst), `caution` (Vorsicht), `minimum`
  (ab wann es die Zahl gibt) und `formula` (für Profis, aufklappbar, nie vor den Worten). Pflicht: `id`,
  `title`, `theme`, `short`, `what`; alles andere optional.
- **E5 Erklärungen zur Oberfläche** (Beobachtungen in Worten, Probe auf der Scheibe) sind keine
  Statistik und stehen getrennt in `VIEW_HELP`. Dazu `READING_GUIDE` („So liest du die Zahlen“),
  `GLOSSARY` und `FALLACIES` (typische Fehlschlüsse).
- **E6 Doku wird erzeugt:** `renderGuideMarkdown()` erzeugt den Hauptteil des Leitfadens
  deterministisch (Umbruch bei 100 Zeichen). Im Vault steht er zwischen
  `<!-- shot-help:start … -->` und `<!-- shot-help:end -->`; Frontmatter und TL;DR bleiben
  handgeschrieben. `pnpm --filter @vereinsheim/shot-help docs` schreibt den Abschnitt (über `tsx`), ein
  Test vergleicht ihn mit dem Paket und wird rot, wenn jemand nur eine Seite ändert. ADR-025 bleibt
  unberührt: Der Abschnitt ist eingecheckter Text, der Loader liest ihn wie jede Note.
- **E7 Turbo:** Der Synchron-Test liest eine Datei außerhalb des Pakets. Paketeigene `turbo.json` mit
  `inputs` `["$TURBO_DEFAULT$", "$TURBO_ROOT$/vault/spiegel/spiegel-statistics-help.md"]` für `test`,
  damit eine Änderung am Leitfaden den Cache invalidiert. Kennt Turbo 2.10 `$TURBO_ROOT$` nicht
  (Probelauf in Task 2), setzt der Task stattdessen `"cache": false` (Tests unter einer Sekunde).
- **E8 Stil der Texte** wie in der Doku: „du“, deutsch, einfache Sprache, deutsche Anführungszeichen
  „…“, Unicode-Ellipse, keine Formeln in `what`/`read`. Ein Test prüft: keine geraden Anführungszeichen
  `"`, kein `...`, jeder Text endet mit Satzzeichen.

## 3. Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/analysis/catalog.ts` | neu: `ANALYSIS_CATALOG` |
| `packages/shot-core/src/analysis/catalog.test.ts` | neu: jede exportierte Funktion steht im Katalog, jede ID hat die Form `[A-Z]\d+` |
| `packages/shot-core/src/analysis/index.ts` | exportiert `./catalog` |
| `packages/shot-core/CLAUDE.md` | Regel: neue Auswertung → Eintrag in `ANALYSIS_CATALOG` und Erklärung in `shot-help` |
| `packages/shot-help/package.json`, `tsconfig.json`, `vitest.config.ts`, `turbo.json`, `CLAUDE.md` | neu, nach dem Muster von `packages/meyton-pdf` |
| `packages/shot-help/src/types.ts` | `HelpTopic`, `HelpTheme`, `ViewHelp`, `GlossaryEntry`, `GuideItem` |
| `packages/shot-help/src/topics.ts` | `HELP_TOPICS` (25 Themen, Liste in Task 4) |
| `packages/shot-help/src/guide.ts` | `READING_GUIDE`, `VIEW_HELP`, `FALLACIES` |
| `packages/shot-help/src/glossary.ts` | `GLOSSARY` |
| `packages/shot-help/src/lookup.ts` | `helpTopic(id)`, `helpForMetric(key)`, `helpForCatalog(id)` |
| `packages/shot-help/src/markdown.ts` | `renderGuideMarkdown()`, `wrapText()` |
| `packages/shot-help/src/*.test.ts` | Vollständigkeit, Bezüge, Stil, Nachschlagen, Markdown, Synchronität |
| `packages/shot-help/scripts/write-guide.ts` | schreibt den Abschnitt in den Vault |
| `vault/spiegel/spiegel-statistics-help.md` | Hauptteil zwischen den Markern, erzeugt |
| `vault/spiegel/spiegel-roadmap.md`, `spiegel-ui-design.md`, `vault/architecture/architecture.md` | Status, Verweis aufs Paket, Repo-Karte |
| `pnpm-lock.yaml` | nur der neue Importer `packages/shot-help` |

## Required Docs

- `vault/conventions.md` (§9: `toBeCloseTo` nimmt null, Charakterisierungstests, Mutation)
- `packages/shot-core/CLAUDE.md` (Registry-Regeln, Exporte)
- `vault/spiegel/spiegel-statistics-help.md` (heutige Texte, Quelle der Migration)
- `vault/spiegel/spiegel-statistics.md` (Katalog-IDs und Formeln)
- `vault/spiegel/spiegel-ui-design.md` (Abschnitt „Hilfe und Erklärungen“)
- `vault/SCHEMA.md` (Frontmatter und Aufbau einer Note), ADR-025 (Vault), ADR-029 (Lizenz)

## 4. Tasks

### Task 1: `ANALYSIS_CATALOG` in `shot-core` (test-first)

Test `catalog.test.ts`: `import * as analysis from "./index"`; die Menge der Funktionen
(`typeof v === "function"`) ist gleich der Schlüsselmenge von `ANALYSIS_CATALOG`; jede ID passt auf
`/^[A-Z]\d+$/`; keine Funktion ohne ID. Dann `catalog.ts`:

| Funktion | IDs | Funktion | IDs | Funktion | IDs |
|---|---|---|---|---|---|
| `ringDistribution` | V1 | `ringWidths` | P9 | `shootingTime` | Z3 |
| `decimalHistogram` | V2 | `outliers` | V6 | `pauseRecovery` | Z4 |
| `shotExtremes` | E6, E8 | `outlierLoss` | V7 | `rhythmProfile` | Z5 |
| `teilerStats` | E7 | `mpiConfidence` | L1, L3 | `seriesCurve` | I1 |
| `ringLoss` | E9 | `ringLossSplit` | L4 | `fatigue` | I2 |
| `seriesConsistency` | E10 | `positionShare` | L5 | `cardTrend` | I3 |
| `shareAtLeast` | E4, E11 | `directionClock` | L6 | `movingAverage` | I4 |
| `sigmaEstimate` | P5 | `drift` | L8 | `seriesSpread` | I5 |
| `heightWidth` | P7 | `tempoSpread` | Z2 | `mpiPath` | I6 |
| `groupShape` | P8 | `longestRun` | I10 | `sighterSummary` | S2 |
| `sighterComparison` | S3 | `sighterZeroed` | S4 | `dataCoverage` | Q1 |

`index.ts` exportiert `./catalog`. Scope-Notiz um die Regel ergänzen. Commit
`feat(shot-core): list the catalog IDs behind every analysis`.

### Task 2: Paket-Gerüst `shot-help`

`package.json` wie `meyton-pdf` (Name `@vereinsheim/shot-help`, `private`, `license: Apache-2.0`,
`type: module`), Exporte `./topics`, `./guide`, `./glossary`, `./lookup`, `./markdown`, `./types`;
Skripte `check-types`, `test`, `format:check`, `format`, `docs` (`tsx scripts/write-guide.ts`);
`devDependencies`: `@vereinsheim/config`, `@vereinsheim/shot-core` (`workspace:*`), `@types/node`,
`prettier`, `tsx`, `typescript`, `vitest` (alle `catalog:`). `tsconfig.json` wie `meyton-pdf`, aber
`"types": ["node"]` und `include: ["src", "scripts"]` (nur Tests und Skript brauchen `node:fs`).
`vitest.config.ts` wie `shot-core`. `turbo.json` nach E7; Probelauf
`pnpm exec turbo run test --filter=@vereinsheim/shot-help --dry=json` zeigt, ob der Leitfaden in die
Eingaben geht, sonst `"cache": false`. `pnpm install`, Lockfile-Diff nur der neue Importer;
`pnpm install --frozen-lockfile` danach (Konvention §9). Scope-Notiz `CLAUDE.md` mit Zweck, Exporten,
Regeln (eine Quelle, Stil, Doku erzeugen statt schreiben). Commit `chore(shot-help): add the package`.

### Task 3: Typen und Prüfungen (test-first, Daten noch leer)

`types.ts`:

```ts
export type HelpTheme = "result" | "precision" | "position" | "time" | "sighters" | "coverage"
export interface HelpTopic {
  id: string // kebab-case, stabil
  title: string
  theme: HelpTheme
  catalog: readonly string[] // Katalog-IDs, etwa ["P5", "P9"]
  metrics: readonly string[] // Registry-Schlüssel, etwa ["group.sigma"]
  short: string // ein Satz für Kachel und Tooltip
  what: string
  read?: string
  act?: string
  caution?: string
  minimum?: string // etwa "ab 10 Schuss"
  formula?: string
}
export interface ViewHelp { id: string; title: string; what: string; read?: string }
export interface GlossaryEntry { term: string; text: string }
export interface GuideItem { title: string; text: string }
```

`topics.test.ts` (rot, solange `HELP_TOPICS` leer ist): jede Registry-Kennzahl aus `METRICS` in genau
einem Thema; jede ID aus `ANALYSIS_CATALOG` in mindestens einem; keine unbekannten Registry-Schlüssel;
Katalog-IDs in der Form des Katalogs (`/^[EPLVZISTRCKWQ]\d+$/`; Registry-IDs wie E1 oder P1 stehen nicht
in `ANALYSIS_CATALOG`);
`id` eindeutig und kebab-case; jedes Thema deckt mindestens eine ID oder Kennzahl ab; Themen-Reihenfolge
nach `theme` gruppiert. `style.test.ts` über alle Texte aller Exporte: nicht leer, kein `"`, kein
`...`, endet auf `.`, `!`, `?` oder `“`; `short` höchstens 140 Zeichen. Commit mit Task 4.

### Task 4: Texte migrieren

Aus dem Leitfaden und der Spielwiese, Formeln aus dem Katalog. Themen (Reihenfolge = Oberfläche):

| id | Titel | theme | catalog | metrics |
|---|---|---|---|---|
| `ergebnis` | Ergebnis und Ø je Schuss | result | E1, E2 | result.rings, result.decimal, result.decimalMean, result.ringsMean |
| `ringverteilung` | Ringverteilung | result | V1 | |
| `zehntelverteilung` | Zehntelverteilung | result | V2 | |
| `extreme-und-teiler` | Bester und schwächster Schuss | result | E6, E7, E8 | result.bestTeiler |
| `serien-und-konstanz` | Serien und Konstanz | result | E9, E10, I1 | |
| `quoten` | Quoten mit Unsicherheit | result | E4, E5, E11, I10 | result.tens, result.innerTens, result.tensRate |
| `praezision-sigma` | Präzision σ | precision | P5, P9 | group.sigma |
| `masse-der-gruppe` | Maße der Gruppe | precision | P1, P3, P4, P6, P7 | group.enclosingDiameter, group.meanRadius, group.r50, group.sdX, group.sdY, group.height, group.width |
| `form-der-gruppe` | Form der Gruppe | precision | P8 | |
| `ausreisser` | Ausreißer | precision | V6, V7 | |
| `lage-echt` | Ist die Lage echt? | position | L1, L2, L3 | group.mpiDistance |
| `ringverlust-nach-ursache` | Ringverlust nach Ursache | position | L4 | |
| `lageanteil` | Lageanteil am Fehler | position | L5 | |
| `richtungsuhr` | Richtungsuhr | position | L6 | |
| `drift-und-wanderung` | Drift und Wanderung | position | L8, I6 | |
| `verlauf-und-trend` | Verlauf je Schuss und Trend | time | I3, I4 | |
| `rhythmus` | Rhythmus | time | Z5 | |
| `tempo-und-dauer` | Tempo und Dauer | time | Z1, Z2, Z3 | time.intervalMedian, time.tempoSpread, time.duration |
| `pausen` | Pausen und Wiedereinstieg | time | Z4 | time.longestPause |
| `ermuedung` | Ermüdung | time | I2 | |
| `serien-im-vergleich` | Serien im Vergleich | time | I1, I5, I6 | |
| `probe-umfang` | Umfang der Probe | sighters | S2 | |
| `probe-gegen-wertung` | Probe gegen Wertung | sighters | S3 | |
| `eingeschossen` | Eingeschossen? | sighters | S1, S4 | sighter.offset |
| `datenlage` | Datenlage | coverage | Q1 | |

`VIEW_HELP`: `beobachtungen` (Beobachtungen in Worten), `probe-auf-der-scheibe`. `READING_GUIDE`:
die acht Punkte aus „So liest du die Zahlen“. `GLOSSARY`: die 18 Begriffe. `FALLACIES`: die fünf
Fehlschlüsse. Die Tests aus Task 3 werden grün. Commit
`feat(shot-help): explain every metric and analysis in plain language`.

### Task 5: Nachschlagen (test-first)

`lookup.ts`: `helpTopic(id)` → Thema oder `undefined`; `helpForMetric(key)` → das eine Thema;
`helpForCatalog(id)` → alle Themen mit der ID, in Reihenfolge. Tests: `helpForMetric("group.sigma").id`
ist `praezision-sigma`; `helpForCatalog("I1")` liefert `serien-und-konstanz` und `serien-im-vergleich`;
unbekannt → `undefined` bzw. `[]`. Commit mit Task 6.

### Task 6: Markdown erzeugen (test-first)

`markdown.ts`: `wrapText(text, width, indent)` bricht an Leerzeichen um (nie mitten im Wort, Zeilen ≤
100 Zeichen außer einem Einzelwort, das länger ist); `renderGuideMarkdown()` erzeugt: `## So liest du
die Zahlen` (Liste aus `READING_GUIDE`), je Thema der Reihenfolge nach eine Überschrift `## Ergebnis`,
`## Präzision`, `## Lage`, `## Zeit und Verlauf`, `## Probe`, `## Datenlage`, darunter je Erklärung
`**Titel (IDs)**` und die Liste `- *Was:* …`, `- *So liest du es:* …`, `- *Was du tun kannst:* …`,
`- *Vorsicht:* …`, `- *Ab:* …`, `- *Formel:* …` (nur vorhandene Felder), dann `## Glossar` und
`## Typische Fehlschlüsse`. Tests: Reihenfolge der Überschriften; Felder fehlen, wenn leer; jede Zeile
≤ 100 Zeichen; zweimal erzeugt gibt dasselbe; ein Thema mit allen Feldern ergibt genau den erwarteten
Block (von Hand geschrieben). Commit `feat(shot-help): render the guide from the help data`.

### Task 7: Leitfaden im Vault erzeugen und synchron halten

`scripts/write-guide.ts`: liest `vault/spiegel/spiegel-statistics-help.md`, ersetzt den Text zwischen
`<!-- shot-help:start · erzeugt aus packages/shot-help (pnpm --filter @vereinsheim/shot-help docs), nicht
von Hand ändern -->` und `<!-- shot-help:end -->` durch `renderGuideMarkdown()`; fehlen die Marker, bricht
es mit Meldung ab. Einmalig: den heutigen Hauptteil durch die Marker ersetzen (Frontmatter, TL;DR und der
Satz zur Herkunft bleiben), dann `pnpm --filter @vereinsheim/shot-help docs`. `sync.test.ts`: liest die
Datei, der Abschnitt zwischen den Markern ist gleich `renderGuideMarkdown()`; sonst Meldung „Leitfaden
veraltet: pnpm --filter @vereinsheim/shot-help docs“. `vault-lint` grün. Commit
`docs(spiegel): generate the help guide from shot-help`.

### Task 8: Doku

Roadmap SP-1.11: Status erledigt (Daten, Prüfungen, erzeugte Doku; die Anzeige in der App folgt mit
SP-1.8). `spiegel-ui-design` „Hilfe und Erklärungen“: Quelle ist `@vereinsheim/shot-help`, das „?“ zeigt
`helpForMetric`/`helpTopic`. `vault/architecture/architecture.md`: Paket in der Repo-Karte.
`shot-core/CLAUDE.md`: Regel aus Task 1. Commit `docs(spiegel): document the help package`.

## 5. Test steps

1. `pnpm --filter @vereinsheim/shot-core test` und `pnpm --filter @vereinsheim/shot-help test` grün.
2. Gegenproben (Mutation): ein Thema entfernen → Vollständigkeit rot; eine Kennzahl zwei Themen
   zuordnen → „genau einem“ rot; eine Funktion aus `ANALYSIS_CATALOG` entfernen → `shot-core`-Test rot;
   ein Wort im Vault-Abschnitt ändern → Synchron-Test rot; gerades `"` in einen Text → Stil-Test rot;
   `wrapText` mit Breite 120 → Zeilen-Test rot.
3. `pnpm check` grün; `pnpm check --force` grün.

## 6. Verification

1. Gate (gecacht und ungecacht), Testzahlen, `vault-lint`.
2. Mutationsprobe wie in Test step 2, alle rot.
3. Spielwiese: `HELP`, `GLOSSARY` und die Einstiegstexte kommen aus einem `ShotHelp`-Bündel (IIFE wie
   `MeytonPdf`); jede Karte nutzt `helpTopic(id)`; Skriptprüfung: jede Karte hat ihre Erklärung, die
   Texte sind gleich denen im Paket; Sichtprüfung dunkel und 390 px.
4. Turbo: Eine Änderung am Leitfaden invalidiert den Cache von `shot-help#test` (oder der Task ist
   ungecacht, E7).
5. `git diff main` nur in `packages/shot-core` (Katalog), `packages/shot-help`, Vault, Plan und Lockfile
   (nur der neue Importer).
6. Abnahme laut Roadmap: Leseprobe durch den User, der die Statistik nicht im Detail kennt. Ergebnis und
   Änderungswünsche gehen in die Texte im Paket, die Doku wird neu erzeugt.
