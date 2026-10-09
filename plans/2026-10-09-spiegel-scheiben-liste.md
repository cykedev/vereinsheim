# Plan: N2 Abende und Scheiben-Liste für Spiegel

- **Anlass:** Schritt N2 aus `vault/spiegel/spiegel-navigation.md`. Dort entschieden mit dem User am 9. Oktober 2026:
  2 (nach Abend), 3 (ein Abend klappt nur auf), 4 (zwei verlinkte Bereiche), 5 (Familie Pflicht), 6 (Mischabend),
  9 (Blättern im Kontext), 13 (Schnitt der fünf davor).
- **Rückfragen in dieser Session:**
  - Die Zeile zeigt **Ergebnis und Ø**.
  - Das Einklappen „kleiner“ Scheiben (SF-11) entfällt vorerst. Der User kennt das Konzept nicht; ob Nebenscheiben am
    Abend vorkommen, zeigen echte Daten (SP-0.6).
  - Ob solche Scheiben im Fortschritt zählen, bleibt offen.
- **Branch:** `feat/spiegel-scheiben-liste` (von `main` f7c76f6).

## Kontext

N1 hat die Adressen gebaut (`nav/routes`, `nav/navigate`); die Liste hat dort schon ihre Route (`ListRoute` mit
`family`, `kind`, `flag`, `range` und dem Abend als Anker). Es fehlt die Liste selbst:

- Abende als reine Funktion.
- Die Liste als Baustein, mit Filtern und Querverweisen.
- Im Labor eine dritte Ansicht „Scheiben“.

Die Seite einer Scheibe und der Fortschritt bleiben, wie sie sind. Neu dazu kommt nur der Knopf „Alle in Scheiben
zeigen“.

Seit `feat/spiegel-seq-luecke` gilt: Zeit-Kennzahlen bekommen die ganze Karte (`card`). Die Liste rechnet keine
Zeit-Kennzahlen, nur Ergebnis, Ø je Schuss und Schusszahl.

## Entscheidungen

- **D1 Abend:**
  - Ein Abend ist Konto und Tag in der Anzeige-Zeitzone (`spiegel-data-model`, „Einheit“). Eine Scheibe, die vor 4 Uhr
    beginnt, zählt zum Vortag, damit ein Training über Mitternacht ein Abend bleibt.
  - Der Abend heißt sein ISO-Tag (`2026-09-25`), der auch der Anker ist.
- **D2 Alle Scheiben gleichberechtigt:**
  - Die Scheiben eines Abends stehen in ihrer zeitlichen Folge, nichts ist eingeklappt.
  - Die Abende stehen neueste zuerst.
- **D3 Familie Pflicht, Mischabend mit Hinweis:**
  - Die Liste zeigt eine Familie. Hat der Abend auch Scheiben einer anderen Familie, nennt der Kopf sie: „auch
    1 Scheibe Luftpistole ›“.
  - Antippen wechselt die Familie und springt zum selben Abend (Anker).
- **D4 Kopf des Abends:** Wochentag und Datum („Di 30.09.2026“), „n Scheiben · m Schuss“, dazu der Hinweis aus D3.
- **D5 Zeile:**
  - Kleine Scheibe (`MiniTarget`, Ausschnitt `groupView`), Uhrzeit, Art (T/W/P wie `CardList`).
  - Ergebnis in der Wertung des Geräts. Eine Scheibe nur aus Probe rechnet wie Wertung (`probeOnlyAsMatch`), nicht
    amtlich.
  - Ø je Schuss.
  - Abstand zum Schnitt der bis zu fünf Scheiben davor: Familie und Art wie im Fortschritt, im Ø je Schuss, über alle
    Scheiben der Familie, auch die vor dem Zeitraum.
  - Schusszahl (Wertung; bei nur Probe die Probe).
  - Auf dem Telefon fallen Uhrzeit, Abstand und Schusszahl unter 32rem Breite des Bereichs weg (Container-Abfrage). Die
    Seite scrollt nie seitlich.
