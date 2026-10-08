# Plan: Kacheln, Ablesung, Schusstabelle, Wertung, Visier und Hilfe (Schritt 2)

Branch `feat/spiegel-ui-reference` (Worktree, gestapelt auf Schritt 1). Bezug: Plan
`2026-10-08-spiegel-shot-ui-fundament.md` (Schritte 1–5), [[spiegel-ui-design]], [[adr-030]], Roadmap SP-1.8,
`@vereinsheim/shot-help` (SP-1.11).

## Kontext

Schritt 1 hat Scheibe, Serien, Zustand und das Labor gebaut (Artifact „Spiegel-Labor“). Die Spielwiese zeigt
um die Scheibe herum noch mehr, das in Schritt 2 echte Bausteine wird:

- **Kacheln „Trefferbild in Zahlen“** (Spielwiese `renderMetrics`, Zeilen 1069–1102): zehn Kennzahlen mit
  Wert, Einheit, Hinweis, „–“ mit Mindestzahl, Kurzsatz aus `helpForMetric`.
- **Ablesung** des angetippten oder letzten Schusses und die **Übersicht** der Scheibe (heute lokal im
  Labor, in der Spielwiese Zeilen 948–980).
- **Schusstabelle** (Zeilen 981–993): Nummer, Wert mit Farbpunkt, Innenzehner, Teiler, Intervall.
- **Wertung umschalten** mit Hinweis auf die amtliche Wertung ([[spiegel-ui-design]], „Ganze Ringe oder
  Zehntel, jederzeit“).
- **Visier verstellt** nach Probeschuss Pn (Spielwiese Version 13).
- **Hilfe an jeder Zahl** aus `shot-help`: „Was heißt das?“ mit Was, So liest du es, Was du tun kannst,
  Vorsicht, Mindestzahl und aufklappbarer Formel; ein Schalter „Erklärungen“ öffnet alle; an jeder Kachel ein
  „?“, das die Erklärung „auf dem Handy als Blatt von unten, auf dem Desktop als Karte daneben, nie nur als
  Tooltip“ zeigt ([[spiegel-ui-design]], „Hilfe und Erklärungen“).

## Entscheidungen

- **D1 Kacheln folgen der Auswahl** wie Streukreis und Schwerpunkt: Gerechnet wird über `groupShots` der
  Auswahl; der Kopf der Kacheln nennt sie („Serie 2“). Die Übersicht (Ergebnis, Zehner, Innenzehner, bester
  Teiler) bleibt die der ganzen Scheibe, weil sie das amtliche Ergebnis zeigt.
- **D2 Werte nur aus dem Fachkern:** `computeMetric(inScoring(metricByKey(key), scoring), shots)`; ein
  Hinweis „abhängig von der Schusszahl“ bei `nSensitive`; ohne Wert „–“ und „ab n Schuss“ aus `minShots`.
  Pausen im Hinweis zum Tempo über `tempo(timesWithGaps(…))`.
- **D3 Format ohne `Intl`:** `formatValue(value, decimals)` in `shot-ui` (feste Nachkommastellen, Komma,
  echtes Minus) und eine Tabelle der Einheiten je `metric.unit`, wie `formatScore` und `formatTotal`.
- **D4 Schusstabelle:** neueste Zeile oben wie in der Spielwiese, folgt der Auswahl (bei einer Serie nur ihre
  Zeilen), jede Zeile ist ein Knopf und wählt den Schuss (`aria-pressed`): Das ist der Weg per Tastatur und
  Screenreader, Treffer auf der Scheibe bleiben nur zum Antippen. Intervalle über `stepsInOrder` aus dem
  Fachkern: nach einer Lücke kein Intervall, über drei Minuten als Pause in Minuten.
- **D5 Wertung:** `ScoringSwitch` (Segment-Umschalter Zehntel/Ganze Ringe) mit Hinweis „amtlich: …“, wenn die
  amtliche Wertung bekannt ist (Prop); in der Ablesung steht die andere Wertung klein daneben.
- **D6 Visier:** `SightAdjust` mit Schaltern „nach P1 … P(n−1)“ wie in der Spielwiese Version 13; nur zwischen
  Probeschüssen, weil der Fachkern eine Verstellung nach dem letzten Probeschuss verwirft.
- **D7 Hilfe:** `HelpBody` (Felder und Formel aus `shot-help`), `HelpDetails` („Was heißt das?“, geöffnet,
  wenn der Schalter „Erklärungen“ an ist) und an jeder Kachel ein „?“-Knopf, der ein **Blatt** öffnet:
  `Sheet` als allgemeiner Design-2-Baustein in `@vereinsheim/ui/design2` auf dem nativen `<dialog>` (Fokus und
  Escape vom Browser), unter 768 px als Blatt von unten, darüber als Karte am rechten Rand. Texte nur aus dem
  Paket; einführende Texte, Glossar und Fehlschlüsse gehören zur Analyse (Schritt 3).
