# Spiegel: Trefferbild und Lage über den Zeitraum

Branch `feat/period-pattern`. Plan 1 von 3 der Reihe aus [[spiegel-langzeit]] („Analyse über den Zeitraum“, Konzept
vom 21. Oktober 2026); Roadmap SP-2.7 (L9, L10, L7). Plan 2 ist die Seite „Vergleichen“ ([[spiegel-vergleichen]]),
Plan 3 Überblick, Zeit und Ergebnis.

## Context

Der Fortschritt beantwortet „Werde ich besser?“ mit dem Verlauf. „Wo verliere ich Ringe?“ und „Wie eng schieße ich
wirklich?“ kann er nicht beantworten: Es gibt kein Bild der Schüsse über viele Scheiben, und die Analyse hat nur
„Rekorde“. Auf der Seite einer Scheibe ist die Scheibe der Held. Über einen Zeitraum soll das Trefferbild an derselben
Stelle stehen wie der Verlauf, als zweites Hauptbild und nicht als weitere Karte. So bleibt die Seite kurz
([[spiegel-durchsicht]]: Antwort, Belege, Werkzeug).

Der User legt Wert darauf, dass nichts „dazugebaut“ wirkt. Deshalb gilt: ein Umschalter statt eines neuen Abschnitts,
ein Satz als Antwort unter dem Bild, die Belege in drei Reitern, Fachbegriffe nur in den Karten der Reiter und im Blatt
„?“.

Die Lagen jedes Schusses liegen schon in der Projektion (`CardProjection.marks`, 10 µm, wie am Ausdruck, ohne
verdächtige Schüsse). Für das Bild braucht es also keine Schüsse aus der Datenbank, nur diese Lagen.

## Approach

- **D1 Hauptbild umschaltbar:** Über dem Verlauf steht `Verlauf | Trefferbild` als Segment-Umschalter. Er ist der
  erste in der Karte, „?“ rechts daneben. Die Wahl steht in der Adresse (`show=target`, Vorgabe Verlauf), denn sie
  bestimmt, *was* man sieht. Die Sprungleiste heißt dann „Trefferbild“ statt „Verlauf“ (gleicher Anker `#history`).
- **D2 Zwei Sichten:** „Form“ (jede Scheibe um ihre eigene Mitte geschoben) und „Lage“ (wo die Schüsse lagen).
  Vorgabe ist Form. Das ist eine Frage der Darstellung und steht nicht in der Adresse.
- **D3 Punkte oder Dichte:** Unter 300 Schuss jeder Schuss als kleiner Punkt, ab 300 die Dichte als zwei Flächen
  (die Hälfte und neun von zehn der Schüsse). Beide Sichten sind um die Mitte der Scheibe zentriert, die Ringe stehen
  dahinter, der Ausschnitt umfasst 99 % der Schüsse.
- **D4 Antwort als Satz unter dem Bild:** in Form ein Urteil über die gepoolte Form (L9), in Lage eines über die
  Schwerpunkte der Scheiben (L10). Ohne genug Daten steht, was fehlt. Darunter die Grundlage in einer Zeile.
- **D5 Rechnen auf dem Server, erst bei Bedarf:** Eine Server-Action rechnet das Muster aus den gespeicherten Lagen
  (`marks`) der Scheiben des Zeitraums. Der Browser ruft sie erst, wenn das Trefferbild gezeigt oder ein Reiter
  „Präzision“ oder „Lage“ geöffnet wird. Er bekommt ein Raster von 64 × 64 und die Schwerpunkte je Scheibe, keine
  Schüsse. Das erste Laden des Fortschritts bleibt so leicht wie heute.
- **D6 Reiter der Analyse:** „Ergebnis“ (die heutigen Rekorde), „Präzision“ (Form über mehrere Scheiben, L9), „Lage“
  (Lage über Zeit, L10; Ausreißerrichtung, L7). Überblick und Zeit kommen mit Plan 3. Die Reiter folgen der Ordnung
  der Scheibe und haben Anker (`#result`, `#precision`, `#position`). Treffsicher behält `PeriodInsights` unverändert.