- **D6 Die ganze Zeile ist der Link zur Scheibe** (`vault/conventions.md` §7). Es gibt keine Wahl und keine Ablesung
  in der Liste; Vergleichen und Auswählen kommen mit N4.
- **D7 Filter:**
  - Familie (Pflicht) und Art kommen als gemeinsamer Baustein `CardFilters` aus `PeriodControls`. Die Seite eines
    Zeitraums nutzt ihn ebenso, ihr Markup bleibt gleich.
  - Merkmal (`flag`) erscheint nur, wenn Scheiben der Familie Merkmale tragen. Namen: `nur-pdf` heißt „Nur PDF“,
    `unvollstaendig` „Unvollständig“, `ausgenommen` „Ausgenommen“, sonst die Id.
  - Ein Zeitraum (`range`) kommt nur über „Alle in Scheiben zeigen“ und steht als Chip mit „×“ da, beschriftet wie
    `resolveRange`.
- **D8 Querverweise und Rückweg:**
  - „Verlauf dieser Filter“ ist `progressFromList(list, scoring)`.
  - Im Fortschritt führt „Alle in Scheiben zeigen“ unter der Liste über `listFromProgress`.
  - Öffnen ist `openCard(list, id, scoring)`. „Zurück zu „Scheiben““ stellt Filter und Scrollstelle wieder her.
