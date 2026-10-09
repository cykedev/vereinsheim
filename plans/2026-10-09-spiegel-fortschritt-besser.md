# Plan — U2 Fortschritt beantwortet „Werde ich besser?“

Branch `feat/spiegel-fortschritt-besser`. Zweiter Schritt der Durchsicht vom 9. Oktober 2026
(`vault/spiegel/spiegel-durchsicht.md`, Befunde B3, B5, B6). Der User hat dazu entschieden:

- für eine Scheibe gilt überall ein Bezug, die fünf davor;
- Zehntel und ganze Ringe nur auf der Scheibe und als Einstellung des Geräts in Profil;
- Fachbegriffe nur im Blatt;
- Umsetzung in der Reihenfolge U1 bis U4.

## Kontext

Gemessen auf dem Telefon (390 × 844, Labor-Stand 9cc413a): Der Fortschritt ist 4,7 Bildschirme lang, mit 21
Bedienelementen auf dem ersten Bildschirm.

- **B3, Satz und Bezug:**
  - Der Satz oben spricht von der neuesten Scheibe („0,07 unter deinem Schnitt der 30 Tage davor“).
  - Die Ablesung daneben sagt „−0,06 zum Schnitt der 5 Scheiben davor“.
  - Die Karte „Gegen deinen Schnitt“ sagt noch einmal 30 Tage und dazu „Platz unter deinen letzten 50“.
  - Die Frage der Seite, „Werde ich besser?“, beantwortet nur, wer im Blatt einen Vergleich wählt.
- **B5, Bedienung vor dem Inhalt:**
  - vier Zeilen Filter: Zeitraum-Chip, Vergleich mit „ד, Familie, Art, „mit Training nur aus Probe“;
  - danach der Schalter Zehntel/Ganze Ringe, die Sprungleiste und zwei Schalter am Diagramm.
- **B6:** 25 Zeilen Rekorde, auch die außerhalb des Zeitraums.

## Entscheidungen

- **D1 Der Satz beantwortet „Werde ich besser?“.**
  - Ohne gewählten Vergleich vergleicht er den Zeitraum mit dem Zeitraum davor, gleich lang (wie die Zeile „Form“ auf
    Start).
  - Bei „Alles“ vergleicht er die letzten 90 Tage mit den 90 Tagen davor und sagt das.
  - Mit gewähltem Vergleich bleibt es dieser.
  - Wortlaut wie heute im Vergleich: „Dein Ø je Schuss liegt 0,15 höher als im Zeitraum davor; der Unterschied ist
    nachweisbar.“, bei „Alles“ mit „In den letzten 90 Tagen …“ davor.
  - Die Ergebnis-Box und der Verlauf zeigen den Vergleich weiter nur, wenn er gewählt ist. Der Satz rechnet ihn still
    (kein zweiter Verlauf im Diagramm).
  - Der Satz über die neueste Scheibe gegen 30 Tage entfällt.
- **D2 Ein Bezug für eine Scheibe, die fünf davor; die Karte „Gegen deinen Schnitt“ entfällt.**
  - Mit dem Bezug „fünf davor“ wiederholte sie die Ablesung „Neueste Scheibe“, die das schon sagt.
  - Mit ihr entfällt „Platz unter deinen letzten 50“, ein dritter Bezug (B3).
  - Das Thema „Gegen deinen Schnitt“ in `shot-help` beschreibt jetzt den Abstand zum Schnitt der fünf davor. Sein „?“
    steht an dieser Zeile der Ablesung.
  - Im Modell entfällt `ownAverage`; `againstOwnAverage` (C4) bleibt im Fachkern.
  - Der Katalog C4 bekommt einen Vermerk: Die Oberfläche nutzt seit U2 die fünf davor.
- **D3 Eine Zeile Bedienung: Familie sichtbar, alles Übrige hinter einem Chip.**
  - Der Chip des Zeitraums öffnet ein Blatt „Filter“ mit Zeitraum, Vergleich, Art und „Trainings nur aus Probe
    mitzählen“; alles gilt mit „Übernehmen“.
  - Auf dem Chip steht der Zeitraum und, was von der Vorgabe abweicht: „Letzte 90 Tage · Training · mit Zeitraum
    davor“; ohne Trainings nur aus Probe „· ohne Probe-Training“.
  - Der Chip „mit … ד und die Segmente „Art“ und „mit Training nur aus Probe“ im Kopf entfallen.
  - Die Liste behält ihre Filter bis U4.
- **D4 Kein Schalter Zehntel/Ganze Ringe im Fortschritt.**
  - Er zeigt die Wertung des Geräts.
  - Die Einstellung steht in Profil unter „Wertung“, neben der Darstellung.
  - Die Scheibe behält ihren Schalter; er schreibt weiter die Wertung des Geräts.
  - In der Adresse bleibt `scoring`: Sie sagt, was man sieht.
