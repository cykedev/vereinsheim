# 3d: Ein später geholter Ausdruck ergänzt die übernommene Scheibe

Teilplan des Koordinationsplans [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md), Stufe 3.
Branch `feat/tis-3d-late-printout` vom Basisbranch `feat/treffsicher-in-spiegel`. Konzept und die zwei Texte hat der
User am 1. November 2026 freigegeben (Textbuch, Abschnitt „Später geholter Ausdruck (3d)“).

## Kontext

Die Übernahme (3a/3b) legt je Einheit aus Treffsicher eine Scheibe mit `origin: "treffsicher"` und `importKey` an. Ein
Meyton-Ausdruck, der an der Einheit hing, gab dabei seine Werte, wenn er passte (`printoutFits`, `adoptPrintoutValues`
in `apps/spiegel/src/lib/transfer/`). In der Prod-Kopie haben 122 von 128 übernommenen Scheiben keinen Ausdruck, 126
ein Gesamtergebnis. Holt der Schütze den Ausdruck später (Scan, Link, Upload oder `printout-import`), kennt Spiegel
keine Scheibe mit dieser ID und legt heute eine zweite Scheibe an. Der Abend steht dann doppelt in Spiegel.

An 8 Abenden der Prod-Kopie gibt es mehrere übernommene Scheiben derselben Disziplin. Tag und Disziplin allein reichen
also nicht, das Gesamtergebnis entscheidet.

## Ansatz (freigegebenes Konzept)

- **Wo:** nur auf den Wegen mit Datei, also Scan oder Link, Upload (`fetchCard` mit `file`) und `printout-import`
  (`importPrintoutIn`). Eine getippte ID ohne PDF hat keine Werte und sucht nicht.
- **Wann:** nach „keine eigene Scheibe dieses Abends, nicht fremd, nicht gesperrt“ und vor dem Blatt „Neue Scheibe“ bzw.
  dem Anlegen. In `fetchCard` nur ohne eigene Löschsperre an diesem Abend (`relifts` falsch). Mit Sperre bleibt alles
  wie heute.
- **Welche Scheiben:** die des Kontos mit `origin: "treffsicher"`, `deletedAt: null`, `sourceId: null`, deren Abend
  (`eveningDay(startedAt)`) der Abend des Ausdrucks ist. Ob eine passt, entscheidet `printoutFits` wie in 3a:
  - Lesung `ok`,
  - gleicher Abend,
  - gleiche Zahl der Schüsse,
  - gleiches Gesamtergebnis in der Wertung der Scheibe.

  Die Wertung kommt aus der aktuellen Revision: `TENTH`, wenn `totalDecimalTenths` gesetzt ist, sonst `WHOLE`. Schüsse
  aus `totalShots`. Eine Scheibe ohne `totalShots` passt nie. Ein Ausdruck im Modus Probe zählt als Wertung
  (`scoringReading`, Entscheidung aus 3a). Das gilt statt der alten Zeile „ein reiner Probe-Ausdruck passt nie“ im
  Koordinationsplan. Seriensummen vergleicht `printoutFits` nicht. Das ist bewusst so, die Regel ist dieselbe wie bei
  der Übernahme.
- **Genau eine passt:** Sperre der Scheibe (`lockCard`), Ausdruck anhängen (`attachPrintout`), Werte als neue Revision
  (`adoptPrintoutValues`). Die Scheibe behält ihre ID, Links aus dem Tagebuch bleiben also. Kein Blatt. Wird die
  Scheibe nach „vom Ausdruck“ übernommen (`adopted`), kommt die Meldung (Text 1). Gibt der Ausdruck keine Werte, die
  die Scheibe nimmt (`noValues`, `invalid` …), hängt er ohne Werte an. Dann kommt die bestehende Meldung „Ausdruck an
  die Scheibe gehängt.“.
- **Auftrag an die Brücke:** Auf dem Weg `fetchCard` bekommt die gefundene Scheibe einen offenen Auftrag
  (`CardRequest` mit `cardId`, gleiche ID und gleicher Tag), wie jede Scheibe vom Ausdruck ohne Quelle. So kann die
  Anlage später Rohdaten liefern. Ein älterer offener Auftrag ohne Scheibe für dieselbe ID und denselben Tag bekommt
  die Scheibe, wie im Zweig `created`. `printout-import` legt wie heute keinen Auftrag an (alte Abende).
- **Keine passt:** wie heute.
- **Mehrere passen:** Spiegel rät nicht. Wie heute entsteht eine neue Scheibe, und das Blatt „Neue Scheibe“ zeigt oben
  Text 2. `printout-import` legt an und zählt den Fall.
- **Übernahme bleibt, wie sie ist:** `placeAttachment` (`transfer/write.ts`) ruft `importPrintoutIn` für Ausdrucke
  ohne Scheibe der Einheit. Dort darf nicht gesucht werden, sonst hinge ein Lauf der Übernahme Ausdrucke an fremde
  Einheiten. `importPrintoutIn` bekommt dafür die Option `matchTransferred` (Vorgabe `true`), die Übernahme übergibt
  `false`.