- **D7 Tests der Urteile, Einheit klar:**
  - L9 Form: gepoolte Kovarianz über die Abweichungen jeder Scheibe von ihrer Mitte (Scheiben ab 3 Schuss mit Lage).
    Sphärizitätstest nach Mauchly für 2 × 2: W = det S / (tr S / 2)², p = W^((ν − 1)/2) mit ν = Σ(nᵢ − 1)
    (χ² mit 2 Freiheitsgraden, geschlossen). „Länglich“, wenn p < 0,05 **und** a/b ≥ 1,15, ab 100 Schuss aus 5
    Scheiben. Sonst „keine klare Richtung“.
  - L10 Lage: Hotelling-T² über die Schwerpunkte der Scheiben (Einheit die Scheibe, wie C3), ab 5 Scheiben mit
    mindestens 3 Schuss mit Lage. „Versetzt“ mit Richtung und mittlerem Abstand, sonst „passt“.
  - L7 Ausreißerrichtung: je Scheibe ab 10 Schuss mit Lage die weitesten k = max(1, round(n/10)) Schüsse, gemessen
    von der eigenen Mitte; ihre Richtung von dort. Rayleigh-Test auf eine Vorzugsrichtung (Näherung nach Zar), ab 30
    solchen Schüssen, p < 0,05. Damit misst L7 das Ausreißen aus der Gruppe, nicht den Versatz der Gruppe (der ist L10).
    Der Katalog sagt bisher „die schwächsten 10 % relativ zu m“ und wird entsprechend genauer gefasst.
  - Jede Schwelle bestätigt eine Simulation (B22–B24), bevor ein Hilfetext eine Zahl nennt. Liegt ein Fehlalarm über
    6 %, ist das ein Circuit-Breaker: anhalten und mit dem User die Schwelle klären.
- **D8 Vorbereitet für ADR-033:** Die Funktionen nehmen je Scheibe Lagen oder (für L10) nur einen Schwerpunkt mit n.
  Eine künftige Scheibe vom Ausdruck mit Trefferlage als Summe kann so in L10 zählen, nie in L9 oder L7. Die
  Grundlage nennt Scheiben ohne Lage.
- **D9 Weg von der Scheibe:** Die Karten „Form der Gruppe“ (Reiter Präzision) und „Richtungsuhr“ (Reiter Lage) der
  Seite einer Scheibe bekommen den Link „Über alle Scheiben im Fortschritt ›“, wie σ heute (`sigmaRoute`).

Verworfen: das Trefferbild als Karte im Reiter Präzision (eine Karte mehr, das Bild zu klein); alle Lagen an den
Browser schicken (bis 1 MB bei „Alles“); die Dichte im Browser rechnen (43.000 Punkte, langsam auf dem Telefon).

## Texte (Entwurf fürs Textbuch, mit dem Plan freigegeben)

Regeln aus [[conventions]] §10: ein Gedanke je Satz, keine Semikolons, Alltagsworte. Fachbegriffe (σ, „Mauchly“,
„Rayleigh“, „Hotelling“) nur in den Formeln der Hilfe.

| Stelle | Text |
|---|---|
| Umschalter Hauptbild (Name „Hauptbild“) | Verlauf · Trefferbild |
| Umschalter Sicht (Name „Sicht“) | Form · Lage |
| Erklärzeile Form | Jede Scheibe ist auf ihre eigene Mitte geschoben. So siehst du nur die Streuung. |
| Erklärzeile Lage | Die Schüsse liegen, wo sie lagen. |
| Legende Dichte | Innen liegt die Hälfte deiner Schüsse, außen neun von zehn. |
| Legende Punkte | Jeder Punkt ist ein Schuss. |
| Laden | Trefferbild wird gerechnet … |
| Fehler | Das Trefferbild ließ sich nicht laden. · Knopf „Noch einmal“ |
| Form, länglich | Deine Gruppe ist länglich, eher waagrecht. (eher senkrecht · schräg nach rechts oben · schräg nach rechts unten) |
| Form, ohne Urteil | Deine Gruppe zieht in keine klare Richtung. |
| Form, zu wenig | Für ein Urteil über die Form fehlen noch Schüsse. Es braucht 100 Schuss aus 5 Scheiben. |
| Lage, versetzt | Deine Lage ist versetzt: rechts tief, im Mittel 0,4 mm. |
| Lage, passt | Deine Lage passt. Ein Versatz zeigt sich nicht. |
| Lage, zu wenig | Für ein Urteil über die Lage fehlen noch Scheiben. Es braucht 5 Scheiben mit Lage. |
| Grundlage | Über 1.240 Schuss aus 31 Scheiben. · mit Rest: Über 1.240 Schuss aus 31 Scheiben, 7 ohne Lage. |
| Reiter | Ergebnis · Präzision · Lage |
| Karte Präzision | Form über mehrere Scheiben · Zeilen „Form“, „Länge zu Breite“ („1,28 : 1“), „Streuung σ“ („1,52 mm“) · Notiz: Gerechnet über 1.240 Schuss aus 31 Scheiben, jede um ihre eigene Mitte. |
| Karte Lage über Zeit | Notiz: Jeder Punkt ist die Mitte einer Scheibe. Größere Punkte haben mehr Schüsse. Die Linie folgt der Zeit. |
| Karte Ausreißerrichtung, Urteil | Deine Ausreißer gehen meist nach links unten. · ohne Urteil: Deine Ausreißer gehen in alle Richtungen. |
| Karte Ausreißerrichtung, Notiz | Gezählt ist je Scheibe das weiteste Zehntel der Schüsse, gemessen von der Mitte der Scheibe. · unter 30: Unter 30 Ausreißern ist die Uhr ein Bild, kein Befund. |
| Link auf der Scheibe | Über alle Scheiben im Fortschritt › |