- **D9 Saison im Labor:**
  - Das Luftgewehr bleibt unverändert, damit der Fortschritt und seine Prüfungen gleich bleiben.
  - Die Luftpistole bekommt fünf Scheiben aus einem eigenen Zufallsgenerator (Seed 20261010) nach dem Hauptlauf:
    - eine zweite Scheibe an ihren letzten zwei Trainingstagen (eine Stunde nach der ersten, 20 Schuss);
    - je eine Scheibe an den letzten drei Samstagen, an denen das Luftgewehr trainiert hat (20:00 Uhr, 30 Schuss);
      das sind die Mischabende.
  - Die Ids bleiben fest: `cardId(target, day, slot)`, Slot 0 wie bisher.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/list/evenings.ts` (neu, + Test) | `eveningDay`, `cardListModel` (Abende, Zeilen, andere Familien, Filter, Abstand) |
| `packages/shot-ui/src/period/model.ts` (+ Test) | `deltasBefore` herausgelöst und exportiert; `periodModel` nutzt es |
| `packages/shot-ui/src/controls/CardFilters.tsx` (neu, + Test) | Familie und Art als Segmente |
| `packages/shot-ui/src/period/PeriodHeader.tsx` (+ Test) | `PeriodControls` nutzt `CardFilters` |
| `packages/shot-ui/src/period/CardList.tsx` (+ Test) | optional `onShowAll`: Knopf „Alle in Scheiben zeigen“ |
| `packages/shot-ui/src/list/EveningList.tsx` (neu, + Test) | Abende mit Kopf, Mischabend-Hinweis und Zeilen |
| `packages/shot-ui/src/list/ListControls.tsx` (neu, + Test) | `CardFilters`, Merkmal, Zeitraum-Chip, „Verlauf dieser Filter“ |
| `packages/shot-ui/package.json`, `packages/shot-ui/CLAUDE.md` | Exporte, Regel zur Liste |
| `tools/labor/src/season.ts` (+ Test) | fünf Scheiben der Luftpistole nach D9, `cardId` mit Slot |
| `tools/labor/src/LaborHeader.tsx`, `App.tsx`, `ListView.tsx` (neu), `PeriodView.tsx`, `CardView.tsx`, `testHook.ts` | Ansicht „Scheiben“, Öffnen und Zurück, Querverweise |
| `tools/labor/pruefung.js`, `tools/labor/CLAUDE.md` | Prüfungen der Liste |
| `vault/spiegel/spiegel-navigation.md`, `spiegel-edge-cases.md` (SF-11), `spiegel-roadmap.md` | Umgesetzt in N2, „kleine Scheiben“ offen |

## Required Docs

- `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md` (Regel „ganze Karte“), `tools/labor/CLAUDE.md`
- `vault/spiegel/spiegel-navigation.md` (Entscheidungen und „Umgesetzt in N1“)
- `vault/conventions.md` §7, §10

## Aufgaben

### Task 1: `deltasBefore` aus `periodModel` herauslösen

- `export function deltasBefore(values: readonly CardValue[], ids: ReadonlySet<string> | null, window = 5)` in
  `period/model.ts`: je Wert ab dem zweiten der Abstand zum Mittel der bis zu `window` Werte davor; mit `ids` nur für
  diese Ids.
- `periodModel` ruft es mit den Scheiben im Zeitraum auf; Verhalten unverändert.
- **Test (Handwerte):** Werte 10,0 · 10,2 · 9,8 · 10,1 · 10,0 · 10,3 ergeben für den sechsten 10,3 − 10,02 = 0,28
  (n = 5), für den zweiten 0,2 (n = 1). Der erste hat keinen Abstand. Mit `ids = {c3}` gibt es nur c3. Die bestehenden
  Tests von `model.test.ts` bleiben grün.

### Task 2: Abende als reine Funktion (`list/evenings.ts`)

- `eveningDay(startedAtMs, timeZone)`: der ISO-Tag in der Zone nach D1.
- `cardListModel(input: readonly { card: PeriodCard; family: string }[], query: ListQuery, context: { timeZone; nowMs;
  named; scoring })` liefert:
  - `evenings: { day: string; rows: ListRow[]; shots: number; others: { family: string; count: number }[] }[]`;
  - `flags: string[]` (Merkmale der Familie);
  - `cards: number`.
- `ListRow`: `{ id, startedAtMs, kindText, result, mean, delta, shots, probeOnly }`.
- **Filter:** Familie Pflicht (ohne `family` die erste vorhandene), Art wie `periodModel`, Merkmal, Zeitraum über
  `resolveRange`/`inRange`.
- **Werte:**
  - Ergebnis über `computeMetric(inScoring(result.decimal, scoring), shots)`, bei nur Probe über `probeOnlyAsMatch`.
  - Ø je Schuss ebenso.
  - Abstand über `cardValues` der Familie und Art (mit Training nur aus Probe) und `deltasBefore`.
- **Tests (Handwerte mit `periodCard` aus `period/testSeason`):**
  - Zwei Scheiben am selben Tag ergeben einen Abend in zeitlicher Folge; Abende neueste zuerst.
  - 00:30 und 03:30 MESZ zählen zum Vortag, 04:30 zum Tag.
  - Mischabend: `others` = `[{ family: "lp-freihand", count: 1 }]`; ein Abend nur mit der anderen Familie erscheint
    nicht.
  - Zehntel 100 · 102 · 98: Ergebnis 30,0, Ø 10,00; in ganzen Ringen 29. Nur Probe rechnet wie Wertung, `probeOnly`
    ist gesetzt.
  - Abstand wie Task 1 über sechs Scheiben.
  - Art `competition` lässt Training weg; Merkmal `nur-pdf` zeigt nur diese.
  - Zeitraum 30 Tage schneidet ältere ab; Abstand trotzdem über die älteren davor.

### Task 3: `CardFilters` und `PeriodControls`

- `controls/CardFilters.tsx`:
  - Segmente „Familie“ (nur bei mehr als einer) und „Art“ mit `KIND_OPTIONS`.
  - Props: `family`, `families`, `kind`, `onFamily`, `onKind`.
- `PeriodControls` nutzt es.
- **Test:**
  - Das Markup von `PeriodControls` vorher und nachher Zeichen für Zeichen gleich, für die Testzustände von
    `PeriodHeader.test.tsx`.
  - Der Baustein allein zeigt bei einer Familie kein Segment „Familie“.

### Task 4: Zeilen und Abende zeichnen (`list/EveningList.tsx`)

- **Aufbau:**
  - Je Abend `<section id={day} data-evening={day} className="scroll-mt-14">` mit Kopf (D4) und Liste.
  - Die Zeile ist ein Knopf (`data-card-row={id}`): kleine Scheibe, Uhrzeit, Art, Ergebnis, Ø, Abstand (Vorzeichen,
    Farbe nur über Tokens), Schuss.
  - Container-Abfrage nach D5.
- **Props:** `model`, `families` (Namen), `target(family)`, `shotsOf(id)`, `scoring`, `timeZone`, `onOpen(id)`,
  `onFamily(family, day)`.
- **Tests (Markup):**
  - Kopf „Di 29.09.2026 · 2 Scheiben · 60 Schuss“, Hinweis „auch 1 Scheibe Luftpistole“.
  - Zeilen in der Folge des Abends, Werte formatiert wie `CardList`; Ergebnis „30,0“ bzw. „29“.
  - `id` und `data-evening` je Abend; Abstand mit echtem Minus.
  - Keine Palette-Klassen.
  - Leere Liste: ein Satz „Keine Scheiben für diese Filter.“

### Task 5: Filter, Zeitraum-Chip und Querverweis (`list/ListControls.tsx`)

- `CardFilters` und Merkmal-Segmente (nur mit `flags`).
- Chip mit der Beschriftung von `resolveRange` und „×“, wenn `range` gesetzt ist („Letzte 90 Tage“,
  „Neue Munition“, „01.05.2026 – 30.06.2026“).
- Knopf „Verlauf dieser Filter“.
- Props: `query`, `families`, `flags`, `rangeLabel`, `onQuery(query)`, `onProgress()`.
- **Tests (Markup und Rückrufe über die Elemente):**
  - Ohne Merkmale kein Segment „Merkmal“.
  - „×“ ruft `onQuery` mit `range: null`.
  - Ein Familienwechsel behält Art und Merkmal und löscht den Zeitraum nicht.

### Task 6: „Alle in Scheiben zeigen“ im Fortschritt

- `CardList` bekommt optional `onShowAll`: ein Knopf unter der Tabelle.
- **Test:** Mit dem Rückruf erscheint der Knopf, ohne ihn nicht; das übrige Markup bleibt gleich.

### Task 7: Saison im Labor (D9)

- `cardId(target, day, slot = 0)`: Slot 0 ergibt dieselbe Id wie bisher.
- **Fünf Scheiben der Luftpistole** nach dem Hauptlauf, mit eigenem Generator:
  - eine zweite Scheibe an ihren letzten zwei Trainingstagen;
  - Mischabende an den letzten drei Samstagen mit Luftgewehr.
- `season.test.ts`:
  - Luftgewehr unverändert (Zahl und Ids gleich wie vorher, über einen festen Fingerabdruck: die Liste der Ids des
    Luftgewehrs gehasht).
  - Luftpistole 44 Scheiben.
  - Zwei Abende mit zwei Luftpistolen-Scheiben, drei Mischabende.
  - Ids weiter eindeutig.

### Task 8: Labor, Ansicht „Scheiben“

- **`LaborHeader`:** Ansicht „Scheiben | Scheibe | Zeitraum“ (`LaborMode` um `"list"` erweitert).
- **`App.tsx`:**
  - Zustand `list: ListQuery` (Familie wie der Zeitraum).
  - Öffnen aus der Liste (`openCard(listRoute)`).
  - „Zurück“ zur Liste: Liste aus `backRoute` wieder hergestellt, mit Scrollstelle.
  - „Verlauf dieser Filter“: Zeitraum aus `progressFromList` über `restore`, Ansicht Zeitraum.
  - „Alle in Scheiben zeigen“: Liste aus `listFromProgress`.
  - Ein Anker `#JJJJ-MM-TT` öffnet die Liste.
