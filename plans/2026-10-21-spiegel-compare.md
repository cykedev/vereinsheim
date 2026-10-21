# Spiegel: die Seite „Vergleichen“

Branch `feat/compare-page`. Plan 2 von 3 der Reihe aus [[spiegel-langzeit]] („Analyse über den Zeitraum“); Konzept in
[[spiegel-vergleichen]], Roadmap SP-2.2 (C2, C3) und SP-2.7 (W1). Plan 1 (Trefferbild und Lage) ist auf `main`, Plan 3
ist Überblick, Zeit und Ergebnis.

## Context

„Ist A anders als B?“ hat in Spiegel heute nur eine Form: „Vergleichen mit“ im Blatt „Filter“ des Fortschritts. Sie
verdoppelt dort jede Zahl (Wert, Vergleichswert, Δ, Urteil), legt eine zweite Kurve in den Verlauf und kann weder zwei
Scheiben noch Wettkampf und Training vergleichen. Der User will alle Vergleiche auf einer eigenen Seite, die nichts
Bestehendes verkompliziert. Die Bedienung soll „top“ sein und nicht dazugebaut wirken. Dabei ist [[adr-033]] immer
mitzudenken: Der Kern des Vergleichs gehört als reine Funktion in den Fachkern, damit das Tagebuch ihn später nutzen
kann.

Mit dem User am 21. Oktober 2026 entschieden, die Bilder an seinen echten Scheiben verglichen (Prototyp, wieder
entfernt):

- **Drei Arten** als Segment oben: „Zwei Scheiben · Zwei Zeiträume · Wettkampf und Training“. Beide Seiten sind immer
  von derselben Art.
- **Zwei Zeiträume und Wettkampf/Training** zeigen ein Bild mit zwei Umrissen (Variante Z2). Je Seite ist die Fläche
  der Hälfte der Schüsse durchgezogen (A getönt) und die von 9 von 10 gestrichelt, dazu beide Mitten.
- **Zwei Scheiben** zeigen beide Scheiben übereinander in zwei Farben (Variante S3), dazu beide Mitten.
- **Der Vergleich zieht aus dem Fortschritt um.** Der Satz „Werde ich besser?“ bleibt und führt auf die Seite.

## Approach

- **D1 Adresse `/compare`:** Das Routen-Modell kennt `/compare?a=<id>&b=<id>` schon (bisher ohne Seite). Die Seite
  zieht dort ein, nicht unter `/progress/compare` wie im Konzept vermerkt: Der Pfad ist schon im Modell, kürzer, und der
  Bereich ist trotzdem Fortschritt (`areaOf`). Die ganze Wahl steht in der Adresse, eine Erinnerung an die letzte Wahl
  gibt es nicht.
  - `type`: `cards` · `periods` (Vorgabe) · `kind`
  - Zwei Scheiben: `a`, `b` (Ids). Eine alte Adresse `/compare?a=…&b=…` ohne `type` gilt als zwei Scheiben.
  - Zwei Zeiträume: `family`, `a` (Zeitraum wie `range`, Vorgabe `90d`), `b` (Zeitraum oder `previous`, Vorgabe
    `previous`), `kind` (für beide Seiten), `sighters=0` wie im Fortschritt.
  - Wettkampf und Training: `family`, `range` (Vorgabe `12m`), `sighters=0`. A ist Wettkampf, B Training.
- **D2 Aufbau nach den drei Ebenen** ([[spiegel-durchsicht]]):
  1. Kopf: Titel „Vergleichen“ mit Rückweg, das Segment der Art, darunter in einer Zeile Familie, Chip A, Chip B und
     bei „Zwei Zeiträume“ die Art.
  2. Antwort: ein Satz über das Ergebnis je Schuss, ein zweiter über Streuung und Lage. Ein Urteil gibt es nur mit
     Test.
  3. Belege: das Bild, darunter drei Zeilen Ø je Schuss, Streuung und Lage (A, B, Urteil in Worten), darunter die
     Grundlage.
  4. Werkzeug: „Alle Kennzahlen“ eingeklappt, die Kacheln des Fortschritts (`PERIOD_TILE_KEYS`) für A und B.
- **D3 Chips und Blätter:** Ein Tippen auf A oder B öffnet ein Blatt.
  - **Scheiben:** eine Liste der Familie, die neueste zuerst. Jede Zeile zeigt Tag, Uhrzeit, Ø je Schuss und
    Schusszahl. Es stehen 30 Zeilen da, „Mehr zeigen“ lädt die nächsten 30.
  - **Zeitraum:** dieselben Felder wie im Blatt „Filter“ (rollend, benannt, frei). Sie werden aus `PeriodPicker` als
    `PeriodChoiceFields` herausgelöst, damit sie an einer Stelle stehen. B hat dazu „Zeitraum davor“.
  - Jede Wahl ist eine neue Adresse, und der Server rechnet neu (wie der Fortschritt).
- **D4 Einheit des Tests:** Zwei Scheiben zählen Schuss für Schuss, Gruppen Scheibe für Scheibe (C3). Ein Urteil gibt
  es ab 5 Einheiten je Seite.
  - **Ø je Schuss:**
    - Scheiben: Mann-Whitney über die Werte der Wertungsschüsse, in der Wertung der Familie.
    - Gruppen: `comparePeriods` über den Ø je Schuss jeder Scheibe.
  - **Streuung:** Der gezeigte Wert ist σ (`group.sigma`), wie im Fortschritt.
    - Scheiben: Mann-Whitney über die Abstände jedes Schusses zur Mitte seiner Scheibe.
    - Gruppen: `comparePeriods` über σ je Scheibe.
  - **Lage:** Hotelling-T² für zwei Stichproben, F(2, n₁ + n₂ − 3) geschlossen.
    - Scheiben: über die Lagen der Schüsse.
    - Gruppen: über die Mitten der Scheiben (`positionPoints`, Scheiben ab 3 Schuss mit Lage).
  - Jede Schwelle bestätigt eine Simulation (B26–B28), bevor ein Hilfetext eine Zahl nennt. Ein Fehlalarm über 6 % ist
    ein Circuit-Breaker: anhalten und mit dem User klären.
  - Scheiben, die in beiden Zeiträumen liegen, zählen nur in A, wie bisher im Fortschritt.