Die Richtungswörter kommen aus `directionName` (`shot-ui/format`), die Form-Wörter aus einer Funktion `shapeWords`
(T13). Zahlen über `formatValue`, Tausender über `formatInteger`.

## Required Docs

- `packages/shot-ui/CLAUDE.md` (Seite eines Zeitraums, Karten und Diagramme der Analyse, Lineal, Zustand in der Adresse)
- `packages/shot-core/CLAUDE.md` (Fachkern, `ANALYSIS_CATALOG`, reine Funktionen)
- `packages/shot-help/CLAUDE.md` (Themen, Belege, Leitfaden im Vault)
- `apps/spiegel/CLAUDE.md` (Server-Actions, Skriptprüfung, Messung)
- `vault/spiegel/spiegel-langzeit.md` („Analyse über den Zeitraum“, „Langzeit-Trefferbild“)
- `vault/spiegel/spiegel-statistics.md` (L7, L9, L10, „Ehrliche Zahlen“, „Belege aus Simulationen“)
- `vault/spiegel/spiegel-durchsicht.md` (drei Ebenen, Fachbegriffe)
- `vault/conventions.md` §6 (ActionResult), §9 (Markup-Tests, Mutation), §10 (Texte, Tokens)

## Tasks

### T1 `shot-core`: Hotelling über Punkte herauslösen

- In `packages/shot-core/src/analysis/position.ts` den Kern von `mpiConfidence` als nicht exportierte Funktion
  `confidenceOf(points: readonly Point[])` herauslösen (Kovarianz, T², kritischer Wert, Ellipse). `mpiConfidence`
  ruft sie mit `positioned(shots)`. Exportiert wird sie über `./analysis` nicht (sonst verlangt `ANALYSIS_CATALOG`
  einen Eintrag); `pattern.ts` (T3) importiert sie relativ.
- Tests: `position.test.ts` bleibt unverändert grün.

### T2 `shot-core`: Typen und Raster

- Neue Datei `packages/shot-core/src/analysis/pattern.ts`:
  - `PatternCard { id: string; atMs: number; points: readonly Point[] }` (Lagen in µm, wie gezeichnet).
  - `densityGrid(points: readonly Point[], halfUm: number, size = 64): { cells: number[]; inner: number; outer: number }`:
    Punkte in Zellen eines Quadrats um (0, 0) mit Kantenlänge 2 · `halfUm` zählen (Zeile 0 oben, also größtes y),
    dann trennbar mit einem Gauß-Kern glätten. Bandbreite nach Silverman für 2-D: h = σ̂ · n^(−1/6) mit
    σ̂ = √((s²ₓ + s²ᵧ)/2), in Zellen umgerechnet, mindestens 0,75 Zellen. Die Zellen werden auf 0–255 relativ zum
    größten Wert gerundet. `inner` und `outer` sind die Schwellen, oberhalb derer 50 % bzw. 90 % der geglätteten Masse
    liegen (Zellen absteigend sortieren und kumulieren), im selben Maßstab 0–255.
  - `patternHalf(points: readonly Point[]): number`: 99. Perzentil der Abstände zur Mitte der Scheibe · 1,15, mindestens
    1 mm.
