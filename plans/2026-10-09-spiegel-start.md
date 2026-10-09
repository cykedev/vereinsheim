# Plan N5 — Start im Labor

Schritt N5 aus `vault/spiegel/spiegel-navigation.md` (SP-1.8). Branch `feat/spiegel-start`. Entwürfe:
https://claude.ai/artifact/JUXCd88hXS1WSmNPUjSWXd (User, 9. Oktober 2026: „B mit dem Satz aus A darüber, die Chips
sind aber zu klein“).

## Kontext

Start ist der Einstieg von Spiegel (Entscheidung 1): oben „Offen“, darunter der letzte Abend, neue Rekorde und eine
Zeile zur Form. Im Labor ist Start bis jetzt ein Platzhalter. Seit N2 gibt es keine „Hauptscheibe“ mehr. Der User
wünscht für den letzten Abend etwas Eigenes, weder wie die Seite einer Scheibe noch wie die Liste: einen schönen,
informativen, nicht überladenen Einstieg. Gewählt ist Entwurf B (der Abend im Formband) mit dem Satz aus A darüber.

Entschieden mit dem User (9. Oktober 2026):

- Start zeigt alle Disziplinen des letzten Abends, bei einem Mischabend je Disziplin einen Block.
- „Neue Rekorde“ heißt: am letzten Abend aufgestellt.

## Entscheidungen

- **D1 Aufbau von Start**, von oben:
  1. „Offen (n)“ als Karte mit den offenen Dingen. Im Labor sind es zwei Platzhalter; echte Fälle kommen mit N6.
     Ohne Offenes fällt die Karte weg.
  2. Je Familie des letzten Abends ein Block „Der Abend“ (D2–D6).
  3. Eine Zeile „Form, letzte 90 Tage“ für die zuletzt gewählte Familie (D7).
  - „Läuft gerade“ kommt ohne Live-Daten nicht ins Labor (N7).
- **D2 Einheit ist die Scheibe** (Regel des Fachkerns „Über viele Scheiben“). Deshalb zeigt der Streifen in
  Entwurf B nicht die letzten 20 Abende, sondern die letzten 20 Scheiben der Familie. Die Scheiben des Abends sind
  hervorgehoben.
  - **Schnitt:** der Schnitt der bis zu fünf Scheiben vor dem Abend (Entscheidung 13).
  - **Band:** das Formband des Fachkerns (`periodTrend`), Schnitt ± typische Schwankung, ab zehn Scheiben. Seine
    Mitte ist genau dieser Schnitt.
  - Der „Platz unter den letzten 20 Abenden“ aus dem Entwurf entfällt, er bräuchte den Abend als Einheit.
- **D3 Die große Zahl** ist der Ø je Schuss des Abends über alle Wertungsschüsse der Familie an diesem Abend
  (Training nur aus Probe wie Wertung). Gerechnet wird in der Wertung des Geräts, wie Ø und Abstand in der Liste.
  Darunter steht der Abstand zum Schnitt: „+0,09 zum Schnitt der 5 Scheiben davor · im Formband“.
- **D4 Der Satz** steht darüber (aus Entwurf A) und folgt dem Band:
  - innerhalb: „Ein Abend in deiner Form: 0,09 über deinem Schnitt.“;
  - darüber: „Ein starker Abend: …“; darunter: „Ein schwächerer Abend: …“;
  - ohne Band (unter zehn Scheiben): „0,09 über dem Schnitt der 5 Scheiben davor.“;
  - ohne Scheiben davor: „Dein erster Abend mit Luftpistole.“
  - „stark“ und „schwächer“ stehen nur außerhalb des Bands; ein Urteil und die Zahl daneben widersprechen sich nie.
- **D5 Die Scheiben des Abends als Kacheln**, größer als im Entwurf: kleine Scheibe 56 px (Gruppe), Uhrzeit,
  Ergebnis in beiden Wertungen wie in der Liste (amtlich vorn). Die Kachel ist ein Link auf die Scheibe mit Start als
  Herkunft. Darunter steht „Abend in Scheiben ›“ (die Liste dieser Familie mit dem Abend als Anker).
- **D6 Neue Rekorde** stehen im Block, nur wenn die Scheiben des Abends Rekorde der Familie halten (`periodRecords`
  über alle Scheiben der Familie, `recordRows`). Je Rekord eine Zeile mit Wert und „zeigen“ (Link auf die Scheibe).
  Ohne neue Rekorde gibt es keinen leeren Kasten.