- **D5 Bild:**
  - **Umrisse,** wenn beide Seiten mindestens 50 Schuss mit Lage haben (`PATTERN_DENSITY_FROM`). Für jede Seite ein
    Dichteraster (`densityGrid`) auf einem gemeinsamen Ausschnitt; gezeichnet werden die Bänder für 50 % und 90 %
    (`HEAT_SHARES[3]`, `[1]`).
  - **Sonst Punkte:** jeder Schuss in der Farbe seiner Seite, bei zwei Scheiben also immer.
  - **Gemeinsames:** Die Scheibe zeichnet `TargetBoard` (Flächen unten, Ringe und Zahlen oben). Beide Mitten tragen
    `MpiMark` mit einem Ring in der Farbe der Seite und dem Buchstaben A oder B.
  - **Zum Browser** gehen zwei Raster mit 64 × 64 oder die Punkte auf 10 µm, nie die Schüsse selbst.
- **D6 Farben:** Zwei neue Tokens `--compare-a` (#3fb6ff, Blau) und `--compare-b` (#ff8a3d, Orange) in `:root`. Sie
  sind in beiden Darstellungen gleich wie die Scheibe, weil sie auf ihr stehen. Text bleibt in `foreground`, die Farbe
  steht nur in Punkten, Linien und Flächen. Linien und Buchstaben tragen einen dunklen Saum.
- **D7 Einstiege:**
  - **Seite einer Scheibe:** Ein Block über „Teilen“ mit dem Link „Mit der Scheibe davor vergleichen“ (A = diese,
    B = die Scheibe davor in der Familie). Es gibt ihn nur, wenn es eine davor gibt, und nur für den Besitzer.
  - **Fortschritt:** Unter dem Satz „Werde ich besser?“ steht „Genauer vergleichen“. Der Link führt mit Zeitraum,
    Familie, Art und Probe-Schalter auf `type=periods`. Bei „Alles“ sind es die letzten 90 Tage gegen die 90 davor,
    wie der Satz es rechnet.
  - **Start:** Die Zeile „Form der letzten 90 Tage“ öffnet heute den Fortschritt mit `compare=previous`. Künftig führt
    sie direkt auf die Seite mit genau diesem Paar (90 Tage gegen die 90 davor). Ohne Änderung würde sie über die
    Umleitung dort landen.
  - **Liste:** Die Auswahl in der Liste bleibt offen (SP-1.8) und kommt später.
- **D8 Umzug aus dem Fortschritt:**
  - **In Spiegel fällt weg:** „Vergleichen mit“ im Blatt „Filter“, die zweite Kurve und die Vergleichswerte in
    Ergebnis-Box und Kacheln.
  - **Geteilte Bausteine:** `PeriodPicker` und `PeriodControls` bekommen `withCompare` (Vorgabe `true`). Treffsicher
    nutzt den Vergleich weiter und bleibt unverändert.
  - **Alte Adressen:** Eine Adresse `/progress?…&compare=…` leitet der Server auf `/compare?type=periods&…` mit diesem
    Paar um. Ein benannter Vergleichszeitraum wird zu `b=<id>`.
- **D9 Vorbereitet für [[adr-033]]:** `compareSamples`, `compareCenters` und `compareShots` nehmen Werte und Punkte, nicht
  Spiegels Scheiben. Eine Trefferlage als Summe (Ausdruck) kann später als Mitte einer Scheibe in die Lage zählen, nie in
  das Bild. Die Grundlage nennt Scheiben ohne Lage.

Verworfen:
- **Vergleich auf der Seite einer Scheibe:** „Vergleichen mit: Scheibe davor · Beste“ macht die Seite voller.
- **Bilder nebeneinander (Z1, S1):** Man muss hin und her schauen, und am Telefon ist jedes Bild nur etwa 165 px breit.
- **A als Treffer und B als Umriss (Z3):** Die beiden Seiten wirken ungleich gewichtet.
- **Zwei Scheiben mit B als Ring (S2):** zu unruhig.
- **Eine Erinnerung an die letzte Wahl:** Die Adresse reicht.

## Texte (Entwurf fürs Textbuch, mit dem Plan freigegeben)

Regeln aus [[conventions]] §10: ein Gedanke je Satz, keine Semikolons, Alltagsworte, keine Pronomen für Personen.
Fachbegriffe („Mann-Whitney“, „Hotelling“, σ) stehen nur in den Formeln der Hilfe. „Unklar“ und „echt“ sind auf den
ersten beiden Ebenen verboten (`JARGON` in `pruefen.ts`).

Die Namen der Seiten im Satz (`side.at`):

| Seite | Chip | im Satz |
|---|---|---|
| Scheibe | Do 09.10., 362,4 | am 09.10. (zwei am selben Tag: am 09.10. um 19:42) |
| rollend | Letzte 90 Tage | in den letzten 90 Tagen |
| davor | Zeitraum davor | im Zeitraum davor |
| benannt | Vorbereitung LM | in „Vorbereitung LM“ |
| frei | 01.07. – 30.09.2026 | vom 01.07. bis 30.09.2026 |
| Alles | Alles | in allem |
| Art | Wettkampf · Training | im Wettkampf · im Training |

| Stelle | Text |
|---|---|
| Titel | Vergleichen |
| Rückweg | Zum Fortschritt · Zur Scheibe |
| Segment (Name „Was vergleichen“) | Zwei Scheiben · Zwei Zeiträume · Wettkampf und Training |
| Chip Art (Zwei Zeiträume) | Alle Arten · Training · Wettkampf |
| Blatt Scheibe | Titel „Scheibe A“ bzw. „Scheibe B“ · Knopf „Mehr zeigen“ |
| Blatt Zeitraum | Titel „Zeitraum A“ bzw. „Zeitraum B“ · Knopf „Übernehmen“ |
| Satz Ergebnis, klar | {A.at, groß} {Δ} Ringe je Schuss mehr als {B.at}. Das ist ein klarer Unterschied. (weniger) |
| Satz Ergebnis, ohne Urteil | {A.at, groß} {Δ} Ringe je Schuss mehr als {B.at}. Ein klarer Unterschied ist das nicht. |
| Satz Ergebnis, gleich | {A.at, groß} gleich viele Ringe je Schuss wie {B.at}. |
| Satz Ergebnis, zu wenig | Für einen Vergleich sind es zu wenige Scheiben. (bei zwei Scheiben: zu wenige Schüsse) |
| Satz Streuung und Lage, beide ohne Urteil | Streuung und Lage zeigen keinen klaren Unterschied. |
| Satz Streuung, klar | Die Streuung ist {A.at} klar kleiner. (größer) |
| Satz Lage, klar | Die Mitte lag {A.at} {1,1 mm} weiter {links oben}. |
| Zeilen | Ø je Schuss · Streuung · Lage |
| Zeile Lage, Wert | 1,1 mm auseinander |
| Urteil einer Zeile | Klar besser: {Name}. · Kein klarer Unterschied. · Zu wenige Scheiben. (Schüsse) · Lage: Klar versetzt: {A.at} weiter {links oben}. |
| Legende Umrisse | Durchgezogen: die Hälfte der Schüsse. Gestrichelt: 9 von 10. |
| Legende Punkte | Jeder Punkt ist ein Schuss. Der Ringwert steht in den Zahlen. |
| Grundlage Gruppen | A: 10 Scheiben, 298 Schuss. B: 8 Scheiben, 300 Schuss. · mit Rest: …, 2 ohne Lage. |
| Grundlage geteilt | 3 Scheiben liegen in beiden Zeiträumen. Sie zählen nur in A. |
| Grundlage Scheiben | Verglichen Schuss für Schuss: 40 gegen 40 Wertungsschüsse. |
| Werkzeug | Alle Kennzahlen |
| Bild fehlt | Für das Bild fehlen die Lagen der Schüsse. |
| Leer: Scheibe fehlt | Wähle zwei Scheiben. |
| Leer: dieselbe Scheibe | Wähle zwei verschiedene Scheiben. |
| Leer: verschiedene Familien | Die beiden Scheiben gehören zu verschiedenen Disziplinen. Wähle zwei aus einer. |
| Leer: Seite ohne Scheibe | {Name} hat keine Scheibe. Wähle einen anderen Zeitraum. · Art: In diesem Zeitraum gibt es keinen Wettkampf. (kein Training) |
| Seite einer Scheibe | Mit der Scheibe davor vergleichen |
| Fortschritt | Genauer vergleichen |

Hilfe (`@vereinsheim/shot-help`, neues Thema `compare`):

- **`vergleichen` (VIEW_HELP):** Was die Seite vergleicht, warum zwei Scheiben Schuss für Schuss und Zeiträume Scheibe
  für Scheibe zählen und was die Umrisse zeigen.
- **`scheibe-vergleich` (C2):** zwei Scheiben, die drei Tests, Fehlalarm und Trennschärfe aus B26 und B27.
- **`lage-vergleich`:** die Lage zweier Seiten, Hotelling für zwei Stichproben, B28.
- **`zeitraum-vergleich`** (gibt es schon) wechselt von `period` zu `compare` und nennt Wettkampf und Training.

Die Zahlen in den Texten kommen aus den Simulationen.

## Required Docs

- `packages/shot-core/CLAUDE.md` (Fachkern, `ANALYSIS_CATALOG`, reine Funktionen)
- `packages/shot-ui/CLAUDE.md` (Seite eines Zeitraums, Adressen, Markup-Tests, Zustand in der Adresse)
- `packages/shot-help/CLAUDE.md` (Themen, Belege, Leitfaden im Vault)
- `apps/spiegel/CLAUDE.md` (Seiten, Skriptprüfung, Messung)
- `vault/spiegel/spiegel-vergleichen.md`, `vault/spiegel/spiegel-langzeit.md`, `vault/spiegel/spiegel-navigation.md`
- `vault/spiegel/spiegel-statistics.md` (C2, C3, W1, „Ehrliche Zahlen“, „Belege aus Simulationen“)
- `vault/spiegel/spiegel-durchsicht.md` (drei Ebenen, Fachbegriffe)
- `vault/conventions.md` §2 (Hilfe, „–“ mit Grund), §6, §9 (Markup-Tests, Mutation), §10 (Texte, Tokens)

## Tasks

### T1 `shot-core`: `compareSamples` aus `comparePeriods` herauslösen

- In `packages/shot-core/src/analysis/period.ts` den Kern von `comparePeriods` als
  `compareSamples(a: readonly number[], b: readonly number[]): PeriodComparison | null` exportieren (Rechnung
  unverändert). `comparePeriods(a, b)` ruft ihn mit `a.map(v => v.value)`, `b.map(v => v.value)`.
- `ANALYSIS_CATALOG`: `compareSamples: ["C2", "C3", "T3"]`.
- Tests:
  - `period.test.ts` bleibt unverändert grün.
  - Neu: `compareSamples` mit Handwerten. 5 gegen 5 klar getrennte Werte ergeben `higher`. 4 gegen 9 ergeben `test`
    null und `unclear`. Gleiche Werte ergeben `unclear` und `meaningful` false.

### T2 `shot-core`: Lage zweier Stichproben (`compareCenters`)

- Neue Datei `packages/shot-core/src/analysis/compare.ts`:
  - `CenterComparison { a: { n: number; center: Point }; b: { n: number; center: Point }; shiftUm: Point
    (Mitte A − Mitte B); distanceUm: number; p: number | null; verdict: "shifted" | "none" | "few" }`
  - `compareCenters(a: readonly Point[], b: readonly Point[]): CenterComparison | null`
    - Ohne Punkte auf einer Seite null.
    - `few`, wenn eine Seite unter 5 Punkte hat (`MIN_PER_SIDE` = 5, wie `MIN_CARDS_PER_SIDE`) oder die gepoolte
      Kovarianz entartet ist (wie `confidenceOf`: det ≤ 1e−12 · sxx · syy).
    - Gepoolte Kovarianz S = ((n₁ − 1)S₁ + (n₂ − 1)S₂)/(n₁ + n₂ − 2).
    - T² = n₁n₂/(n₁ + n₂) · dᵀS⁻¹d und F = (n₁ + n₂ − 3)/(2(n₁ + n₂ − 2)) · T².
    - p = (1 + 2F/ν)^(−ν/2) mit ν = n₁ + n₂ − 3 (F(2, ν) geschlossen).
    - `shifted` bei p < 0,05.
  - `ANALYSIS_CATALOG`: `compareCenters: ["C2", "C3"]`.
- Tests in `compare.test.ts`:
  - Zwei identische Wolken (dieselben Punkte) ergeben p = 1 und `none`.
  - Eine Wolke aus 20 Punkten (fester Seed) gegen dieselbe, um 3 σ nach rechts verschoben, ergibt `shifted`, positives
    `shiftUm.xUm`, `distanceUm` ≈ 3σ ± 10 %.
  - 4 Punkte auf einer Seite ergeben `few`, alle Punkte auf einer Linie ergeben `few`.
  - Gegenprobe mit Handwerten: Für einen Fall mit diagonaler Kovarianz ist T² von Hand gerechnet.
  - Mutation: F ohne den Faktor (n₁ + n₂ − 3)/(2(n₁ + n₂ − 2)) muss einen Test rot machen.

### T3 `shot-core`: zwei Scheiben Schuss für Schuss (`compareShots`, C2)

- In `compare.ts`: `ShotComparison { result: PeriodComparison | null; spread: PeriodComparison | null; position:
  CenterComparison | null; shots: { a: number; b: number } }`.
- `compareShots(a: readonly MetricShot[], b: readonly MetricShot[], scoring: Scoring): ShotComparison`
  - Gezählt werden die Wertungsschüsse wie am Ausdruck (`asOnPrintout`).
  - **Wert:** `decimalTenths / 10` in Zehnteln, `ring` in ganzen Ringen. Ohne Wert zählt ein Schuss nicht.
  - **Ergebnis:** `compareSamples(bWerte, aWerte)`, damit `delta` = A − B und `higher` heißt „A höher“.
  - **Streuung:** Die Abstände der Schüsse mit Lage zur Mitte ihrer Scheibe gehen in `compareSamples(bAbstände,
    aAbstände)`. „Kleiner“ ist besser, das liest die Seite aus `group.sigma.better`.
  - **Lage:** `compareCenters(aLagen, bLagen)`.
- `ANALYSIS_CATALOG`: `compareShots: ["C2"]`.
- Tests:
  - Zwei gleiche Scheiben ergeben dreimal `unclear` bzw. `none`.
  - Eine Scheibe aus lauter 10,4 gegen lauter 9,0 ergibt `higher`, Δ = 1,4.
  - In ganzen Ringen zählt der Ring.
  - Probeschüsse zählen nicht, eine Scheibe nur aus Probe zählt wie am Ausdruck.
  - Schüsse ohne Lage zählen im Ergebnis, nicht in Streuung und Lage.

### T4 `shot-core`: das Bild zweier Seiten (`comparePicture`)

- In `compare.ts`:
  - `ComparePicture = { style: "outlines"; halfUm; a: { grid: DensityGrid; center: Point }; b: … } | { style: "dots";
    halfUm; a: { points: [number, number][]; center: Point | null }; b: … }`. Punkte stehen auf 10 µm, `|| 0` gegen
    −0 wie `cardMarks`.
  - `comparePicture(a: readonly Point[], b: readonly Point[]): ComparePicture`
    - **Umrisse,** wenn beide Seiten mindestens `PATTERN_DENSITY_FROM` Punkte haben. `halfUm` =
      `patternHalf([...a, ...b])`, beide Raster auf diesem Ausschnitt (`densityGrid`, relativ importiert wie in
      `pattern.ts`).
    - **Sonst Punkte** mit `halfUm` = max(1000, weitester Punkt beider Seiten · 1,15 + 500) wie der Stil `rings` von
      `periodPattern`.
    - Mitten auf ganze µm, ohne Punkte null.
  - Die Hilfen `densityGrid`, `patternHalf` und `PATTERN_DENSITY_FROM` bleiben, wo sie sind. `densityGrid` bleibt
    außerhalb von `./analysis`.
- `ANALYSIS_CATALOG`: `comparePicture: ["C2", "C3"]`.
- Tests:
  - 60 gegen 60 Punkte ergeben `outlines` mit zwei Rastern von 64 × 64.
  - 60 gegen 40 Punkte ergeben `dots`.
  - Eine leere Seite ergibt `dots` mit Mitte null.
  - Kein −0 in den Punkten (Roundtrip über JSON).

### T5 Simulationen B26–B28 und Statistik im Vault

- In `packages/shot-help/scripts/simulate.ts`, nach B25, mit 5.000 Läufen, LG und LP wie die bestehenden:
  - **B26 Ergebnis zweier Scheiben** (`compareShots().result`) bei 20, 40 und 60 Schuss je Scheibe:
    - Fehlalarm bei gleichem Schützen.
    - Erkannt, wenn B mit 1,25-fachem σ schießt.
  - **B27 Streuung zweier Scheiben** (Abstände zur Mitte):
    - Fehlalarm bei gleichem σ, auch bei länglicher Gruppe (a/b 2).
    - Erkannt bei 1,25- und 1,5-fachem σ.
  - **B28 Lage zweier Seiten** (`compareCenters`):
    - Schuss für Schuss (20, 40, 60 je Scheibe): Fehlalarm ohne Versatz, erkannt bei 0,5 σ Versatz.
    - Scheibe für Scheibe (5, 10, 20 Scheiben je Seite, Mitten aus `positionPoints`): Fehlalarm ohne Versatz, erkannt
      bei 0,3 σ Versatz.
- `pnpm --filter @vereinsheim/shot-help simulate` laufen lassen.
  - Die Zeilen kommen unter „Belege aus Simulationen“ in `vault/spiegel/spiegel-statistics.md`.
  - Die Zeilen C2 und C3 werden ergänzt: Tests, Einheit, Schwellen, Belege, Status „Fachkern (`compareShots`,
    `compareCenters`)“. W1 bekommt „Seite Vergleichen, Wettkampf und Training“.
- **Breaker:** Liegt ein Fehlalarm über 6 %, anhalten und dem User die Zahlen vorlegen.
- **Hinweis zum Autopilot:** `simulate.ts` nur mit Edit ändern und über `pnpm --filter … simulate` laufen lassen. Ein
  Bash-Befehl mit dem Pfad `…/scripts/…` trifft die Sperre für `scripts/` im `autopilot-guard`. Die Ausgabe gehört in
  den Scratchpad, nicht über den Pfad weiterverarbeiten.

### T6 Hilfe: Thema `compare`

- In `packages/shot-help/src/types.ts` kommt `"compare"` zu `HelpTheme`, im Leitfaden (`guide.ts`) ein Abschnitt
  „Vergleichen“.
- **Neue Themen** `scheibe-vergleich` (`catalog: ["C2"]`) und `lage-vergleich` (`catalog: ["C2", "C3"]`) mit `short`,
  `what`, `read`, `caution` (Zahlen aus B26–B28), `minimum` („Ab 5 Schuss je Scheibe.“ bzw. „Ab 5 Scheiben je Seite.“)
  und `formula`.
- **`zeitraum-vergleich`** bekommt `theme: "compare"` und einen Satz zu Wettkampf und Training.
  - Vorher prüfen, wo Treffsicher es nutzt (`apps/treffsicher/src/lib/help/statisticsTopics.ts`,
    `apps/treffsicher/src/lib/help/topics.test.ts`).
  - Hängt dort etwas am Thema statt an der Id: hier anhalten (Breaker Scope), nicht in Treffsicher umbauen.
- **VIEW_HELP** bekommt `vergleichen`.
- Danach `pnpm --filter @vereinsheim/shot-help docs`, damit `vault/spiegel/spiegel-statistics-help.md` neu entsteht.
- Tests: `topics.test.ts`, `style.test.ts`, `wording.test.ts` und `sync.test.ts` grün. Die Schreibregeln prüfen die
  neuen Texte mit.

### T7 `ui`: Tokens `compare-a`, `compare-b`

- In `packages/ui/design2.css` unter `:root` (bei `heat-*`): `--compare-a: #3fb6ff;` und `--compare-b: #ff8a3d;` mit
  dem Kommentar „Seiten A und B auf der Scheibe, in beiden Darstellungen gleich“. Kein Eintrag unter `.dark`, wie
  `heat-*`.
- `tokens.test.ts` ergänzen: Die beiden stehen in `:root` und fehlen absichtlich in `.dark`, wie Papier und Spiegel.

### T8 `shot-ui`: Adressen der Seite

- In `packages/shot-ui/src/nav/routes.ts`:
  - `CompareQuery` als Union:
    - `{ type: "cards"; a: string | null; b: string | null }`
    - `{ type: "periods"; family: string | null; a: PeriodChoice; b: PeriodChoice | "previous"; kind: CardKind;
      includeProbeOnly: boolean }`
    - `{ type: "kind"; family: string | null; range: PeriodChoice; includeProbeOnly: boolean }`
  - `DEFAULT_COMPARE` = Zwei Zeiträume, `a` 90 Tage, `b` `previous`, `kind` `all`, mit Probe.
  - `compareQueryFromParams` und `compareQueryToParams` nach D1. Vorgaben fallen weg, Ungültiges gilt als Vorgabe, eine
    alte Adresse mit `a` und `b` ohne `type` ergibt `cards`.
  - Die Route `compare` wird `{ page: "compare"; query: CompareQuery }`. `urlFromRoute` und `routeFromUrl` ziehen nach.
- In `nav/areas.ts`: `compare` → `"progress"`.
- In `nav/navigate.ts`:
  - `compareCards(a: string, b: string): Route`
  - `compareFromProgress(query: ProgressQuery, family: string): Route`. Bei `all` sind es `90d` gegen `previous`,
    sonst die Wahl gegen `previous`; Art und Probe gehen mit.
  - `compareFromLegacy(query: ProgressQuery, family: string): Route` für `compare=` (`previous` oder benannt als
    `{ type: "named", id }`).
- Tests (`routes.test.ts`, `areas.test.ts`, `navigate.test.ts`):
  - Hin- und Rückweg für jede Art.
  - Vorgaben fallen weg, Ungültiges wird zur Vorgabe.
  - Die alte Adresse ergibt `cards`.
  - `compareFromProgress` mit „Alles“.
  - `areaOf` ist `progress`.

### T9 `shot-ui`: Modell und Worte

- Neuer Ordner `packages/shot-ui/src/compare/`.
- **`model.ts`:**
  - `CompareSide { name: string; at: string; cards: number; shots: number; withoutPosition: number }`
  - `CompareRow { key: string; label: string; unit: MetricUnit; decimals: number; better: "higher" | "lower" |
    "none"; a: number | null; b: number | null; comparison: PeriodComparison | null }`
  - `CompareModel { type: CompareQuery["type"]; unit: "shot" | "card"; a: CompareSide; b: CompareSide; shared:
    number; result: CompareRow; spread: CompareRow; position: CenterComparison | null; metrics: CompareRow[];
    picture: ComparePicture; problem: string | null }`
  - `groupCompareModel({ a: PeriodItem[]; b: PeriodItem[]; aCards: PatternCard[]; bCards: PatternCard[]; scoring;
    includeProbeOnly; names })`
    - Ergebnis und Streuung über `itemValues` und `compareSamples(B, A)`.
    - Lage über `compareCenters(positionPoints(aCards) → Mitten, …)`.
    - Die Kennzahlen sind `PERIOD_TILE_KEYS`, das Bild ist `comparePicture` aller Punkte.
  - `cardCompareModel({ a: PeriodCard; b: PeriodCard; scoring; names })`
    - Ergebnis, Streuung und Lage aus `compareShots`. Die Werte der Zeilen sind `cardValues` je Scheibe (Ø je Schuss,
      σ).
    - Die Kennzahlen sind `PERIOD_TILE_KEYS` je Scheibe, ohne Urteil.
    - Das Bild ist `comparePicture` der Lagen der Wertungsschüsse.
  - `sideNames(…)`: Chip-Name und `at` nach der Tabelle oben. Die Tage formatiert `@vereinsheim/lib/format` mit der
    Zeitzone als Parameter.
- **`words.ts`:** `compareSentence(model): { lead: string; more: string | null }`, `rowVerdict(row, model)`,
  `positionVerdict(model)`, `basisText(model)`, `pictureLegend(style)`, `problemText(…)` mit genau den Texten oben.
  Die Zahlen formatiert `formatValue`, die Richtung `directionName`.
- **Tests (`model.test.ts`, `words.test.ts`):**
  - Jeder Satz der Texttabelle als erwarteter Wortlaut.
  - Δ = A − B (Gegenprobe: A und B getauscht, dann kippt das Vorzeichen).
  - Scheiben in beiden Zeiträumen zählen nur in A.
  - Unter 5 je Seite steht „zu wenige“.
  - Probe nur mit dem Schalter.
  - Kein Text verstößt gegen `forbiddenIn` (`@vereinsheim/lib/wording`). Mit dem Zusatz
    `/σ|Hotelling|Mann-Whitney|\b[Uu]nklar\b|\b[Ee]cht(e[nmrs]?)?\b/` sind auch die Fachbegriffe der ersten beiden
    Ebenen gesperrt, wie `JARGON` in `pruefen.ts`.

### T10 `shot-ui`: das Bild (`ComparePicture`)

- `packages/shot-ui/src/compare/ComparePicture.tsx`: SVG wie `PatternTarget`.
  - Die Scheibe kommt aus `TargetBoard`, `part="fills"` unten und `part="lines"` über den Umrissen bzw. Punkten.
  - **Umrisse:** B zuerst, A darüber.
    - Je Seite die 90-%-Fläche gestrichelt (`strokeDasharray` „6 4“).
    - Die 50-%-Fläche ist durchgezogen, bei A dazu mit 0,4 Deckkraft gefüllt.
    - Linien 2,5 px in `var(--compare-a|b)` auf einem 5 px breiten Saum `var(--shot-edge)`.
    - Die Pfade erzeugt `contourPath` mit `HEAT_SHARES`-Stufe 1 bzw. 3 aus `grid.levels`.
  - **Punkte:** B zuerst, dann A, je Punkt in Kalibergröße, Deckkraft 0,85, Rand `var(--shot-edge)`.
  - **Mitten:** `MpiMark`, dazu ein Ring in der Farbe der Seite und der Buchstabe A bzw. B mit Saum.
  - `aria-label` aus dem Satz, `data-compare-picture={style}`.
- **Markup-Tests** (`renderToStaticMarkup`):
  - Bei Umrissen vier Pfade, davon zwei gestrichelt.
  - Bei Punkten so viele Kreise wie Punkte, A nach B.
  - Ringe und Zahlen liegen nach den Seiten.
  - Ohne Mitte kein `MpiMark`.

### T11 `shot-ui`: Felder des Zeitraums herauslösen

- Aus `period/PeriodPicker.tsx` die Felder Zeitraum (rollend, benannt, frei mit Prüfung) als
  `PeriodChoiceFields({ value, onChange, named, timeZone, range, extra? })` herauslösen. `extra` nimmt die Wahl
  „Zeitraum davor“ für B auf.
- `PeriodPicker` nutzt sie und bekommt `withCompare = true`: ohne sie fehlt „Vergleichen mit“, und `onApply` gibt
  `compare: { type: "none" }`. `PeriodControls` reicht `withCompare` durch.
- Tests: `PeriodHeader.test.tsx` und die bestehenden Markup-Tests grün. Neu: Mit `withCompare={false}` fehlt die
  Legende „Vergleichen mit“.

### T12 `shot-ui`: Kopf, Blätter und Zeilen

- `compare/CompareControls.tsx`:
  - Das Segment der Art (`@vereinsheim/ui/design2/segmented` mit `wrap`) und `CardFilters` für die Familie (außer bei
    Zwei Scheiben).
  - Zwei Chips mit einem Punkt in `var(--compare-a|b)`, Name und Pfeil.
  - Bei Zwei Zeiträumen ein Chip der Art (Alle Arten · Training · Wettkampf).
  - Jede Änderung ruft `onQuery(next: CompareQuery)`.
- `compare/CardChoiceSheet.tsx`: `Sheet` mit `CardChoice[]` (`{ id; startedAtMs; value: number | null; shots:
  number }`), 30 Zeilen, „Mehr zeigen“. Die Scheibe der anderen Seite ist deaktiviert und trägt „auf der anderen
  Seite“.
- `compare/PeriodChoiceSheet.tsx`: `Sheet` mit `PeriodChoiceFields` und „Übernehmen“.
- `compare/CompareRows.tsx`: drei Zeilen (Name mit „?“, A, B, darunter das Urteil). Eine Zeile ohne Wert zeigt „–“
  mit Grund ([[conventions]] §2).
- `compare/CompareMetrics.tsx`: `<details>` „Alle Kennzahlen“ mit den Zeilen von `metrics`.
- Neue Exporte in `packages/shot-ui/package.json`.
- Markup-Tests:
  - Chips tragen ihren Namen.
  - Bei Zwei Scheiben fehlt die Familie.
  - Das Urteil steht unter der Zeile.
  - „–“ trägt seinen Grund.

### T13 Spiegel: Daten und Seite

- `apps/spiegel/src/lib/compare.ts`: `comparePageData(db, ownerId, query, context)`.
  - **Zwei Zeiträume und Art:** die Scheiben der Familie aus `overviewCards`/`fromProjection` (wie
    `progressPageData`), die Seiten mit `resolveRange` und `inRange`. A gewinnt geteilte Scheiben. Die Lagen kommen aus
    `patternCardsOf` über die Ids beider Seiten (höchstens 5.000 wie die Action), die Wertung der Familie aus
    `scoringOf`.
  - **Zwei Scheiben:** `cardWithShots` für a und b (nur eigene). Fehlt eine, sind sie gleich oder aus verschiedenen
    Familien, steht ein `problem` und es gibt kein Modell. Die Wertung ist die der Familie von A.
  - **Für das Blatt:** `choices: CardChoice[]` der Familie aus den Projektionen (`value` = Ø je Schuss in der Wertung
    der Familie).
  - **Rückgabe:** `{ model: CompareModel | null; problem: string | null; families; choices; targetId }`.
  - Ohne eigene Scheibe `null`, dann zeigt die Seite `NoCards`.
- `apps/spiegel/src/app/(app)/compare/page.tsx`: `requireSession`, `routeFromUrl("/compare", …)`, `pageContext`,
  `comparePageData`, dann `CompareScreen`. `metadata.title` ist „Vergleichen“.
- `apps/spiegel/src/components/compare/CompareScreen.tsx` (Client):
  - Rückweg (`RouteLink` mit `ArrowLeft`), Titel, `CompareControls`, Satz, `ComparePicture` mit Legende, `CompareRows`,
    Grundlage, `CompareMetrics`.
  - Eine Wahl wird über `router.push(urlFromRoute(...))` gesetzt, im Übergang (`useTransition`) mit leiser Deckkraft.
  - Das „?“ öffnet die Hilfe über `useHelp` (`vergleichen`, `scheibe-vergleich`, `zeitraum-vergleich`,
    `lage-vergleich`, Streuung `group.sigma`).
- Test `apps/spiegel/src/lib/compare.test.ts` nach dem Muster von `overview.test.ts`: `createTestSite`,
  `generateSeason`, `writeRevision`, Wettkampf und Training gemischt, eine Scheibe eines anderen Besitzers und eine im
  Papierkorb. Geprüft wird:
  - Zwei Zeiträume trennen richtig, geteilte Scheiben zählen in A.
  - Bei der Art ist A Wettkampf und B Training.
  - Fremde Scheiben und solche im Papierkorb fehlen.
  - Zwei Scheiben aus verschiedenen Familien geben `problem`.
  - Eine fremde Id gibt `problem`, nie fremde Daten.

### T14 Spiegel: Umzug aus dem Fortschritt

- `apps/spiegel/src/app/(app)/progress/page.tsx`: Wenn `route.query.compare.type !== "none"`, dann
  `redirect(urlFromRoute(compareFromLegacy(route.query, family)))`. Familie aus der Adresse, sonst die erste.
- `ProgressScreen.tsx`:
  - `PeriodControls` bekommt `withCompare={false}`.
  - `PeriodHeader` bekommt das neue `sentenceAction`, einen `RouteLink` „Genauer vergleichen“ auf
    `compareFromProgress(state, family)`.
- `packages/shot-ui/src/period/PeriodHeader.tsx`: optionales `sentenceAction?: ReactNode`, gerendert hinter dem Satz in
  derselben Zeile. Markup-Test dazu.
- `packages/shot-ui/src/start/model.ts` (`formOf`): Das Modell rechnet weiter mit `compare: previous`. `route` wird
  `compareFromProgress({ ...state, choice: { type: "rolling", days: 90 } }, family)` statt `progressRoute(state,
  null)`. Den Kommentar von `FormLine` und den Test in `start/model.test.ts` nachziehen (die Route führt auf
  `/compare?type=periods&family=…`).
- `apps/spiegel/src/lib/period-memory-cookie.test.ts` bleibt grün: Eine Adresse mit `compare=` übernimmt nie den
  gemerkten Zeitraum. Sie kommt aber nicht mehr bei `withRememberedChoice` an, weil die Seite vorher umleitet. Die
  Umleitung bekommt in `progress/page.tsx` deshalb Vorrang vor dem gemerkten Zeitraum.

### T15 Spiegel: Einstieg von der Scheibe

- `cards/[id]/page.tsx`: `previousInFamily` aus `ownerCards`/`listable` ist die neueste Scheibe derselben Familie mit
  Beginn vor dieser, sonst null. Sie geht an `CardScreen` als `own.previous`.
- `components/card/CompareWithPrevious.tsx`: ein ruhiger Block über `ShareCard` mit einem `RouteLink` auf
  `compareCards(card.id, previous)` (Icon `ArrowLeftRight`) und dem Text „Mit der Scheibe davor vergleichen“. Ohne
  Scheibe davor gibt es den Block nicht.
- `CardScreen.test.tsx`: Mit `previous` ist der Link da, ohne ihn fehlt er.

### T16 Skriptprüfung und Messung

- `apps/spiegel/tools/pruefen.ts`, neue Sektion `compare(page)`:
  - **Fortschritt:** „Genauer vergleichen“ führt auf `/compare?type=periods…`. Der Satz steht, das Bild ist
    `outlines` oder `dots`, drei Zeilen, „Alle Kennzahlen“ klappt auf.
  - **Alte Adresse:** `/progress?compare=previous` landet auf `/compare`.
  - **Wettkampf und Training:** Die Demo-Daten haben Wettkämpfe (`demoCardSeeds`). Das Bild und die drei Zeilen
    stehen.
  - **Zwei Scheiben:** über „Mit der Scheibe davor vergleichen“ von einer Scheibe. Das Bild ist `dots`. Das Blatt A
    öffnet, „Mehr zeigen“ lädt nach, eine Wahl ändert die Adresse.
  - **Blatt Zeitraum B:** „Letzte 30 Tage“ übernehmen, die Adresse trägt `b=30d`.
  - **Telefon:** kein seitliches Scrollen (`phoneNoSideScroll`), die Ziele sind mindestens 24 px groß.
  - **Fachbegriffe:** keine auf den ersten beiden Ebenen (`jargonIn`).
  - **Hilfe:** Jedes Thema mit `theme: "compare"` erscheint auf der Seite (wie `PERIOD_TOPICS`).
- In `language()` den Teil mit „Vergleichen mit“ entfernen, denn im Fortschritt gibt es den Vergleich nicht mehr.
  `PERIOD_TOPICS` ohne `zeitraum-vergleich` (Thema jetzt `compare`).
- `apps/spiegel/tools/measure.ts`: `comparePageData` für „Letzte 12 Monate gegen Zeitraum davor“ und für zwei
  Scheiben. Die Zeit und die Größe des Modells (JSON in Byte) gehen in die Ausgabe.
- Ablauf: `pnpm --filter spiegel seed:own --demo && pnpm --filter spiegel pruefen --start --alle; pnpm --filter
  spiegel seed:own` in **einem** Befehl, damit das eigene Konto danach wieder da ist (Memory „Demo seed restore“).

### T17 Vault und CLAUDE.md

- **`vault/spiegel/spiegel-vergleichen.md`:**
  - Status „gebaut“ und Adresse `/compare` nach D1.
  - Die Bilder (Umrisse ab 50 Schuss je Seite, sonst Punkte), die Tests je Einheit und die Einstiege.
  - Unter „Verworfen“ Z1, Z3 und S2.
  - Offen bleiben die Auswahl in der Liste, Ort und Merkmal sowie W2–W4.
- **`vault/spiegel/spiegel-navigation.md`:** Zeile `/compare` mit allen Schlüsseln. „Vergleichen mit“ und
  `compare=` sind jetzt eine Umleitung.
- **`vault/spiegel/spiegel-roadmap.md`:** SP-2.2 auf gebaut (C2, C3 auf eigener Seite), SP-2.7 mit W1.
- **`vault/spiegel/spiegel-langzeit.md`:** In der Tabelle „Offen“ ist Plan 2 erledigt.
- **`packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`, `apps/spiegel/CLAUDE.md`:** je eine Zeile zu
  `compare/`, `analysis/compare.ts` und der Seite.
- `node .claude/vault-lint.mjs` grün.

## Test steps (explizit)

1. `pnpm --filter @vereinsheim/shot-core test`: `compareSamples`, `compareCenters`, `compareShots` und
   `comparePicture` grün. Die Mutationen aus T2 und T3 machen je einen Test rot (danach aus der cp-Sicherung
   zurückholen, nicht `git checkout`).
2. `pnpm --filter @vereinsheim/shot-help simulate`: B26–B28 mit Fehlalarm höchstens 6 %.
3. `pnpm --filter @vereinsheim/shot-ui test`: Adressen, Modell, Worte und Markup grün.
4. `pnpm check` grün (lint, format, test, tsc, build für alle Apps, Treffsicher unverändert).
5. Im Browser (Dev, eigenes Konto, LP Freihand):
   - **Zwei Zeiträume:** „Letzte 6 Monate“ gegen „Zeitraum davor“. Die Umrisse stehen, die Zahlen stimmen mit den
     Kacheln des Fortschritts für dieselben Zeiträume überein.
   - **Zwei Scheiben:** 09.10. gegen 02.10. Die Punkte stimmen mit den Seiten beider Scheiben überein, ebenso Ø je
     Schuss und σ.
   - Hell und dunkel, Telefon (375 px) und Desktop.
6. `pnpm --filter spiegel seed:own --demo && pnpm --filter spiegel pruefen --start --alle; pnpm --filter spiegel
   seed:own`: alle Prüfungen grün, auch Wettkampf und Training.
7. `pnpm --filter spiegel measure`: Die Seite rechnet in derselben Größenordnung wie der Fortschritt, das Modell bleibt
   unter 100 KB.

## Verification

- Bericht `reports/2026-10-21-spiegel-compare.md` mit den Gates, den Simulationen, den Prüfungen und Screenshots aus
  dem Browser (Telefon und Desktop, hell und dunkel).
- **Nicht belegt** (Datenlage, [[conventions]] §9): Die Dev-Datenbank des Users hat keine Wettkämpfe. Wettkampf und
  Training ist nur an den Demo-Daten und durch Tests geprüft, das steht im Bericht. Scheiben ohne Lage gibt es noch
  nicht. Dieser Pfad ist nur durch Tests belegt.
- Keine neue Brücke nötig: Die Änderung betrifft nur die App und die Pakete.
- Die neuen Texte gehen nach dem Bau als Liste ins Textbuch, zur Abnahme durch den User.