- Tests in `pattern.test.ts` mit Handwerten:
  - ein Punkt in der Mitte, `size` 5: die mittlere Zelle ist 255, das Raster ist symmetrisch;
  - 2.000 Punkte einer festen Normalverteilung (Seed wie in `simulate.ts`): Der Anteil der Punkte in Zellen über
    `inner` liegt zwischen 0,45 und 0,55, über `outer` zwischen 0,86 und 0,94;
  - `patternHalf` von Punkten auf einem Kreis mit 2 mm Radius: 2,3 mm.

### T3 `shot-core`: Form über mehrere Scheiben (L9)

- `periodShape(cards: readonly PatternCard[]): PeriodShape | null` in `pattern.ts`:
  - Scheiben ab 3 Punkten; je Scheibe die Abweichungen von ihrer Mitte; gepoolte Kovarianz S = Σ Abweichungen ⊗ /
    ν mit ν = Σ(nᵢ − 1).
  - `PeriodShape { shots; cards; sigmaUm (= √((λ₁ + λ₂)/2)); ratio (= √(λ₁/λ₂)); angleRad (Hauptachse, wie
    covarianceEllipse); p; verdict: "elongated" | "none" | "few" }`.
  - `few` unter 100 Punkten oder unter 5 Scheiben; `elongated` bei p < 0,05 und ratio ≥ 1,15.
  - In `ANALYSIS_CATALOG` eintragen: `periodShape: ["L9"]`.
- Tests: zwei Scheiben, deren Punkte nur in x streuen, ergeben `angleRad` 0 und ein großes `ratio`; eine runde
  Normalstichprobe (Seed) aus 400 Punkten in 10 Scheiben ergibt `none`; 80 Punkte ergeben `few`; eine Scheibe, die
  um 5 mm versetzt ist, ändert `sigmaUm` nicht (Form ist lageunabhängig).

### T4 `shot-core`: Lage über Zeit (L10)

- `PositionPoint { id; atMs; center: Point; n }`, `positionPoints(cards: readonly PatternCard[]): PositionPoint[]`
  (Scheiben ab 3 Punkten, in zeitlicher Folge).
- `positionOverTime(points: readonly PositionPoint[]): PositionOverTime` mit `{ points; mean: Point | null; cards;
  p; offsetUm; verdict: "offset" | "fits" | "few" }`: Hotelling über die Schwerpunkte (`confidenceOf` aus T1), ab
  5 Scheiben; `offset`, wenn T² über dem kritischen Wert liegt.
- In `ANALYSIS_CATALOG`: `positionPoints: ["L10"]`, `positionOverTime: ["L10"]`.
- Tests: fünf Schwerpunkte um (400, −300) µm mit kleiner Streuung → `offset` und `mean` ≈ (400, −300); fünf um (0, 0)
  symmetrisch → `fits`; vier → `few`; eine Scheibe mit 2 Punkten zählt nicht.

### T5 `shot-core`: Ausreißerrichtung (L7)

- `outlierDirection(cards: readonly PatternCard[]): OutlierDirection | null` mit `{ n; counts: number[] (12 Uhrzeiten,
  Index 0 oben wie directionClock); meanRad; p; verdict: "directed" | "none" | "few" }`. Je Scheibe ab 10 Punkten die
  weitesten k = max(1, Math.round(n / 10)) von ihrer Mitte (bei Gleichstand die früheren), Richtung von der Mitte.
  Rayleigh: R = |Σ (sin θ, cos θ)|, p = exp(√(1 + 4n + 4(n² − R²)) − (1 + 2n)). `few` unter 30.
- In `ANALYSIS_CATALOG`: `outlierDirection: ["L7"]`.
- Tests: Scheiben, deren weiteste Schüsse alle links unten liegen → `directed`, `meanRad` in Richtung 7–8 Uhr; eine
  Scheibe mit 9 Punkten zählt nicht; gleichmäßig verteilte Ausreißer (je Uhrzeit gleich viele) → `none`.

### T6 `shot-core`: das ganze Muster