### Texte (Textbuch, freigegeben)

1. Meldung nach dem Holen, wenn genau eine passt und ihre Werte gelten: „Ausdruck an die Scheibe aus Treffsicher vom
   {Tag} gehängt. Seine Werte gelten jetzt.“ {Tag} wie in der Zeile des Blatts (`dayText` in `ScanScreen`,
   `formatWeekdayDate`).
2. Satz oben im Blatt „Neue Scheibe“, wenn mehrere passen: „Mehrere Scheiben aus Treffsicher von diesem Abend passen zu
   diesem Ausdruck. Spiegel legt eine neue Scheibe an. Die übrigen bleiben, wie sie sind.“

Beide stehen in `apps/spiegel/src/lib/fetch-card/texts.ts` und laufen durch die Tests der Schreibregeln
(`texts.test.ts`).

## Dateien

- **Neu:** `apps/spiegel/src/lib/fetch-card/transferred.ts` mit `transferredCardsFitting(tx, { userId, day, timeZone,
  file })`. Sie liefert `{ kind: "none" } | { kind: "one"; cardId: string } | { kind: "several" }`. Dazu
  `adoptIntoTransferred(tx, { cardId, ownerId, file })`. Sie sperrt, hängt an, übernimmt und liefert `{ values:
  boolean }`. Beide Wege nutzen nur diese zwei Funktionen.
- `printoutFits` (heute `apps/spiegel/src/lib/transfer/printout-fit.ts`, samt Test) und `adoptPrintoutValues` (heute
  in `transfer/write.ts`) ziehen nach `fetch-card/transferred.ts` bzw. dessen Test. Grund: `transfer/write.ts`
  importiert schon aus `fetch-card/`, ein Import in die Gegenrichtung ergäbe einen Kreis
  (`import.ts` → `transferred.ts` → `transfer/write.ts` → `import.ts`). Die Kommentare sagen danach, dass die Regel für
  die Übernahme und für spätere Ausdrucke gilt.
- `apps/spiegel/src/lib/transfer/write.ts`, `apps/spiegel/src/parts/transfer/check.ts` und
  `apps/spiegel/src/lib/printouts/apply.test.ts`: importieren beides aus `fetch-card/transferred`. In `transfer/write.ts` übergibt `placeAttachment`
  `matchTransferred: false` an beide Aufrufe von `importPrintoutIn`.
- `apps/spiegel/src/lib/fetch-card/queries.ts`, `fetchCard`:
  - `FetchResult` bekommt `{ kind: "matched"; cardId: string; day: string; values: boolean }`.
  - `choose` bekommt `several: boolean`.
  - Ein Treffer erzeugt den Auftrag wie oben.
- `apps/spiegel/src/lib/fetch-card/import.ts`:
  - `ImportResult` bekommt `{ kind: "matched"; cardId: string; values: boolean }`.
  - `created` bekommt `several: boolean`.
  - Dazu die Option `matchTransferred`.
- `apps/spiegel/src/lib/fetch-card/actions.ts`: `matched` und `several` durchreichen. `FetchOutcome` in `texts.ts`
  bekommt dieselben.
- `apps/spiegel/src/lib/fetch-card/texts.ts`:
  - `fetchToast(outcome, dayText)` mit Text 1 für `matched` mit `values`, sonst „Ausdruck an die Scheibe gehängt.“.
  - `SEVERAL_TRANSFERRED` (Text 2).
- `apps/spiegel/src/components/scan/ScanScreen.tsx`: `several` ins Blatt. Nach `matched` zur Scheibe
  (`/cards/<id>`). `fetchToast` bekommt `dayText`.
- `apps/spiegel/src/components/scan/NewCardSheet.tsx`: Prop `several`, Text 2 als eigener Absatz direkt unter dem Satz
  oben (`data-new-card-several`, Stil wie `data-new-card-relift`).
- `apps/spiegel/tools/printout-import.ts`: Label `matched: "an Scheibe aus Treffsicher"`, Zähler „mehrere passend, neu
  angelegt“.
- Tests:
  - `fetch-card/transferred.test.ts` (neu),
  - `queries.test.ts`, `import.test.ts`, `texts.test.ts`, `transfer/write.test.ts`,
  - Markup-Test des Blatts, falls es einen gibt, sonst einen kleinen in `components/scan/`.
- Doku:
  - `vault/spiegel/spiegel-assignment.md` (Scheibe holen),
  - `vault/meyton/meyton-printout.md` („Alte Ausdrucke einlesen“),
  - `vault/spiegel/spiegel-account-transfer.md` (Abschnitt „Später geholter Ausdruck“),
  - `apps/spiegel/CLAUDE.md`, falls „Scheibe holen“ dort beschrieben ist.

  Den Nachtrag in `vault/decisions/adr-033.md` schreibt der Koordinator bei der Übernahme.

## Required Docs