- **`ListView.tsx`:** Kopf („Scheiben“, Familie, Zahl), `ListControls`, `EveningList`; die Adresszeile ist
  `urlFromRoute(listRoute)`. Ein Mischabend-Hinweis wechselt die Familie und springt per `scrollIntoView` zum Abend.
- **`CardView.tsx`:** Der Rückweg heißt „Zurück zu „Scheiben““, wenn die Herkunft die Liste ist (über `backLabel`).
- **`testHook.ts`:** `exposeListForTest({ model, query })`.

### Task 9: Labor-Prüfung

- **Liste:**
  - Abende neueste zuerst, Zeilen in zeitlicher Folge.
  - Ergebnis, Ø und Abstand je Zeile gegen den Fachkern nachgerechnet.
  - Ein Mischabend nennt die andere Familie; Antippen wechselt sie, die Adresse hat dann `family=lp-freihand`.
  - Art „Wettkampf“ zeigt nur Wettkämpfe.
- **Öffnen und zurück:**
  - Die Adresse der Scheibe ist `from=list…`, der Rückweg heißt „Zurück zu „Scheiben““.
  - Zurück stellt Filter und Scrollstelle wieder her.
- **Querverweise:**
  - „Verlauf dieser Filter“ öffnet den Zeitraum „Alles“ der Familie.
  - „Alle in Scheiben zeigen“ aus „Neue Munition“ zeigt den Chip „Neue Munition“ (benannt, wie `resolveRange`), und
    „×“ entfernt ihn.