- **D8 Prüfhaken:** Mit `#pruefen` legt das Labor `window.__labor` an (Schüsse, Zustand, die nötigen
  Funktionen des Fachkerns), damit die Skriptprüfung jede angezeigte Zahl gegen den Fachkern nachrechnet wie
  in der Spielwiese. Ohne `#pruefen` gibt es den Haken nicht.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/format.ts` (+ Test) | `formatValue`, Einheiten, Vorzeichen |
| `packages/shot-ui/src/metrics/MetricTiles.tsx` (+ Test) | Kacheln nach D1–D3 |
| `packages/shot-ui/src/readout/ShotReadout.tsx`, `CardSummary.tsx` (+ Tests) | Ablesung und Übersicht (aus dem Labor) |
| `packages/shot-ui/src/table/ShotTable.tsx` (+ Test) | Schusstabelle nach D4 |
| `packages/shot-ui/src/controls/ScoringSwitch.tsx`, `SightAdjust.tsx` (+ Tests) | D5, D6 |
| `packages/shot-ui/src/help/HelpBody.tsx`, `HelpDetails.tsx`, `HelpButton.tsx` (+ Tests) | D7 |
| `packages/ui/src/design2/sheet.tsx` (+ Test), `packages/ui/package.json` | Blatt auf `<dialog>` |
| `packages/shot-ui/package.json`, `CLAUDE.md` | Exporte, Regeln |
| `tools/labor/src/App.tsx`, `src/testHook.ts`, `pruefung.js` | Verdrahtung, Prüfhaken, Prüfungen |
| `vault/spiegel/spiegel-ui-design.md`, `vault/spiegel/spiegel-roadmap.md` | Kacheln, Tabelle, Hilfe-Blatt; Stand SP-1.8 |

## Required Docs

`vault/conventions.md` (§2 Komponenten-Kanon, §3, §6, §10), [[spiegel-ui-design]], `packages/shot-ui/CLAUDE.md`,
`packages/shot-help/CLAUDE.md`, `packages/shot-core/CLAUDE.md` (Abgabefolge, `stepsInOrder`),
`tools/labor/CLAUDE.md`, Spielwiese `tools/spielwiese/template.html` Zeilen 948–1102 und 1166–1213,
`tools/spielwiese/harness.js` (Prüfungen zu Kacheln, Tabelle und Hilfe).

## Tasks

1. **Format (test-first).** `formatValue(1.234, 2)` → „1,23“, `formatValue(-0.5, 1)` → „−0,5“, Einheiten
   „Ringe“, „mm“, „s“, „%“ (Prozent aus Anteil: 0,25 → „25“), Teiler ohne Einheit.
2. **Kacheln (test-first).** `MetricTiles({ shots, state, keys })` mit den zehn Schlüsseln der Spielwiese;
   Tests: Werte gleich `computeMetric` über die Gruppe der Auswahl, „–“ mit „ab n Schuss“, Hinweis bei
   `nSensitive`, Kurzsatz als `title`, „?“ je Kachel, Kopf nennt die Auswahl.
3. **Ablesung und Übersicht (test-first).** `ShotReadout({ shots, state })` (angetippt oder letzter, Wert in
   Ringwert-Farbe, andere Wertung klein, Innenzehner, Teiler, Abstand, x/y) und `CardSummary({ shots, state })`;
   das Labor nutzt sie statt eigenem Code.
4. **Schusstabelle (test-first).** Zeilen, Reihenfolge, Auswahl, Intervalle mit Lücke und Pause, `aria-pressed`
   beim gewählten Schuss, Klick wählt.
5. **Wertung und Visier (test-first).** `ScoringSwitch` mit Hinweis, `SightAdjust` mit P1…P(n−1), nur bei
   mindestens zwei Probeschüssen.
6. **Hilfe (test-first).** `Sheet` (`<dialog>`, `aria-labelledby`, Schließen-Knopf, Blatt unten/Karte rechts per
   Klassen), `HelpBody`, `HelpDetails`, `HelpButton`; Tests: Felder in der Reihenfolge des Pakets, Formel
   zugeklappt, Texte gleich denen in `shot-help`.
7. **Labor.** Aufbau wie die Spielwiese: links Scheibe, rechts Ablesung, Wertung, Serien, Visier und
   Schusstabelle; darunter „Trefferbild in Zahlen“ mit Schalter „Erklärungen“; „Trefferbild“-Hilfe unter den
   Schaltern der Scheibe. Prüfhaken nach D8.
8. **Skriptprüfung.** Aus der Spielwiese übernehmen: Kacheln gegen den Fachkern, Kurzsätze aus `helpForMetric`,
   Tabelle (Zeilen, Intervalle, Pause), Wertung schaltet alle Werte, Visier stricheln, Hilfe öffnet alle; neu:
   Kacheln folgen der Auswahl, Tabelle wählt den Schuss per Klick und Tastatur (Enter), Blatt öffnet und
   schließt (Escape, Fokus zurück), Handy: Blatt von unten, kein seitliches Scrollen.
9. **Doku.** [[spiegel-ui-design]] (Kacheln folgen der Auswahl, Tabelle als Weg per Tastatur, Hilfe-Blatt),
   Roadmap SP-1.8 Stand, Scope-Notizen.

## Test steps

- `pnpm check` grün; Gegenproben: Kacheln über die ganze Scheibe statt die Auswahl → Kachel-Test rot; Tabelle
  ignoriert die Auswahl → Tabellen-Test rot; Hilfetext nicht aus dem Paket → Hilfe-Test rot; Intervall über
  eine Lücke → Tabellen-Test rot.
- `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL.
- Sichtprüfung im Browser-Pane: Desktop und 375 px, dunkel und hell; Blatt auf dem Handy.

## Verification

Bericht `reports/2026-10-08-spiegel-shot-ui-kacheln.md`; Labor neu veröffentlichen (gleiche Adresse); Review
über Schritt 1 und 2; Merge nach `main` mit OK, sobald die parallele Session fertig ist.
