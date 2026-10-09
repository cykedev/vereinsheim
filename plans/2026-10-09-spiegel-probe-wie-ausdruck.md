# Plan — U4 Probe wie am Ausdruck

Umsetzung **nach U3** (`plans/2026-10-09-spiegel-sprache.md`), auf einem eigenen Branch
`feat/spiegel-probe-wie-ausdruck` von `main`: U3 schreibt gerade dieselben Dateien um (Überblick, Beobachtungen,
Probe-Reiter); vorher entstünden Konflikte und gleich wieder gelöschte Texte. Der Plan wurde am 9. Oktober 2026 auf
`feat/spiegel-sprache` committet und nach `main` gemergt; vor dem Start gegen den Stand nach U3 abgleichen.

## Kontext

Entscheidung des Users vom 9. Oktober 2026 ([[adr-027]], Änderung „Entscheidung des Users zur Probe“; Leitregel 3 in
`vault/spiegel/spiegel-edge-cases.md`): Eine Scheibe in Spiegel ist der jüngste stabile Stand der Ablage, **wie am
Ausdruck**. Meyton löscht die Probe mit dem ersten Wertungsschuss (zweimal live, 48 von 48 Scheiben mit Wertung seit
September 2026, `vault/sources/src-ssmdb2-abend-2026-10-09.md`), und Spiegel sammelt sie nicht mehr. Damit gibt es
keine Scheibe mit Probe **und** Wertung. Der User: „es müsste in UI im Spiegel, bei den Serien, und in der Auswertung
sein, ggf. auch bei Filtern.“

Heute setzt die Oberfläche gemischte Scheiben voraus: Probe-Kachel und „Alle / Ohne Probe“ bei den Serien,
Grundauswahl „ohne Probe“, Reiter „Probe“ (S1–S4), Datenbasis „ohne Probe“, „P1, P2 …“ in Tabelle und Ablesung, Sätze
zu Probe gegen Wertung. Das alles fällt weg. Reine Probe-Trainings bleiben vollwertig.

## Entscheidungen

- **D1 — Eine Regel im Fachkern:** `asOnPrintout(shots)` in `packages/shot-core/src/metrics.ts` neben
  `probeOnlyAsMatch`: Hat die Karte einen Wertungsschuss, bleiben nur die Wertungsschüsse (eine Probe zwischen Wertung,
  SF-04, fällt ebenso weg, wie am Ausdruck); hat sie nur Probe, gilt `probeOnlyAsMatch` (Serien zu zehn); sonst
  unverändert. `probeOnlyAsMatch` bleibt als Baustein. Die Seite einer Scheibe (shot-ui `shots.ts`) und Zeiträume
  (`analysis/card-shots.ts`) rufen nur noch `asOnPrintout`.
- **D2 — In der Oberfläche gibt es danach keine Probe neben Wertung:** `SeriesKey` ist nur noch eine Seriennummer,
  `Whole` nur noch `"all"`; Probe-Kachel, „Ohne Probe“, `defaultWhole`, der Reiter „Probe“, die Datenbasis
  „ohne Probe“ und die „P“-Nummern fallen weg. Das Probe-Eck (`fromProbe`, Training nur Probe) bleibt.
- **D3 — Fachkern-Auswertung der Probe entfällt:** `analysis/sighters.ts` (S1–S4) samt Katalog-Einträgen, Hilfe-Themen
  (`probe-umfang`, `probe-gegen-wertung`, `eingeschossen`, Thema `sighters`) und Simulationsbeleg B21. Git hält die
  Geschichte; eine andere Quelle mit Probe neben Wertung (SP-4.4) bringt sie bei Bedarf zurück.
- **D4 — Bleibt:** Filter „Probe-Training einbeziehen“ im Zeitraum (`includeProbeOnly`, Verläufe und Rekorde),
  „Als Wertung zählen“ (SF-05, `FLAG_COUNTED_AS_MATCH`), die Datenlage „Training nur Probe“, die Robustheit des
  Fachkerns bei Probe zwischen Wertung (`stepsInOrder` mit Kontext, SF-04).
- **D5 — Labor wie am Ausdruck:** Die Beispielscheibe „40 Schuss mit Probe“ wird „40 Schuss“ ohne die neun Probeschüsse;
  „60 Probe“ bleibt.

## Required Docs