- `periodPattern(cards: readonly PatternCard[]): PeriodPattern`, JSON-tauglich:
  `{ shots; cards; cardsWithoutPosition; form: PatternLayer; position: PatternLayer; shape; overTime; outliers }`,
  `PatternLayer { halfUm; points: [number, number][] | null (10 µm, unter 300 Schuss); grid: { size; cells; inner;
  outer } | null (ab 300) }`. Lage nimmt alle Punkte, wie sie lagen. Form nimmt die Scheiben ab 3 Punkten und
  verschiebt jede um ihre Mitte (bei weniger Punkten gibt es keine sinnvolle Mitte). `cardsWithoutPosition` zählt die
  Scheiben ohne einen Punkt; `shots` sind die Punkte der Lage-Sicht.
- `PATTERN_POINTS_MAX = 300` exportieren.
- In `ANALYSIS_CATALOG`: `periodPattern: ["L9"]`; `densityGrid` und `patternHalf` sind Hilfen und werden nicht über
  `./analysis` exportiert (eigener Export `@vereinsheim/shot-core/pattern` in `package.json`, wie `./projection`).
- Tests: `JSON.parse(JSON.stringify(p))` gleicht `p`; 1.500 Scheiben à 40 Schuss ergeben unter 200 KB JSON (die
  Schwerpunkte je Scheibe mit Id machen den größten Teil aus) und rechnen unter 2 s (Grenze im Test großzügig, die
  Messung steht in T18).

### T7 Simulation und Belege (B22–B24)

- `packages/shot-help/scripts/simulate.ts`: drei Fälle mit festem Seed, LG σ 1,5 mm und LP σ 15 mm, je 5, 10, 20 und
  40 Scheiben zu 40 Schuss:
  - B22 Form: Fehlalarm „länglich“ bei runder Gruppe; erkannt bei a/b 1,25 und 1,5.
  - B23 Ausreißerrichtung: Fehlalarm bei runder und bei länglicher Gruppe (a/b 2); erkannt, wenn jeder zehnte Schuss
    zusätzlich 1σ nach links unten verreißt.
  - B24 Lage: Fehlalarm „versetzt“ ohne Versatz; erkannt bei Versatz 0,3σ und 0,5σ.
- Laufen lassen (`pnpm --filter @vereinsheim/shot-help simulate`), die Zeilen unter „Belege aus Simulationen“ in
  `vault/spiegel/spiegel-statistics.md` eintragen.
- **Circuit-Breaker:** Liegt ein Fehlalarm über 6 %, anhalten und dem User die Zahlen mit einem Vorschlag vorlegen.

### T8 `shot-help`: drei Themen

- In `packages/shot-help/src/topics.ts`, Thema `period`, nach `trainingsumfang`:
  - `form-ueber-scheiben` („Form über mehrere Scheiben“, catalog `["L9"]`): was (jede Scheibe um ihre Mitte, alle
    zusammen), so liest du es (länglich und Richtung, Länge zu Breite), Vorsicht (eine leichte Streckung von 1,2 bis
    1,3 sieht man erst über viele Scheiben; Zahl aus B22), Minimum „Ab 100 Schuss aus 5 Scheiben.“, Formel (gepoolte
    Kovarianz, Mauchly, Schwelle 1,15).
  - `lage-ueber-zeit` („Lage über Zeit“, `["L10"]`): Punkte je Scheibe, Urteil über die Scheiben, nicht über Schüsse;
    Vorsicht mit Zahl aus B24; Minimum „Ab 5 Scheiben mit Lage.“; Formel (Hotelling über die Schwerpunkte).
  - `ausreisserrichtung` („Ausreißerrichtung“, `["L7"]`): weitestes Zehntel je Scheibe von ihrer Mitte; Vorsicht: eine
    längliche Gruppe hat Ausreißer an beiden Enden, das ist keine Richtung (Zahl aus B23); Minimum „Ab 30 Ausreißern.“
- In `packages/shot-help/src/guide.ts`, `VIEW_HELP` (ein Thema braucht eine Katalog-ID, `topics.test.ts`):
  `langzeit-trefferbild` („Trefferbild über den Zeitraum“): Form und Lage, Punkte unter 300 Schuss, darüber die zwei
  Flächen (die Hälfte, neun von zehn), der Satz unter dem Bild und wohin die Reiter Präzision und Lage führen.
- Den Vault-Leitfaden neu schreiben: `pnpm --filter @vereinsheim/shot-help docs` (Test `sync.test.ts`).
- Tests der Hilfe (`topics.test.ts`, `style.test.ts`, `wording.test.ts`) grün; keine Semikolons in neuen Texten.

### T9 Spiegel: Lesen und Action