- `vault/spiegel/spiegel-account-transfer.md` (Übernahme, `printoutFits`, Revisionen).
- `vault/spiegel/spiegel-assignment.md` (Scheibe holen, eigene Scheibe des Abends, Aufträge).
- `vault/meyton/meyton-printout.md` (Leser, Werte, „Alte Ausdrucke einlesen“).
- `vault/decisions/adr-033.md` (Teile und ihre Grenze, Nachträge zur Übernahme).
- `vault/conventions.md` §9: „Tests gegen die Dev-Datenbank fassen nur eigene Zeilen an“, „Prüfen und Löschen gehören
  in dieselbe Transaktion“, „Mocks filtern nach der Bedingung“, „Eigenschaftstests per Mutation gegenprüfen“.
- `apps/spiegel/CLAUDE.md`.

## Aufgaben

1. **Suche** `transferredCardsFitting` mit Tests gegen eine eigene Testanlage (wie `import.test.ts`). Die Fixtures
   decken ab:
   - eine passende Scheibe,
   - eine mit anderem Ergebnis,
   - eine mit anderer Schusszahl,
   - eine am Vorabend,
   - eine im Papierkorb,
   - eine `pdf`-Scheibe mit gleichem Ergebnis (darf nicht zählen),
   - eine fremde Scheibe,
   - zwei passende (`several`),
   - `TENTH` gegen `WHOLE`,
   - einen Ausdruck im Modus Probe.

   Gegenprobe: Mit vertauschter Wertung oder ohne Filter auf `origin` wird ein Test rot.
2. **Übernehmen** `adoptIntoTransferred`, Test: Die Scheibe behält ihre ID, `origin` wird `pdf`, Revision 1 bleibt, die
   neue Revision trägt die Werte des Ausdrucks. Ohne passende Werte hängt der Ausdruck an, `values` ist falsch.
3. **`fetchCard`:** Treffer vor `choose`, Auftrag, `several` im `choose`. Tests:
   - ein Treffer ohne Wahl ergibt `matched` mit Auftrag und ohne neue Scheibe,
   - mehrere ergeben `choose` mit `several`, danach mit Wahl `created`,
   - eigene Löschsperre: kein Treffer,
   - ein zweites Holen desselben Ausdrucks ergibt `opened` (eigene Scheibe über den Fuß).
4. **`importPrintoutIn`:** `matchTransferred`, `matched`, `several`. Tests für beide Werte der Option. Test in
   `transfer/write.test.ts`: Ein Ausdruck ohne Scheibe der Einheit hängt sich bei der Übernahme nicht an eine andere
   übernommene Scheibe.
5. **Texte und Oberfläche:** `texts.ts`, `actions.ts`, `ScanScreen`, `NewCardSheet`. Texttests (Wortlaut, Schreibregeln)
   und ein Markup-Test: Das Blatt zeigt Text 2 nur mit `several`.
6. **`printout-import`:** Label und Zähler. Probelauf gegen die Dev-Datenbank (siehe Test steps).
7. **Doku:** Vault-Notes und `apps/spiegel/CLAUDE.md`, `vault-lint` grün.

## Test steps

- `pnpm check` (alle fünf Gates) grün.
- Mutationsproben (Konvention §9), je aus einer Sicherungskopie zurückgespielt, nicht über `git checkout`:
  - Filter `origin: "treffsicher"` entfernen,
  - `several` als `one` behandeln,
  - `matchTransferred` in `placeAttachment` auf `true`.

  Jede muss einen Test rot machen.
- **Probelauf** `pnpm --filter spiegel printout-import <ordner> --email <Konto> --dry-run` gegen die Dev-Datenbank (Prod-Kopie). Er schreibt
  nichts, die Transaktion rollt zurück. Ordner sind die eigenen Ausdrucke des Users in iCloud („Schießen“). Das Konto
  nennt der Koordinator. Im Bericht steht, wie viele `matched`, wie viele mit `several` und wie viele wie bisher.
  Keine Namen und keine Werte von Personen in Bericht oder Commit.
- **Browser** auf eigenem Port des Worktrees, angemeldet als der User:
  - Upload eines Ausdrucks, der zu einer übernommenen Scheibe passt: Meldung mit Text 1, die Seite der Scheibe zeigt
    den Ausdruck und die neue Revision.
  - Danach dasselbe PDF noch einmal: „Die Scheibe liegt schon in Spiegel.“

  Schreiben in die Dev-Datenbank nur nach Signal des Koordinators. Der User muss vorher sagen, welche Scheibe dafür
  verändert werden darf. Gibt es keinen passenden Fall in den Daten, steht das als „nicht belegt“ im Bericht, mit dem
  Test, der den Pfad abdeckt.
- Keine Skriptprüfung nötig: Die Seite „Scheibe holen“ ändert ihr Markup nur im Blatt. Läuft sie trotzdem, dann nur
  nach Signal.

## Verification

- Eine übernommene Scheibe mit passendem Ausdruck wird nicht verdoppelt. Ihre ID bleibt, Links aus dem Tagebuch
  bleiben.
- Bei mehreren passenden Scheiben ändert sich keine davon.
- Die Übernahme selbst verhält sich unverändert (Test in `transfer/write.test.ts`).
- Eine getippte ID ohne PDF verhält sich unverändert.
- Keine Migration. Die Brücke braucht kein Update (kein Vertrag geändert).