- **D7 Form, letzte 90 Tage**, eine Zeile für die zuletzt gewählte Familie: Ø je Schuss der letzten 90 Tage,
  Abstand und Urteil gegen die 90 Tage davor (`periodModel` mit Vergleich, `verdictText`). Die Zeile ist ein Link
  auf den Fortschritt mit dieser Familie und dem Vergleich.
- **D8 Wege von Start:**
  - Kachel und Rekord öffnen die Scheibe mit Herkunft Start (`openCard({ page: "start" }, …)`), in der Wertung, die
    die Kachel vorn zeigt.
  - Der Rückweg heißt „← Start“ (`backLabel`).
  - Blättern geht durch die Scheiben des letzten Abends in zeitlicher Folge, über alle Familien (Entscheidung 9:
    „Start mit dem letzten Abend“). `contextCardIds` für die Herkunft Start ersetzt das bisherige `null`.
- **D9 Nicht im Umfang:** echte offene Fälle (N6), „Läuft gerade“ und Start in `apps/spiegel` (N7), Auswahl (N4).

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/start/model.ts` (+ Test) | neu: `startModel` (letzter Abend je Familie, Schnitt, Band, Urteil, Streifen, Rekorde, Form) |
| `packages/shot-ui/src/start/sentence.ts` (+ Test) | neu: `eveningSentence`, `eveningDeltaText` |
| `packages/shot-ui/src/start/FormStrip.tsx` (+ Test) | neu: Streifen der letzten 20 Scheiben mit Band und Schnitt |
| `packages/shot-ui/src/start/EveningBlock.tsx` (+ Test) | neu: Satz, Meta, große Zahl, Abstand, Streifen, Kacheln, neue Rekorde, Link |
| `packages/shot-ui/src/start/OpenBox.tsx`, `FormLine.tsx` (+ Tests) | neu |
| `packages/shot-ui/src/nav/context.ts` (+ Test) | Herkunft Start: die Scheiben des letzten Abends |
| `packages/shot-ui/package.json` | Exporte `./start/*` |
| `tools/labor/src/StartView.tsx` (neu), `App.tsx`, `PlaceholderView.tsx` | Start statt Platzhalter |
| `tools/labor/pruefung.js` | Prüfungen für Start |
| `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`, `vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-roadmap.md`, `vault/architecture/architecture.md` | Doku |

## Required Docs

- `vault/conventions.md` (§3 Typografie, §6 Formatierung, §9, §10 Design 2)
- `packages/shot-ui/CLAUDE.md` (Regeln: Zahlen nur aus dem Fachkern, Diagramme, Rahmen und Links, Liste)
- `packages/shot-core/CLAUDE.md` (Regel „Über viele Scheiben“, „Ehrlich statt scheingenau“)
- `tools/labor/CLAUDE.md`
- `vault/spiegel/spiegel-navigation.md` (Entscheidungen 1, 8, 9, 13)

## Aufgaben

### Task 1: Modell von Start (`start/model.ts`)

- Eingabe:
  `startModel(input: { cards: readonly ListInputCard[]; timeZone: string; nowMs: number; named: readonly NamedPeriod[]; scoring: Scoring; family: string | null })`.
- **Letzter Abend:** `eveningDay` der neuesten Scheibe. Seine Scheiben je Familie, Familien nach ihrer ersten
  Scheibe des Abends.
- **Je Familie** ein `EveningBlock`:
  - `rows`: die Zeilen dieses Abends aus `cardListModel(…, { ...DEFAULT_LIST, family })`.
  - `shots`, und `mean`: Ø je Schuss über alle Wertungsschüsse des Abends (`matchShots`) mit
    `inScoring(metricByKey("result.decimalMean"), scoring)`.
  - Werte je Scheibe der Familie: `cardValues(…, { includeProbeOnly: true })` in zeitlicher Folge.
  - `average`: Schnitt der bis zu fünf Scheiben vor der ersten Scheibe des Abends (`{ value, n }`, null ohne
    Scheiben davor).
  - `band`: aus `periodTrend` über die Werte bis zur letzten Scheibe davor, das Band ihres letzten Punkts; null
    ohne Band.
  - `verdict`: `"above" | "within" | "below"` aus `mean` gegen `band`, null ohne Band.
  - `strip`: die letzten bis zu 20 Werte bis einschließlich des Abends, je `{ id, value, tonight }`.
  - `records`: `recordRows(periodRecords(Scheiben der Familie, scoring, { includeProbeOnly: true }), scoring)`,
    nur die mit `record.cardId` am Abend.
- **`form`** für `input.family` (ohne: die Familie des ersten Blocks):
  - aus `periodModel` mit `initialPeriodState({ family, scoring })` und `compare: { type: "previous" }`;
  - `{ family, mean: summary.mean, cards: summary.cards, comparison, compareLabel, route }`, wobei `route` der
    Fortschritt mit Familie und Vergleich ist.
- Ohne Scheiben: `{ day: null, blocks: [], form: null }`.
- **Test** mit `periodCard`, Handwerte:
  - Mischabend mit zwei Familien, Reihenfolge der Blöcke;
  - Abend nach Mitternacht vor 4 Uhr gehört zum Vortag;
  - `mean` über zwei Scheiben gemischt nach Schusszahl (40 und 20 Schuss), nicht Mittel der Mittel;
  - `average` aus genau den fünf davor (eine sechste ältere mit Ausreißer ändert ihn nicht);
  - `band` erst ab zehn Scheiben, `verdict` innerhalb, darüber, darunter;
  - `strip` mit höchstens 20, die des Abends markiert;
  - `records` nur vom Abend;
  - `form` mit Vergleich.
  - Gegenprobe für `mean`: Mittel der Mittel ergäbe einen anderen Handwert.

### Task 2: Satz und Abstand (`start/sentence.ts`)

- `eveningSentence(block, familyLabel)`: die Sätze aus D4, Zahlen über `formatValue` (2 Stellen), echtes Minus.
- `eveningDeltaText(block)`: „+0,09 zum Schnitt der 5 Scheiben davor · im Formband“. Ohne Band ohne den Zusatz; bei
  einer Scheibe davor „der Scheibe davor“; ohne Schnitt null.
- **Test:** jeder Fall aus D4, Vorzeichen und Einzahl.

### Task 3: Streifen (`start/FormStrip.tsx`)

- Props: `{ strip, average, band }`.
- SVG in `ChartSlot`/`ChartSvg` (Bildschirm-Pixel, Schrift ab 12 px):
  - waagrechte Achse Ø je Schuss vom kleinsten bis größten Wert (mit Rand);
  - Band als Fläche in `accent-wash`, der Schnitt als gestrichelte Linie mit Beschriftung „Schnitt 8,95“;
  - frühere Scheiben als Punkte in `muted-foreground`, leicht versetzt;
  - die des Abends als größere Punkte in `primary` mit Rand in `card`, über dem letzten „heute“ und der Wert;
  - links und rechts unten der kleinste und größte Wert.
- `role="img"` mit einem Namen, der den Inhalt in Worten sagt („Die letzten 20 Scheiben, die des Abends
  hervorgehoben; Formband 8,72 bis 9,18“).
- **Test (Markup):**
  - Zahl der Punkte, die des Abends in `primary`;
  - Band nur mit Band, Schnitt nur mit Schnitt;
  - keine Palette-Klassen, Schrift ab 12 px.

### Task 4: Block des Abends (`start/EveningBlock.tsx`)

- Props: `{ block, familyLabel, cards: ReadonlyMap<string, PeriodCard>, target, timeZone, cardRoute, listRoute }`.
- Aufbau:
  - der Satz als `h2` (`font-display`, ~1.45rem);
  - Meta „Do 25.09. · Luftpistole · 2 Scheiben · 60 Schuss“;
  - die große Zahl mit „Ø je Schuss“ und die Zeile `eveningDeltaText`;
  - `FormStrip`;
  - Kacheln (Grid `repeat(auto-fill, minmax(9.5rem, 1fr))`), je Kachel ein `RouteLink`: `MiniTarget` 56 px,
    Uhrzeit, Ergebnis vorn und klein die andere Wertung;
  - „Neue Rekorde“ (Liste aus `block.records`, „zeigen“ als `RouteLink`), nur wenn welche da sind;
  - „Abend in Scheiben ›“ (`RouteLink` auf `listRoute`).
- Die Karte: `rounded-2xl border border-border bg-card`, Abstände wie in den Entwürfen.
- **Test (Markup):**
  - Reihenfolge der Teile;
  - Kacheln als Links mit `from=start`;
  - Rekorde nur mit Rekorden;
  - der Link in die Liste mit Abend-Anker.

### Task 5: Offen und Form (`start/OpenBox.tsx`, `start/FormLine.tsx`)

- `OpenBox`: `{ items: { id: string; title: string; detail: string; route: Route }[] }`. Ohne Einträge nichts;
  sonst eine Karte „Offen (n)“ mit je einem `RouteLink`.
- `FormLine`: `{ form, familyLabel }`, ein `RouteLink` „Form, letzte 90 Tage · Luftgewehr: Ø 10,27 je Schuss ·
  +0,03 gegen die 90 Tage davor · nicht nachweisbar ›“. Ohne Vergleich „… · zu wenige Scheiben“, ohne Wert nichts.
- **Test (Markup):** Zahl im Titel, Links, leere Fälle.

### Task 6: Blättern von Start (`nav/context.ts`)

- `contextCardIds` mit Herkunft Start: die Scheiben des letzten Abends (`eveningDay` der neuesten Scheibe), alle
  Familien, in zeitlicher Folge.
- **Test:** Mischabend mit zwei Familien, eine ältere Scheibe gehört nicht dazu.

### Task 7: Start im Labor

- `tools/labor/src/StartView.tsx`:
  - Labor-Kopf;
  - `OpenBox` mit zwei Platzhaltern („Erste Scheibe bestätigen“ → `/open`, „QR-Scan wartet auf die Zuordnung“ →
    `/scan`), gekennzeichnet als Beispiel;
  - je Block `EveningBlock` mit `cardRoute = (id) => openCard({ page: "start" }, id, official ?? scoring)` und
    `listRoute = { page: "cards", query: { ...DEFAULT_LIST, family }, evening: day }`;
  - `FormLine` für die zuletzt gewählte Familie.
  - Zahlen über `startModel` mit der Saison, der Wertung des Geräts und der Familie aus dem Zustand.
- `App`: Modus `start` zeigt `StartView` statt `PlaceholderView`. `openCount` am Rahmen ist die Zahl der Einträge in
  „Offen“ (2). `PlaceholderView` verliert `start`.
- Prüfhaken: `exposeStartForTest({ model })` für die Prüfung.

### Task 8: Skriptprüfung

- **Start lädt** über die Navigation:
  - Block für den letzten Abend der Saison mit der Familie und dem Tag aus dem Modell;
  - die große Zahl gleich `tools`-Rechnung (Ø je Schuss über die Wertungsschüsse des Abends);
  - der Satz passt zu `verdict`;
  - der Streifen hat so viele Punkte wie `strip`, so viele hervorgehoben wie Scheiben am Abend.
- **Kachel öffnet** die Scheibe mit `from=start`; der Rückweg heißt „Zurück zu „Start““ und führt zurück; Blättern
  im Abend (Nachbarn aus `contextCardIds`).
- **Offen:** zwei Einträge, der Zähler am Rahmen ist 2.
- **Form-Zeile** führt in den Fortschritt mit Familie und `compare=previous`.
- **Telefon 390 px:** kein seitliches Scrollen; die Kacheln sind mindestens 56 px hoch und stehen nebeneinander, wo
  zwei passen.
- Adressen aller Links auf Start überstehen Lesen und Schreiben.

### Task 9: Doku

- `packages/shot-ui/CLAUDE.md`: Exporte `start/*`, Regel „Start“ (D1–D8, Einheit Scheibe).
- `tools/labor/CLAUDE.md`: Start statt Platzhalter, Prüfhaken `start`.
- `vault/spiegel/spiegel-navigation.md`: „Umgesetzt in N5“. Entscheidung 1 angepasst: keine Hauptscheibe; der
  Abend im Formband mit Satz; Streifen über Scheiben.
- `vault/spiegel/spiegel-roadmap.md` (N5 erledigt), `vault/architecture/architecture.md`.

## Teststeps

1. `pnpm --filter @vereinsheim/shot-ui test` — Modell, Satz, Streifen, Block, Offen, Form, Kontext.
2. Labor direkt bauen, `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL.
3. Gegenproben per Mutation (je rot, dann zurück):
   - `mean` als Mittel der Mittel;
   - `average` über sechs statt fünf;
   - `verdict` ohne Band als „within“;
   - Rekorde ohne Filter auf den Abend.
4. `pnpm check` grün vor jedem Commit.

## Verification

- `pnpm check` grün, `vault-lint` gültig, Labor direkt gebaut, `pruefen` 0 FAIL.
- **Sichtprüfung:**
  - Screenshots von Start: Desktop 1280 hell und dunkel, Telefon 390 im Rahmen, unbeschnitten angesehen;
  - verglichen mit dem Entwurf B im Artifact;
  - was nicht zu sehen ist, steht als „nicht gesehen“ im Bericht.
- Artifact des Labors neu veröffentlichen.