- `apps/spiegel/src/lib/db/reads.ts`: `patternCardsOf(db, { ownerId, ids })` liest aus `cardProjection` `cardId`,
  `marks` und `card.startedAt` mit denselben Bedingungen wie `marksOfCards` und gibt `PatternCard[]` (Lagen über
  `markShots`). Test in `reads.test.ts` wie für `marksOfCards` (fremde und gelöschte Scheiben fehlen).
- `apps/spiegel/src/lib/pattern-actions.ts` (`"use server"`): `periodPatternAction(ids: unknown):
  Promise<ActionResult<PeriodPattern>>`. Prüft: ein Array, höchstens 5.000 Einträge, jeder `isCardIdInput`, sonst
  `{ error: "Das geht gerade nicht. Lade die Seite neu." }`; ohne Sitzung wie `cardMarksAction`. Rechnet
  `periodPattern(await patternCardsOf(...))`. Fehler: `{ error: "Das Trefferbild ließ sich nicht laden." }`.
- Test `pattern-actions.test.ts` nach dem Muster von `marks-actions.test.ts`: ohne Sitzung, ungültige Ids, zu viele
  Ids, fremde Ids fehlen im Ergebnis.

### T10 `shot-ui`: Zustand und Adresse

- `period/state.ts`: `PeriodState.show: "history" | "target"`, Vorgabe in `initialPeriodState` `"history"`, Aktion
  `{ type: "setShow"; show }`; `setFilters` lässt `show` stehen.
- `nav/routes.ts`: `ProgressQuery.show`, `DEFAULT_PROGRESS.show = "history"`, Schlüssel `show` (Wert `target`) nach
  `view` und vor `pick`; Ungültiges gilt als Vorgabe. `nav/navigate.ts`: `periodStateFromRoute` und `progressRoute`
  reichen `show` durch; neu `progressWithPattern(family)` (Fortschritt der Familie mit `show: "target"`, ohne Anker:
  das Bild steht oben).
- `layout/sections.ts`: `periodSections(show)` gibt `PERIOD_SECTIONS` mit dem Namen „Trefferbild“ für `history`, wenn
  `show === "target"`; `parsePeriodHash` erkennt zusätzlich `#result`, `#precision`, `#position` als Abschnitt
  `analysis` mit Reiter.
- Treffsicher setzt `PeriodState` über `initialPeriodState`; falls es Zustände als Literal baut, `show: "history"`
  ergänzen (tsc zeigt die Stellen).
- Tests in `routes.test.ts`, `state.test.ts`, `sections.test.ts`: Hin- und Rückweg mit `show=target`, Vorgabe fällt
  weg, `show=quatsch` gilt als Vorgabe, Reihenfolge der Schlüssel.

### T11 `shot-ui`: Scheibenbild herauslösen

- `target/TargetFace.tsx`: Papier, Spiegel und Ringe aus `MiniTarget` als Teil eines SVG (`<g>`), Parameter `target`,
  `half` (für das Weglassen großer Ringe). `MiniTarget` nutzt es; seine Markup-Tests bleiben unverändert.

### T12 `shot-ui`: Höhenlinien

- `period/contours.ts`: `contourPath(grid: { size; cells }, level: number, halfUm: number): string`: Marching Squares
  mit linearer Interpolation, Pfade in mm wie `MiniTarget` (x = µm/1000, y = −µm/1000), geschlossen, gerundet auf
  0,001 mm. Ränder des Rasters zählen als 0, damit jede Fläche geschlossen ist.
- Tests: 3 × 3 mit 255 in der Mitte und Stufe 128 ergibt einen geschlossenen Pfad um die Mitte; leeres Raster einen
  leeren Pfad; zwei getrennte Spitzen zwei Teilpfade.

### T13 `shot-ui`: Trefferbild des Zeitraums

- `period/patternWords.ts` (rein): `shapeWords(shape)`, `positionWords(overTime)`, `basisText(pattern)`,
  `outlierWords(outliers)` mit genau den Texten aus „Texte“ oben; Richtung über `directionName`, Winkel der Form:
  unter 22,5° waagrecht, über 67,5° senkrecht, sonst schräg nach rechts oben (steigende Achse) oder rechts unten.
  Tests mit allen Fällen, Wortlaut wörtlich.