- **Telefon 375 px:** kein seitliches Scrollen, Zeilen ohne Uhrzeit und Abstand.
- Jede gezeigte Adresse übersteht Lesen und Schreiben.

### Task 10: Doku

- `shot-ui/CLAUDE.md`: Exporte und Regel „Scheiben-Liste“ (D1–D8 kurz).
- `tools/labor/CLAUDE.md`: drei Ansichten, Saison mit Mischabenden.
- **Vault:**
  - `spiegel-navigation.md` „Umgesetzt in N2“ mit dem offenen Punkt „kleine Scheiben“ (Einklappen und Fortschritt,
    nach echten Daten).
  - SF-11 in `spiegel-edge-cases.md`: Liste nach Abend gruppiert, Einklappen offen.
  - Roadmap SP-1.8: N2 erledigt.
  - `node .claude/vault-lint.mjs`.

## Teststeps

- **Test zuerst** für Task 1, 2 und 7 (reine Funktionen) mit den Handwerten oben. Markup-Tests für Task 3–6 im selben
  Commit.
- **Gegenproben:**
  - Ohne 4-Uhr-Grenze wird der Test 00:30 rot.
  - `deltasBefore` mit einem Fenster von 6 statt 5 macht den Handwert rot.
  - Der Mischabend-Hinweis ohne Familienwechsel macht die Labor-Prüfung rot.
- `pnpm check` nach jedem Task, mit echtem Exit-Code.

## Verification

- `pnpm check` grün, `node .claude/vault-lint.mjs` gültig.
- `pnpm --filter @vereinsheim/labor build` (direkt), `pruefen` mit 0 FAIL. Die bestehenden Prüfungen des Fortschritts
  bleiben unverändert grün (das Luftgewehr ist unverändert).
- **Sichtprüfung:**
  - Das Browser-Pane öffnet die Vorschau nicht mehr (über 512 KiB). Ansehen lässt sie sich nur im Artifact; was ich
    nicht selbst gesehen habe, steht als „nicht gesehen“ im Bericht.
  - Telefon 375 px über die Skriptprüfung.
- Artifact neu veröffentlichen.
- **Nicht im Umfang:**
  - Auswahl und Vergleichen (N4);
  - echte Navigation (N3);
  - Einklappen und Wertung „kleiner“ Scheiben (offen nach echten Daten).