- `vault/decisions/adr-027.md` (Änderung „Entscheidung des Users zur Probe“)
- `vault/spiegel/spiegel-edge-cases.md` (Leitregeln 1 und 3, SF-01 bis SF-05, SF-72)
- `vault/spiegel/spiegel-ui-design.md`, `vault/spiegel/spiegel-durchsicht.md`, `vault/spiegel/spiegel-statistics.md`
- `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`, `packages/shot-help` (Erzeugung des Leitfadens)
- `vault/conventions.md` §9 (Markup-Tests ohne jsdom, Mutationsprobe), §10 (Design 2)

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/metrics.ts` (+ `metrics.test.ts`) | `asOnPrintout` (D1) |
| `packages/shot-core/src/analysis/card-shots.ts` (+ Test) | `asOnPrintout` statt `probeOnlyAsMatch` |
| `packages/shot-core/src/analysis/sighters.ts` (+ Test), `analysis/index.ts`, `analysis/catalog.ts` | löschen bzw. Einträge S1–S4 raus (D3) |
| `packages/shot-ui/src/shots.ts` (+ `shots.test.ts`) | `asOnPrintout` mit `fromProbe`; `defaultWhole`, Probe-Zweige in `seriesKeyOf`, `shotLabels` raus |
| `packages/shot-ui/src/types.ts`, `view-state.ts` (+ Tests) | `SeriesKey = number`, `Whole = "all"`, `isSelected` ohne `"match"` |
| `packages/shot-ui/src/series/SeriesStrip.tsx` (+ Test) | Probe-Kachel und „Ohne Probe“ raus |
| `packages/shot-ui/src/analysis/AnalysisPanel.tsx`, `input.ts`, `tabs/index.ts`, `tabs/SightersTab.tsx`, `charts/SighterChart.tsx` (+ Tests) | Reiter „Probe“ löschen, Datenbasis ohne „ohne Probe“ |
| `packages/shot-ui/src/analysis/overview.ts`, `observations.ts` (+ Tests) | Sätze zu Probe gegen Wertung raus |
| `packages/shot-ui/src/table/ShotTable.tsx`, `readout/*`, `target/TargetView.tsx`, `target/MiniTarget.tsx`, `layers.ts`, `geometry.ts` (+ Tests) | Probe-Zweige für gemischte Karten raus; Probe-Eck bleibt |
| `packages/shot-help/src/topics.ts`, `types.ts`, `markdown.ts`, `guide.ts` (+ Tests), `scripts/simulate.ts` | Themen und Thema `sighters`, B21 raus; Leitfaden neu erzeugen |
| `tools/labor/src/samples.ts`, `CardView.tsx`, `pruefung.js` (+ Tests) | D5; Prüfungen nachziehen |
| Vault: `spiegel-statistics.md`, `spiegel-statistics-help.md` (erzeugt), `spiegel-ui-design.md`, `spiegel-durchsicht.md`, `spiegel-edge-cases.md` | Doku |

## Aufgaben

1. **`asOnPrintout` (D1), Tests zuerst:** Karte mit 5 Probe und 40 Wertung → nur die 40 (Reihenfolge der Liste, alle
   Angaben unverändert); 3 Probe, 2 Wertung, 2 Probe, 2 Wertung (SF-04) → nur die 4 Wertungsschüsse; 60 Probe → 60
   Wertung in Serien 1–6 (wie `probeOnlyAsMatch`); nur Wertung → dieselbe Liste (`toBe`); leer → leer. Dann die
   Funktion; `card-shots.ts` darauf umstellen (Test: Karte mit Probe und Wertung zählt nur die Wertung).
2. **Seite einer Scheibe (shot-ui `shots.ts`):** `probeOnlyAsMatch` der Seite wird `asOnPrintout` (mit `fromProbe`
   bei nur Probe). `defaultWhole` und der Probe-Zweig in `seriesKeyOf`/`shotLabels` entfallen; Aufrufer im Labor
   (`CardView.tsx`) nachziehen. Tests: gemischte Eingabe ergibt nur Wertung, Etiketten „1“ bis „40“.
3. **Auswahl (`types.ts`, `view-state.ts`):** `SeriesKey = number`, `Whole = "all"`, Aktion `selectWhole` nur mit
   „Alle“, `home` entfällt bzw. ist immer „all“. Tests der Zustandsmaschine anpassen; ein Test, dass ein zweiter Tipp
   auf dieselbe Serie zu „Alle“ führt.
4. **Serien (`SeriesStrip.tsx`):** Probe-Kachel und „Ohne Probe“ entfernen. Markup-Test (`renderToStaticMarkup`): eine
   Karte aus 5 Probe und 40 Wertung nach `asOnPrintout` zeigt 4 Kacheln, kein `data-series="probe"`, keinen Knopf
   „Ohne Probe“; 60 Probe zeigt 6 Kacheln mit Probe-Eck.
5. **Auswertung:** Reiter „Probe“ (`tabs/index.ts`, `SightersTab.tsx`, `SighterChart.tsx` samt Tests) löschen;
   `AnalysisPanel` ohne Eintrag `sighters`, Datenbasis nur „alle Schüsse“ oder „nur Probe“ (Training); Datenlage wie
   bisher für nur Probe. `overview.ts`/`observations.ts`: Sätze und Kacheln, die Probe gegen Wertung stellen,
   entfernen (nach dem Stand von U3 benennen). Tests: Panel ohne Reiter „Probe“, keine Probe-Sätze bei gemischter
   Eingabe.
6. **Tabelle, Ablesung, Scheibe:** Probe-Zweige für gemischte Karten entfernen (`ShotTable`, `readout/*`,
   `TargetView`, `layers.ts`, `geometry.ts`); Probe-Eck in `MiniTarget` bleibt. Tests anpassen.
7. **Fachkern (D3):** `analysis/sighters.ts` und Test löschen, Export aus `analysis/index.ts`, Einträge S1–S4 aus
   `catalog.ts`; `pnpm --filter @vereinsheim/shot-core test`.
8. **Hilfe (D3):** Themen `probe-umfang`, `probe-gegen-wertung`, `eingeschossen` und das Thema `sighters` (`types.ts`,
   `markdown.ts`, `guide.ts`) entfernen; `simulate.ts` ohne B21; `pnpm --filter @vereinsheim/shot-help docs` und
   `simulate`; in `vault/spiegel/spiegel-statistics.md` die B21-Zeilen streichen und S1–S4 wie S5 als „entfernt (U4,
   Probe wie am Ausdruck)“ markieren.
9. **Labor (D5):** `samples.ts` „40 Schuss mit Probe“ → „40 Schuss“ ohne Probe (Hinweistext anpassen), Tests;
   `pruefung.js`: Prüfungen auf Reiter „Probe“, Probe-Kachel und „Ohne Probe“ umdrehen (müssen fehlen), neu: „60 Probe“
   zeigt Serien mit Probe-Eck; Labor bauen, `pruefen` 0 FAIL.
10. **Doku:** `spiegel-ui-design.md` (Serien, Auswertung), `spiegel-durchsicht.md` (U4 erledigt),
    `spiegel-edge-cases.md` (SF-02, SF-04: Oberfläche ohne Probe neben Wertung), `shot-ui/CLAUDE.md`,
    `shot-core/CLAUDE.md`; `node .claude/vault-lint.mjs`.

## Teststeps

1. Nach jeder Aufgabe `pnpm --filter <paket> test`; vor jedem Commit `pnpm check`.
2. Mutationsprobe zu Aufgabe 1: `asOnPrintout` gibt die Liste unverändert zurück → die Tests zu gemischten Karten
   werden rot (über Sicherungskopie zurücksetzen, nicht per `git checkout`).
3. `grep -rn "sighter" packages tools --include='*.ts' --include='*.tsx' --include='*.js'` ohne Treffer außerhalb von
   `node_modules`.
4. Labor bauen, `pnpm --filter @vereinsheim/labor pruefen` 0 FAIL.

## Verification

- Gates grün; Mutation rot.
- Bildschirmfotos der Scheibe „40 Schuss“ und „60 Probe“ (Telefon dunkel, Desktop hell): keine Probe-Kachel, kein
  „Ohne Probe“, kein Reiter „Probe“; „60 Probe“ mit Probe-Eck und Serien zu zehn.
- Zeitraum: „Probe-Training einbeziehen“ wirkt weiter (Rekorde und Verläufe mit und ohne reine Probe-Trainings).
- Leitfaden neu erzeugt, `spiegel-statistics.md` ohne B21, S1–S4 als entfernt markiert.