- `period/PatternTarget.tsx`: SVG mit `TargetFace`, darüber die Dichte (äußere Fläche Token `primary` mit
  Deckkraft 0,22, innere 0,45; Konturen als Haarlinie) oder die Punkte (Radius 0,35 · Kaliberradius, Token `primary`,
  Deckkraft 0,5); in Lage der Schwerpunkt aller Scheiben als `MpiMark`. `role="img"` mit dem Satz als Namen.
  Quadratisch, `select-none`.
- `period/PatternPanel.tsx`: Kopfzeile der Karte nur für das Bild: Umschalter Sicht (`Segmented`, „Form | Lage“), dann
  `PatternTarget`, Satz (fett, erster Satz) und Rest, Erklärzeile der Sicht, Legende, Grundlage. Ladezustand: leeres
  Quadrat gleicher Größe und die Zeile „Trefferbild wird gerechnet …“; Fehler: Text und Knopf „Noch einmal“.
- `period/PeriodChartBar.tsx`: neuer erster Umschalter `Verlauf | Trefferbild` über die optionalen Props `show` und
  `onShow`; ohne `onShow` (Treffsicher) bleibt die Leiste, wie sie ist. Mit `target` verschwinden Kennzahl und
  Darstellung, das „?“ öffnet `langzeit-trefferbild`.
- Markup-Tests (`renderToStaticMarkup`): Punkte unter 300, Flächen ab 300, Satz und Grundlage, kein Fachbegriff aus
  `JARGON` im gerenderten Text, Ladezustand ohne Sprung in der Größe.

### T14 `shot-ui`: Reiter der Analyse über den Zeitraum

- `analysis/AnalysisStrip.tsx`: der klebende Streifen mit `Segmented` aus `AnalysisPanel` herausgelöst
  (`AnalysisPanel` nutzt ihn, Markup gleich).
- `period/PeriodAnalysis.tsx`: Kopf „Was der Zeitraum zeigt“, `AnalysisStrip` mit „Ergebnis · Präzision · Lage“,
  darunter die Karten des Reiters im Raster wie `AnalysisPanel` (Funktion `layout` dorthin exportieren statt kopieren).
  - Ergebnis: der Inhalt von `PeriodInsights` (Rekorde), unverändert; `PeriodInsights` bleibt für Treffsicher.
  - Präzision: `ShapeCard` (Hilfe `form-ueber-scheiben`), `KeyValues` und Notiz wie in „Texte“.
  - Lage: `PositionOverTimeCard` (Hilfe `lage-ueber-zeit`) und `OutlierClockCard` (Hilfe `ausreisserrichtung`,
    `ClockChart` mit `counts`).
  - Ohne Muster (lädt noch, Fehler) zeigen Präzision und Lage denselben Lade- bzw. Fehlerzustand wie das Bild.
- `period/PositionChart.tsx`: Schwerpunkte als Punkte auf `TargetFace` im Ausschnitt der Lage-Sicht, Radius nach √n,
  dünne Linie in zeitlicher Folge, die gewählte Scheibe hervorgehoben (`aria-current` in der Tabelle), der Schnitt als
  `MpiMark`. Antippen wählt die nächste Scheibe (neue reine Funktion `nearestPoint` in `period/contours.ts` oder
  eigener Datei, mit Test), Tastatur über „Werte als Tabelle“ (`ValuesTable`: Datum, Richtung, Abstand).
- Tests: Markup je Reiter, `nearestPoint` mit Handwerten, Rekorde im Reiter Ergebnis gleich wie in `PeriodInsights`.

### T15 Spiegel: Fortschritt verdrahten

- `apps/spiegel/src/components/progress/usePeriodPattern.ts`: `usePeriodPattern(ids, enabled)` hält
  `{ status: "idle" | "loading" | "ready" | "error"; pattern }` je Schlüssel (`ids.join(",")`), ruft
  `periodPatternAction` nur mit `enabled`, verwirft Antworten zu einem alten Schlüssel, `retry()`.
- Ids: neue reine Funktion `patternIds(model, includeProbeOnly)` in `shot-ui/period/model.ts` (die Scheiben, die das
  Ergebnis zählt), mit Test.
- `ProgressScreen.tsx`: `show` aus `state`, Umschalter über `dispatch({ type: "setShow" })` (Adresse wie die Filter),
  `enabled` = Trefferbild gezeigt oder Reiter Präzision/Lage offen; `PatternPanel` statt `PeriodChart`, wenn `show`
  `target` ist (die Ablesungszeile darunter bleibt); `PeriodAnalysis` statt `PeriodInsights`; Reiter aus dem Anker wie
  auf der Scheibe; Sprungleiste mit `periodSections(state.show)`; Wahl aus `PositionChart` über
  `dispatch({ type: "choose" })`.