- **D5 Rekorde: zuerst die im Zeitraum, höchstens fünf; alle übrigen zugeklappt.**
  - Oben die Rekorde, deren Scheibe im Zeitraum liegt, in der Folge des Katalogs, höchstens fünf.
  - Darunter „Alle Rekorde (n)“ zugeklappt (`Disclosure`), mit allen Zeilen wie heute, auch „außerhalb“.
  - Ohne Rekord im Zeitraum steht oben „Im Zeitraum kein neuer Rekord.“
- **D6 Das Formband auf Start bekommt einen Rahmen** (User, 9. Oktober 2026: „es ist so ‚im leeren‘“).
  - Eine Spur über die ganze Achse: ein abgerundeter Kasten mit feiner Linie (`stroke-border`) und leicht
    abgesetzter Fläche (`fill-surface-2`), so hoch wie das Band mit etwas Luft.
  - Darin liegen Band, Schnitt und Punkte; die Beschriftungen bleiben darunter, „Abend“ darüber.
- **D7 Nicht im Umfang:** die Schalter am Diagramm (Kennzahl, je Scheibe/Monat) und der Wortlaut sonst (U3).

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/start/FormStrip.tsx` (+ Test) | Spur als Rahmen um Band und Punkte (D6) |
| `packages/shot-ui/src/period/model.ts` (+ Test) | `form` (Vergleich für den Satz), `ownAverage` entfällt |
| `packages/shot-ui/src/period/sentence.ts` (+ Test) | Satz aus `form` |
| `packages/shot-ui/src/period/PeriodPicker.tsx` (+ Test) | Blatt „Filter“ mit Art und Probe-Training, Zusammenfassung auf dem Chip |
| `packages/shot-ui/src/period/PeriodHeader.tsx` (+ Test) | `PeriodControls` in einer Zeile |
| `packages/shot-ui/src/controls/CardFilters.tsx` (+ Test) | „Art“ nur mit `onKind` |
| `packages/shot-ui/src/period/PeriodResult.tsx` | `scoring` optional |
| `packages/shot-ui/src/period/PeriodInsights.tsx` (+ `PeriodTiles.test.tsx`) | ohne „Gegen deinen Schnitt“, Rekorde gekürzt |
| `packages/shot-ui/src/period/CardReadout.tsx` (+ Test) | „?“ an der Zeile zum Schnitt (`onHelp`) |
| `packages/shot-help/src/topics.ts` (+ Test), `vault/spiegel/spiegel-statistics-help.md` (erzeugt) | Thema „Gegen deinen Schnitt“ für die fünf davor |
| `tools/labor/src/PeriodView.tsx`, `App.tsx`, `PlaceholderView.tsx`, `testHook.ts` | ohne Schalter, Filter-Blatt, Wertung in Profil |
| `tools/labor/pruefung.js` | Prüfungen umstellen, neue |
| `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md` | Doku |
| `vault/spiegel/spiegel-langzeit.md`, `spiegel-durchsicht.md`, `spiegel-statistics.md` | Doku, Vermerk an C4 |

## Required Docs

- `vault/conventions.md` (§10 Design 2)
- `packages/shot-ui/CLAUDE.md` (Seite eines Zeitraums, Zahl und Bezug, Rahmen und Links)
- `tools/labor/CLAUDE.md` (Eigenheiten der Skriptprüfung)
- `vault/spiegel/spiegel-langzeit.md` (Entscheidungen der Seite eines Zeitraums)

## Aufgaben

### Task 1: Vergleich für den Satz im Modell

- **`PeriodModel.form`:**
  ```ts
  { comparison: PeriodComparison | null; label: string; lastDays: number | null } | null
  ```
- **Gerechnet in `periodModel`:**
  - Ist ein Vergleich gewählt (`compareRange`), ist `form` dieser: `{ comparison, label: compareRange.label,
    lastDays: null }`.
  - Sonst bei `choice.type !== "all"`: dieselbe Rechnung wie für `comparison` mit `{ type: "previous" }`.
  - Bei „Alles“: Zeitraum `{ type: "rolling", days: 90 }` gegen den davor, `lastDays: 90`.
  - Gerechnet wird im Ø je Schuss (`SUMMARY_KEY`), mit Art und Probe-Training der Seite. Scheiben in beiden
    Zeiträumen zählen nur im gewählten, wie bei `comparison`.
  - Ohne Scheiben `null`.
- **`ownAverage` und `ownAverageOf` entfallen** samt `PERCENTILE_POOL`, auch im Typ.
- **Tests (`model.test.ts`, zuerst rot):**
  - 90 Tage ohne Vergleich: `form.comparison` gleich dem Vergleich mit `{ type: "previous" }`, Label „Zeitraum
    davor“.
  - Mit Vergleich ist `form` dieser.
  - „Alles“: `lastDays` 90, gerechnet über die letzten 90 Tage gegen die 90 davor (Handwerte aus `testSeason`).
  - Kein `ownAverage` mehr im Modell.

### Task 2: Der Satz

- **`periodSentence(model)`** nimmt `model.form`:
  - ohne `form`: `null`;
  - mit `lastDays`: Vorsatz „In den letzten 90 Tagen liegt dein Ø je Schuss …“ und „als in den 90 Tagen davor“;
  - sonst wie heute im Vergleich;
  - der Zweig „neueste Scheibe gegen 30 Tage“ entfällt.
- **Tests (`model.test.ts` bzw. `sentence`, zuerst rot):**
  - ohne gewählten Vergleich ein Satz zum Zeitraum davor;
  - „Alles“ mit „In den letzten 90 Tagen“;
  - zu wenige Scheiben: „Für einen Vergleich mit dem Zeitraum davor sind es zu wenige Scheiben.“;
  - kein Satz enthält „30 Tage“.

### Task 3: Blatt „Filter“

- **`PeriodPicker`:**
  - neue Eigenschaften `kind: CardKind` und `includeProbeOnly: boolean`;
  - `onApply({ choice, compare, kind, includeProbeOnly })`;
  - Titel des Blatts „Filter“;
  - nach „Vergleichen mit“ die Abschnitte „Art“ (Radios Alle, Training, Wettkampf aus `KIND_OPTIONS`) und ein
    Kontrollkästchen „Trainings nur aus Probe mitzählen“, beide als Entwurf bis „Übernehmen“.
- **Chip:** `filterSummary(range.label, { kind, compareLabel, includeProbeOnly })` als reine Funktion, exportiert:
  - „Letzte 90 Tage“;
  - „Letzte 90 Tage · Training“;
  - „Letzte 90 Tage · mit Zeitraum davor“;
  - „… · ohne Probe-Training“.
- **`PeriodControls`:**
  - nur noch `CardFilters` (Familie) und der Chip, in dieser Reihenfolge, eine Zeile mit `flex-wrap`;
  - `onApply` dispatcht `setChoice`, `setCompare`, `setKind`, `setIncludeProbeOnly` (nur, was sich ändert).
- **`CardFilters`:** „Art“ nur, wenn `onKind` gegeben ist (`kind` und `onKind` optional).
- **Tests:**
  - `filterSummary` (vier Fälle);
  - `PeriodHeader.test.tsx`: in `data-period-controls` die Familie und der Chip, keine Art, kein „ד, kein „mit
    Training“;
  - `CardFilters.test.tsx`: ohne `onKind` keine Art.

### Task 4: Kein Schalter für die Wertung im Fortschritt

- `PeriodResult.scoring` optional; ohne ihn kein leerer Platz. Test.

### Task 5: Analyse und Ablesung

- **`PeriodInsights`:**
  - die Karte „Gegen deinen Schnitt“ entfällt;
  - `model` braucht nur `records` und `cards`;
  - Rekorde:
    - `recordRows` geteilt in `inPeriod` (Scheibe im Zeitraum, höchstens fünf) und alle;
    - oben die Liste der im Zeitraum (`data-records-new`), ohne sie „Im Zeitraum kein neuer Rekord.“;
    - darunter `Disclosure` „Alle Rekorde (n)“ mit allen Zeilen (`data-records`, wie heute).
  - Die Karten stehen in einer Spalte, solange nur eine Karte da ist.
- **`CardReadout`:** `onHelp?: (id: string) => void`; neben der Zeile „… zum Schnitt der 5 Scheiben davor“ ein
  `HelpButton` (`helpId="gegen-den-schnitt"`).
- **`shot-help` Thema `gegen-den-schnitt`:**
  - Titel „Abstand zum Schnitt davor“;
  - Kurzsatz „Wie deine Scheibe zum Schnitt deiner fünf Scheiben davor passt.“;
  - `what`, `read`, `caution`, `minimum`, `formula` für die fünf davor (ohne sie selbst; die erste Scheibe hat
    keinen);
  - `catalog` bleibt `["C4"]`;
  - danach `pnpm --filter @vereinsheim/shot-help docs`.
- **Tests:**
  - `PeriodTiles.test.tsx` (Teil Analyse):
    - keine Karte `gegen-den-schnitt`;
    - Rekorde: im Zeitraum höchstens fünf vorn, die übrigen nur in „Alle Rekorde“;
    - ohne Rekord im Zeitraum der Satz.
  - `CardReadout`: das „?“ mit `gegen-den-schnitt`.
  - `topics.test.ts` bleibt bei fünf Themen des Zeitraums.

### Task 6: Labor

- **`PeriodView`:**
  - ohne `ScoringSwitch`;
  - `PeriodResult` ohne `scoring`;
  - `CardReadout` mit `onHelp`;
  - `PeriodControls` wie in Task 3.
- **`App`:**
  - `changeScoring(next)`: `store.set("scoring", next)` und `changePeriod({ type: "setScoring", scoring: next })`;
  - an `PlaceholderView` als `scoring`/`onScoring`.
- **`PlaceholderView` (Profil):** unter „Darstellung“ ein `Segmented` „Wertung“ (Zehntel, Ganze Ringe),
  `data-scoring-setting`.
- **`testHook`:** was die Prüfung für Satz und Rekorde braucht (`periodSentence` ist schon da).

### Task 7: Skriptprüfung

- **Umstellen:**
  - Prüfungen, die Art, „mit Training nur aus Probe“, den Chip „ד oder den Schalter der Wertung im Fortschritt
    bedienen, gehen über das Blatt „Filter“ (Helfer `applyFilters({ … })`: Chip, Blatt, Auswahl, „Übernehmen“)
    bzw. über Profil.
  - Der Satz wird gegen `periodSentence` gerechnet.
  - Rekorde: die Zahl der Zeilen in „Alle Rekorde“ wie bisher, oben die im Zeitraum.
- **Neu:**
  - Im Kopf eine Zeile Bedienung: Familie und Chip; am Telefon 390 px höchstens zwei Bedienelemente vor dem
    Ergebnis.
  - Der Satz ohne Vergleich spricht vom Zeitraum davor.
  - Profil „Wertung“ auf „Ganze Ringe“: der Fortschritt zeigt Ringe.
  - Das Blatt „Filter“ setzt Art und Probe-Training; der Chip fasst zusammen.
  - Keine Karte „Gegen deinen Schnitt“.
  - Das „?“ an der Ablesung öffnet „Abstand zum Schnitt davor“.
  - Länge des Fortschritts am Telefon 390 × 844 vorher und nachher messen und berichten.
- **Gegenproben:**
  - Satz mit dem alten Zweig: rot;
  - Rekorde ohne Begrenzung: rot;
  - Art wieder im Kopf: rot.

### Task 8: Rahmen um das Formband (Start)

- **`FormStrip`:** vor dem Band ein `<rect data-track>`:
  - von `x = PAD / 2` bis `width - PAD / 2`, `y = MID - BAND_HALF - 4`, Höhe `BAND_HALF * 2 + 8`, `rx = 12`;
  - `className="fill-surface-2 stroke-border"`.
- Das Band liegt darin wie bisher. Der Strich des Schnitts reicht bis an die Spur (`y1`/`y2` = Kante der Spur).
- **Test (`FormStrip.test.tsx`):**
  - die Spur steht vor dem Band und den Punkten, über die ganze Breite, nur mit Tokens;
  - ohne Band trotzdem da.
- **Sichtprüfung:** Start am Telefon und am Desktop, hell und dunkel.

### Task 9: Doku

- **`packages/shot-ui/CLAUDE.md`:**
  - Exporte: `PeriodPicker` als Blatt „Filter“, `filterSummary`;
  - `PeriodInsights` nur Rekorde;
  - `CardReadout` mit „?“;
  - Modell mit `form`, ohne `ownAverage`;
  - Regel „Seite eines Zeitraums“.
- **`tools/labor/CLAUDE.md`:** Wertung in Profil, Filter-Blatt.
- **Vault:**
  - `spiegel-langzeit.md`: Kopf, Satz, Filter, Analyse nach U2;
  - `spiegel-durchsicht.md`: U2 erledigt;
  - `spiegel-statistics.md`: Vermerk an C4 (Oberfläche nutzt die fünf davor seit U2);
  - `spiegel-navigation.md` (Abschnitt Start): Formband mit Rahmen.

## Teststeps

1. `pnpm --filter @vereinsheim/shot-ui test`, `pnpm --filter @vereinsheim/shot-help test`.
2. Labor direkt bauen, `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL.
3. `node .claude/vault-lint.mjs` gültig.
4. `pnpm check` grün vor jedem Commit.

## Verification

- `pnpm check` grün, `vault-lint` gültig, Labor direkt gebaut, `pruefen` 0 FAIL, Gegenproben je rot.
- Bildschirmfotos, unbeschnitten angesehen:
  - Telefon 390 im Rahmen: Kopf, Blatt „Filter“, Rekorde;
  - Desktop 1280 hell und dunkel.
- Messung wie in der Durchsicht: Bedienelemente auf dem ersten Bildschirm und Länge.
- Artifact neu veröffentlichen.