- Die Karten „Form der Gruppe“ und „Richtungsuhr“ auf der Seite einer Scheibe: `patternRoute` analog zu `sigmaRoute`
  (in `CardContext` und `AnalysisPanel`), Link „Über alle Scheiben im Fortschritt ›“; die Seite der Scheibe reicht
  `progressWithPattern(family)`.

### T16 Skriptprüfung

- `apps/spiegel/tools/pruefen.ts`, Abschnitt „Fortschritt“:
  - „Trefferbild: Umschalten schreibt show=target, Zurück stellt den Verlauf her“.
  - „Trefferbild: Satz, Legende und Grundlage stehen da, keine Fachbegriffe“ (`JARGON`).
  - „Trefferbild: Form und Lage schalten ohne Neuladen“.
  - „Reiter Lage: Antippen eines Schwerpunkts wählt die Scheibe für die Ablesung“.
  - „Telefon 390 px: kein seitliches Scrollen, über dem Bild höchstens zwei Zeilen Bedienung“.
  - Je nach Demo-Daten Punkte oder Dichte; was die Daten nicht hergeben, als „nicht belegt“ melden (Regel
    „Datenlage vor der Sichtprüfung abgleichen“).
- Lauf in **einem** Befehl: `seed:own --demo`, `pruefen --start --alle`, `seed:own` (Auto-Memory: sonst ist das Konto
  leer).

### T17 Doku

- `vault/spiegel/spiegel-langzeit.md`: „Langzeit-Trefferbild“ und „Analyse über den Zeitraum“ von Konzept auf gebaut,
  Offen-Tabelle.
- `vault/spiegel/spiegel-statistics.md`: L7 genauer (weitestes Zehntel je Scheibe von ihrer Mitte), L9 und L10 mit
  Test und Schwellen, Status „SP-2.7, gebaut“.
- `vault/spiegel/spiegel-navigation.md`: Schlüssel `show`.
- `vault/spiegel/spiegel-roadmap.md`: SP-2.7 Plan 1 erledigt.
- `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`: neue Exporte.
- `apps/spiegel/CLAUDE.md`: `periodPatternAction`.

### T18 Messung

- `apps/spiegel/tools/measure.ts`: Zeile „Trefferbild Alles“ (`patternCardsOf` über alle Scheiben der Familie,
  `periodPattern`), Median und Größe des JSON. Ziel: unter 400 ms und unter 200 KB bei 1.564 Scheiben; bei den
  letzten 90 Tagen eines aktiven Schützen (rund 60 Scheiben) unter 30 KB. Ergebnis in
  `vault/spiegel/spiegel-db-schema.md` neben den bisherigen Messungen.

## Test steps

- Nach T1–T6: `pnpm --filter @vereinsheim/shot-core test`.
- Nach T7–T8: `pnpm --filter @vereinsheim/shot-help test`.
- Nach T10–T14: `pnpm --filter @vereinsheim/shot-ui test`.
- Nach T9, T15: `pnpm --filter spiegel test`.
- Mutationsprobe (conventions §9): in `periodShape` die Bedingung `ratio ≥ 1,15` durch `true` ersetzen, in
  `outlierDirection` die Richtung von der Mitte der Scheibe durch die von (0, 0); je ein Test muss rot werden.
  Wiederherstellen aus einer `cp`-Sicherung, nicht mit `git checkout`.
- `pnpm check` vor jedem Commit (`pnpm check && git commit …`, nie mit `;`).

## Verification

- `pnpm check --force` grün.
- `pnpm --filter spiegel pruefen --start --alle` ohne FAIL, mit den neuen Prüfungen.
- Im Browser (Demo-Konto, 1440 px und 390 px, hell und dunkel): Trefferbild in Form und Lage, Wechsel ohne Sprung in
  der Höhe, Reiter Präzision und Lage, Antippen in „Lage über Zeit“, Link von der Seite einer Scheibe.
- Messung T18 im Rahmen.
- Keine Migration, keine Änderung an Deploy-Vertrag oder Brücke. Keine neue Brücke im Schützenhaus nötig.
