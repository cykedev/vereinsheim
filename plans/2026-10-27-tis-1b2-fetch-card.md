# 1b-2 · Scheibe holen: eine Seite für Kamera, Link, PDF und ID

Teil 1b-2 aus [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md) (Stufe 1, QR-Weg SP-1.7 b).
Branch `feat/tis-1b2-fetch-card`, abgezweigt von `main` (Stufe 1 geht Teil für Teil nach `main`). Diesen Plan als ersten
Commit übernehmen (`git show feat/treffsicher-in-spiegel:plans/2026-10-27-tis-1b2-fetch-card.md`). **Interaktiv, nicht
autonom:** Schema und Migration sowie `vault/decisions/` sind geschützte Pfade. Diese Tasks tragen **[geschützt]**, dort
holt die Kindsession die Freigabe über die koordinierende Session. Zur selben Zeit ändert keine andere Kindsession das
Schema von Spiegel. Die Dev-Datenbank ist eine Prod-Kopie: nie zurücksetzen, kein `migrate dev`, kein `db-reset`.

## Context

Mit dem User entschieden (Koordinationsplan Stufe 1 → 1b, Nachtrag ADR-028 vom 26. Oktober, Entscheidungen vom
27. Oktober). Nicht wieder aufmachen:

- **Eine Seite „Scheibe holen“** unter `/scan` mit vier Wegen: Kamera (QR auf dem Ausdruck), eingefügter Link, ein
  einzelnes PDF und eine eingetippte ID mit Tag. Jeder Weg geht gleich:
  - Liegt die eigene Scheibe des Abends schon in Spiegel, öffnet Spiegel sie. Ein PDF hängt dann nur an (SF-43,
    `attachPrintout`).
  - Sonst wählt der Schütze Disziplin und Art, vorbelegt mit seiner letzten Scheibe. Die Scheibe entsteht sofort
    („wartet auf die Anlage“) und öffnet sich.
  - An ihr hängt ein `CardRequest` (`cardId`). Die Brücke füllt sie mit Rohdaten.
  - Was mit dem Auftrag passiert, steht **an der Scheibe**.
  - „Scheibe per ID holen“ und die Liste der Aufträge im Profil entfallen.
- **Navigation:** Der Eintrag in der Mitte heißt „Scheibe holen“, kurz „Holen“, mit `ScanQrCode`. Er ist eingeschaltet.
- **Ohne Vorschau und ohne Bestätigung.** Beim Einlesen prüft Spiegel automatisch:
  - Gleicher Abend und erster Schuss vor der Druckzeit.
  - Fällt die Prüfung durch, speichert Spiegel nichts von der Brücke. Der Auftrag endet mit `printMismatch`, „passt nicht
    zum Ausdruck“.
  - Bei einer getippten ID ohne PDF prüft Spiegel nur den Abend.
  - Die Zustimmung eines anderen Kontos geht weiter vor.
- **Entfernen entfernt nur den Auftrag**, nie Scheibe oder PDF. Löschen der Scheibe ist der normale Papierkorb.
- **Ausdrückliches Holen hebt nur die eigene Löschsperre auf.** Grabsteine und Sperren anderer Konten bleiben.
- **Keine Liste erlaubter Adressen.** Es gelten die Grenzen aus 1b-1.
- **Die ID vom Ausdruck steht leise an der Seite der Scheibe**, nicht auf `/share`.
- **PDF nur für den Besitzer über eine eigene Route**, nicht für Scheiben im Papierkorb.
- **Offen aus 1b-1:**
  - Die Sperre des Aufräumens hängt an „keine Scheibe“ statt an `printout.count() === 0`.
  - `printoutFile` liefert nichts für Scheiben im Papierkorb.

Geprüft am Code (`main` 38fc63b6):

- **`ingestBatch` würde eine zweite Scheibe anlegen.** Weder `adaptKey` noch `writeAdapted` noch `writeRevision` geben
  eine `cardId` weiter. Eine Scheibe vom Ausdruck hat `sourceId`/`scheibenId` null, `findCard` findet sie nicht. Der Weg,
  Rohdaten in eine Scheibe vom Ausdruck zu schreiben, steht seit 1a-1 bereit (`identityUpdate`, neue Revision ohne
  „korrigiert“), wird aber nie benutzt.
- **Drei Stellen halten „hat eine Scheibe“ für „ist geholt“:**
  - `finishRequests` schließt offene Aufträge, deren Scheibe `final` ist. Eine Scheibe vom Ausdruck ist von Anfang an
    `final` (`writeEnteredCardIn`), der Auftrag wäre beim nächsten Heartbeat „geholt“.
  - `expireRequests` schließt „mit Scheibe“ als `done`.
  - `recordRequestOutcomes` schließt `missing`/`held`/`mismatch` nur „ohne Scheibe“, ein `missing` käme also nie an.
  - Dazu schließt der Heartbeat alles mit `cardId: null`. Mit 1b-2 haben alle neuen Aufträge vom Anlegen an eine Scheibe.
- **Fremde Uhrzeiten:** `startOf(snapshot)` (`startHintMs`) ist die Wanduhr der Anlage als UTC-Felder. `Printout.printedAt`
  ist ein echter Zeitpunkt (`storePrintout` rechnet die Wanduhr über `zonedWallTimeMs` um). `adaptSnapshot.startedAtMs`
  ist ein echter Zeitpunkt *mit* Uhrkorrektur. Verglichen wird deshalb die Wanduhr mit der Wanduhr; dafür fehlt in
  `@vereinsheim/lib/format` die Umkehrung von `zonedWallTimeMs`.
- **Der Grund „wartet auf die Anlage“** (`detailReason` in `shot-ui/detail.ts`) folgt allein der Herkunft `printout`.
  Nach „nicht gefunden“ oder nach dem Entfernen des Auftrags wäre er falsch.
- **Der Rahmen hat keinen Platz für eine Kurzbezeichnung der Aktion.** Die Aktion in der Mitte der unteren Leiste zeigt nur
  das Symbol (`design2/app-frame`, wie „Neue Einheit“ in Treffsicher). `short` braucht dort niemand.
- **Fundbüro:** ADR-028 und `spiegel-assignment` nennen das Fundbüro (SP-2.4) heute „Scheibe holen“. Mit dem neuen Namen
  der Seite heißt es in der Doku nur noch „Fundbüro“.
- **Kein Vertrag ändert sich.** `GET /state` nennt Aufträge weiter als `{ id, scheibenId, day }`, der Heartbeat meldet
  `sent`/`missing`/`held`/`mismatch`. `printMismatch` entsteht nur in Spiegel. **Keine neue Brücke.**
- **Body-Grenze passt.** Server Actions nehmen 12 MB (`@vereinsheim/config/next`), Caddy 5 MiB. Ein Upload bis 1 MiB geht
  über eine Server Action.
- **Keine Sicherheitsköpfe gesetzt.** Spiegel setzt weder CSP noch `Permissions-Policy` (Next-Config, Caddyfile). Die
  Kamera auf derselben Herkunft braucht keinen Kopf.

## Approach

### Entschieden in diesem Plan (technisch)

1. **Ablauf in zwei Aufrufen ohne Zustand auf dem Server.**
   - Jeder Weg ruft eine Server Action mit der Quelle (Link, Datei, ID+Tag) und optional der Wahl
     (`{ disciplineId, kind }`) auf.
   - Liegt die Scheibe schon da, öffnet die Action sie sofort.
   - Ist sie neu und fehlt die Wahl, antwortet die Action `choose`, ohne etwas zu schreiben. Die Seite öffnet das Blatt
     „Neue Scheibe“ und schickt dieselbe Quelle mit der Wahl noch einmal.
   - Der Ausdruck wird dabei zweimal geholt und gelesen (rund 40 KB, ein Kindprozess). Dafür braucht es kein Token und
     keine Annahme über die Frist des Aufräumens (die Datei des ersten Aufrufs ohne Zeile räumt
     `removeOrphanPrintoutFiles` nach zehn Minuten ab). Derselbe Ausdruck ergibt dieselbe Datei (sha256).
2. **Herkunft bei getippter ID: `pdf`.**
   - `raw` setzt eine Quelle und Rohdaten voraus (`writeRevision`).
   - `writeEnteredCard` schreibt nur `pdf`/`manual`/`treffsicher`.
   - Nur `pdf` darf Rohdaten bekommen (`identityUpdate`).
   - Die ID stammt vom Ausdruck in der Hand des Schützen, „vom Ausdruck“ stimmt also. Grund „wartet auf die Anlage“ und
     Filter „Vom Ausdruck“ gelten unverändert.
   - Kein neuer Wert im Enum.
3. **Beginn einer neuen Scheibe:**
   - Mit PDF: die Druckzeit.
   - Ohne PDF: 12 Uhr des genannten Tags in der Zone der Anlage (sicher im Abend, der um 4 Uhr beginnt).
   - Den echten Beginn schreibt die Brücke.
   - Der Abend des Auftrags ist `eveningDay(printedAt, site.timeZone)` bzw. der getippte Tag.
4. **Prüfung der Druckzeit beim Einlesen** (`startsBeforePrint`):
   - Bedingung: `startOf(snapshot) ≤ wallTimeOfMs(printedAt) + 5 min`, mit der jüngsten Druckzeit der Ausdrucke an der
     Scheibe.
   - Fünf Minuten Spielraum, weil Druck und Stand an verschiedenen Rechnern der Anlage hängen können (SF-29). Gegen
     Zufallstreffer reicht das.
   - Geprüft wird je Auftrag über den ganzen Stapel. Besteht ihn kein Stand dieses Abends, endet der Auftrag mit
     `printMismatch` und kein Stand wird abgelegt (`no-consent`).
   - Geprüft wird nur, solange die Scheibe noch keine Rohdaten hat.
5. **Welcher Block füllt die Scheibe (SF-03, SF-72):**
   - Mit Druckzeit: der jüngste Block, dessen Beginn vor dem Druck liegt.
   - Ohne Druckzeit (getippte ID): der jüngste Block des Stapels.
   - Frühere Blöcke werden wie heute eigene Scheiben des Auftraggebers. Spätere Blöcke (Neustart nach dem Druck) kommen in
     späteren Stapeln als neue Scheiben dazu, wie bei jedem Auftrag.
   - Gefüllt wird nur, wenn es für diese ScheibenID im Zyklus noch keine Scheibe gibt (`latest` fehlt).
6. **Disziplin und Art einer gefüllten Scheibe** (Art entschieden mit dem User am 27. Oktober 2026):
   - Die gewählte Disziplin schreibt `Card.disciplineId`. Mit den Rohdaten gilt die Disziplin des Stands, wie bei jeder
     Scheibe der Brücke: Die Wahl am Stand ist ein schneller Griff, der Stand weiß es genauer.
   - Die gewählte Art schreibt `Card.kind` **und** `Card.kindChoice` (die Wahl des Schützen, wie über `KindToggle`). Sie
     bleibt nach dem Einlesen, denn der Stand meldet an der Vereinsanlage keine Art (`Status` leer) und fiele sonst auf
     „Training“ zurück. Es gilt weiter `kindChoice ?? ranking.kind ?? kind` (`kindOfRow`).
   - Was der Schütze danach auf der Seite umstellt (`chooseCardDiscipline`, `KindToggle`), bleibt wie heute.
7. **„Gefüllt“ (`filled`) heißt: Die Scheibe des Auftrags hat eine Quelle** (`card.sourceId != null`). Alle Regeln der
   Aufträge unterscheiden danach, nicht mehr nach `cardId`:
   - Heartbeat (`missing`/`held`/`mismatch`) schließt nur ungefüllte.
   - `finishRequests` schließt nur gefüllte, endgültige.
   - `expireRequests`: gefüllt `done`, sonst `expired`.
   - Beim Einlesen schließen andere Abende, „vergeben“ und „gehalten“ nur ungefüllte. Ein gefüllter Auftrag bleibt bis
     „endgültig“ oder Frist offen.
   - Ältere Aufträge ohne Scheibe (Profil, Prod) laufen auf dem bisherigen Weg weiter (neue Scheibe der Brücke,
     `attachRequestCard`).
8. **Entfernen eines Auftrags setzt `withdrawn`**, statt die Zeile zu löschen. So behält eine Scheibe aus einer getippten
   ID ihre ID, und ein erneutes Holen findet sie wieder. Unsichtbar ist der Auftrag ab dann (`requestShown`).
9. **Erneutes Holen einer eigenen, ungefüllten Scheibe** ohne offenen Auftrag legt einen neuen Auftrag an. Das ist der
   Rückweg nach „Nicht mehr holen“ und nach „nicht gefunden“.
10. **Die Grenze von zehn offenen Aufträgen** zählt nur ungefüllte. Gefüllte warten nur noch auf „endgültig“.
11. **Wiederfinden der eigenen Scheibe des Abends** (in der Sperre der Kontozeile, in einer Transaktion):
    - Zuerst eine Scheibe der Brücke über Quelle und ScheibenID.
    - Sonst eine eigene Scheibe vom Ausdruck mit einem Auftrag (beliebiger Zustand) dieser ID und dieses Tags.
    - Sonst eine mit einem Ausdruck dieser ID (`Printout.footerId`), deren Abend passt.
    - Ein offener älterer Auftrag ohne Scheibe für dieselbe ID und denselben Tag bekommt die neue Scheibe, statt einen
      zweiten anzulegen.
12. **Eigene Scheibe in Offen** (wartet auf „Ja, meine“): Das PDF hängt an, die Seite führt nach „Offen“.
13. **Eigene Scheibe im Papierkorb:** Holen stellt sie wieder her und öffnet sie (entschieden mit dem User am 27. Oktober 2026). Nach 30 Tagen meldet
    Spiegel wie `restoreCard`, dass es nicht mehr geht.
14. **Beim Löschen der Sperre:** `fetchCard` löscht im selben Lauf, der die Scheibe anlegt, die `DeleteLock`-Zeilen des
    Kontos für Anlage, ScheibenID und Abend. Gibt es für denselben Abend einen Grabstein oder die Sperre eines anderen
    Kontos, bleibt alles, wie es ist („lässt sich nicht holen“).
15. **Endgültiges Löschen** (`purgeCards`) setzt offene Aufträge der Scheibe auf `withdrawn`. Sonst holte die Brücke eine
    Scheibe vom Ausdruck, die ohne Quelle keine Sperre hinterlässt, auf dem alten Weg als neue Scheibe zurück.
16. **Kein Dialog für Anlegen, Anhängen und Aufheben der Sperre.** Holen ist der ausdrückliche Wunsch, und Rückweg ist
    Löschen. Bei aufgehobener Sperre sagt das Blatt „Diese Scheibe hattest du gelöscht. Spiegel holt sie wieder.“
    `DecisionDialog` gibt es für „Nicht mehr holen“ und „Entfernen“ eines beendeten Auftrags (§10).
17. **Kamera:** natives `BarcodeDetector` (Chrome auf Android und Desktop), sonst `jsqr` 1.4.0 (Apache-2.0, reines JS,
    rund 45 KB, nur auf `/scan` dynamisch geladen) auf einem Bild aus dem Video bzw. dem Foto.
    - Verworfen wurde `barcode-detector`/`zxing-wasm` (MIT, gepflegt). Es braucht rund 1 MB WASM, lädt es ab Werk von
      jsDelivr (für eigene Herkunft müsste die Datei in den Build), und mit einer CSP käme `wasm-unsafe-eval` dazu.
    - Verworfen wurde `qr-scanner` (seit 2022 ohne Release).
    - `jsqr` ist seit 2021 unverändert. QR auf Papier ist gelöst, die Bibliothek steckt hinter einer Funktion
      (`src/lib/scan/qr.ts`) und ist dort mit einem Test austauschbar.
    - Kein `Permissions-Policy`-Kopf nötig. Die Kamera geht nur über HTTPS oder `localhost`.
18. **Der Platz von ID, PDF und Auftrag** sind Zeilen im Kasten „Diese Scheibe“ (`CardActions`/`ActionRow`), vor
    Disziplin: „Ausdruck“ und „Von der Anlage“. 1a-2 hat den eigenen Platz für den Ausdruck entfernt. Die Zeilen dort
    zeigen schon „was gerade gilt“ mit Aktion rechts, und `/share` rendert den Kasten nicht. Gleiches steht so an
    derselben Stelle.
19. **Der Grund ohne Werte folgt dem Auftrag.** `waiting` geht neben `provenance` durch die Ansichten. Eine Scheibe vom
    Ausdruck ohne offenen ungefüllten Auftrag heißt „ohne Werte“ statt „wartet auf die Anlage“. Ohne Angabe bleibt
    `waiting` wahr (Treffsicher, bisherige Tests).
20. **PDF-Route** `GET /api/printouts/<id>`:
    - Logik in `src/lib/printouts/http.ts` (Muster der Ingest-API: `Request` hinein, `Response` heraus, testbar ohne
      Next).
    - Nur über `printoutFile` mit `VISIBLE_CARD`, also nicht im Papierkorb, nicht wartend und nicht bei ignorierter
      Disziplin, wie die Seite der Scheibe.
    - Antwort `inline`, Name `ausdruck-<id>.pdf`, `Cache-Control: private, no-store`, `nosniff`.
21. **Mitte der unteren Leiste nur mit Symbol**, Name „Scheibe holen“ für Screenreader, wie „Neue Einheit“ in
    Treffsicher; `short: "Holen"` steht trotzdem im Code. Sichtbarer Text unter dem Kreis änderte den gemeinsamen Rahmen.
22. **`AppFrame` verliert `scan`.** Spiegel war der einzige Nutzer von `scan={false}`.
23. **Ältere Aufträge in Prod:** Offene Aufträge ohne Scheibe stehen auf `/scan` unter den Wegen („Ältere Aufträge“, mit
    „Nicht mehr holen“), bis sie enden. Danach steht nirgends etwas.
24. **Doku:** Das Fundbüro heißt nur noch „Fundbüro“ (SP-2.4, später ein weiterer Weg auf derselben Seite).

### Bewusst offen

- **Nachdruck an einem späteren Tag:** Der Abend kommt aus der Druckzeit. Ein Ausdruck, an einem anderen Tag aus der
  Ablage gedruckt, endet mit „an diesem Tag nicht gefunden“ (wie getippt mit falschem Tag).
- **Rennen:** Kommt zwischen dem Anlegen und dem ersten Stand über eine Zustimmung desselben Kontos schon eine Scheibe der
  Brücke für denselben Block, füllt der Auftrag die Scheibe vom Ausdruck nicht. Sie endet nach 30 Tagen „ohne Antwort“.
  Das Fenster ist ein einzelner Stapel.
- **Uhrzeit ohne PDF:** Eine Scheibe aus getippter ID zeigt bis zum Einlesen 12:00.

### Neue Texte

Ein Textbuch gibt es nicht. Diese Liste ist die Vorlage für den Code. Tests halten Wortlaut, Semikolons und `OLD_WORDS`
(„Sperre“, „Ablage“ u. a.) fern.

**Navigation**

| Ort | Text |
| --- | --- |
| Seitenleiste (Pille), Name des runden Knopfs | Scheibe holen |
| `FrameItem.short` | Holen |
| `metadata.title` von `/scan` | Scheibe holen |

**Seite `/scan`**

| Element | Text |
| --- | --- |
| Titel | Scheibe holen |
| Satz | Mit dem QR-Code, dem Link, dem PDF oder der ID vom Ausdruck. Liegt die Scheibe schon in Spiegel, öffnet Spiegel sie. |
| Kamera: Titel | QR-Code scannen |
| Kamera: Satz | Halte die Kamera auf den QR-Code am Stand oder auf dem Ausdruck. |
| Kamera: Knöpfe | Kamera starten / Kamera beenden / Foto aufnehmen |
| Kamera verweigert | Spiegel darf die Kamera nicht nutzen. Erlaube sie in den Einstellungen des Browsers oder nimm ein Foto auf. |
| Keine Kamera, kein HTTPS | Dieses Gerät bietet hier keine Kamera an. Nimm ein Foto auf oder füge den Link ein. |
| Foto ohne Code | Auf dem Foto ist kein QR-Code zu erkennen. Versuche es näher und gerade von vorn. |
| Code ohne Link | Dieser QR-Code führt nicht auf einen Ausdruck. |
| Während des Lesens | Spiegel liest den Ausdruck… |
| Link: Titel / Feld / Platzhalter / Knopf | Link einfügen / Link aus dem QR-Code / http://… / Holen (beim Senden „Holen…“) |
| PDF: Titel / Satz / Knopf | PDF hochladen / Ein Ausdruck als PDF, etwa ein älterer. / PDF wählen |
| ID: Titel | ID eintippen |
| ID: Satz | Die ID steht unten auf dem Ausdruck, etwa „ID: ff914420“. |
| ID: Felder / Knopf | ID vom Ausdruck / Tag der Scheibe / Holen |
| ID: Feldfehler (bisheriger Wortlaut) | Die ID hat acht Zeichen aus Ziffern und a bis f, wie unten auf dem Ausdruck. |
| Tag: Feldfehler (bisheriger Wortlaut) | Bitte den Tag der Scheibe wählen, nicht nach heute. |
| Ältere Aufträge: Titel / Satz | Ältere Aufträge / Diese Scheiben hat Spiegel noch nicht von der Anlage geholt. |
| Ältere Aufträge: Zeile / Knopf | ff914420 · Di 21.10.2026 · wartet auf die Anlage / Nicht mehr holen |

**Blatt „Neue Scheibe“**

| Element | Text |
| --- | --- |
| Titel | Neue Scheibe |
| Satz | Diese Scheibe liegt noch nicht in Spiegel. Spiegel legt sie an und holt die Werte von der Anlage. Wähle Disziplin und Art. Liefert die Anlage die Scheibe, gilt ihre Disziplin. |
| Zeile zur ID | ID ff914420 vom Di 27.10.2026 |
| Nach aufgehobener Sperre | Diese Scheibe hattest du gelöscht. Spiegel holt sie wieder. |
| Gruppe der Art | Art (Knöpfe „Training“, „Wettkampf“ aus `KIND_TEXT`) |
| Ohne Vorbelegung | Wähle eine Disziplin. |
| Knopf | Scheibe anlegen (beim Senden „Anlegen…“) |

**Meldungen nach dem Holen (Toast)**

| Ausgang | Text |
| --- | --- |
| angelegt | Scheibe angelegt. Spiegel holt die Werte von der Anlage. |
| PDF angehängt | Ausdruck an die Scheibe gehängt. |
| ID einer vorhandenen Scheibe | Die Scheibe liegt schon in Spiegel. |
| aus dem Papierkorb | Scheibe aus dem Papierkorb geholt. |
| in Offen | Die Scheibe wartet in „Offen“. |

**Fehler (`fetchErrorText`, unter dem Weg, `role="alert"`)**

| Grund | Text |
| --- | --- |
| `badUrl` | Das ist kein Link auf einen Ausdruck. |
| `redirect`, `httpStatus`, `unreachable` | Der Ausdruck ließ sich nicht laden. Ist der Link älter als eine Woche, hat Meyton ihn gelöscht. |
| `timeout` | Der Ausdruck kam nicht rechtzeitig. Versuche es noch einmal. |
| `tooLarge` | Die Datei ist größer als 1 MB. Ein Ausdruck hat rund 40 KB. |
| `notPdf` | Das ist kein PDF. |
| `unreadable` | Spiegel kann dieses PDF nicht lesen. |
| `noId` | Auf dem Ausdruck steht keine ID. Ohne sie findet Spiegel die Scheibe nicht. |
| `idConflict` | Auf dem Ausdruck stehen verschiedene IDs. |
| `noTime` | Im PDF fehlt die Druckzeit. |
| `busy` | Spiegel liest gerade andere Ausdrucke. Versuche es gleich noch einmal. |
| `taken` | Diese Scheibe gehört schon zu einem anderen Konto. |
| `blocked` | Diese Scheibe lässt sich nicht holen. |
| `tooMany` | Es warten schon zehn Scheiben auf die Anlage. Warte, bis die Anlage sie geliefert hat. |
| `notAllowed` | Diese Disziplin steht nicht zur Wahl. Lade die Seite neu. |
| `trashExpired` | Die 30 Tage sind um. Die Scheibe lässt sich nicht mehr wiederherstellen. |
| ohne Anlage | Spiegel ist noch mit keiner Anlage verbunden. |
| ohne Sitzung | Das geht gerade nicht. Lade die Seite neu. |
| sonst | Die Scheibe ließ sich nicht holen. |

**Kasten „Diese Scheibe“**

Zeile „Ausdruck“:

- Mit PDF: „ID ff914420 · gedruckt Di 27.10.2026 um 19:52“, Link „PDF öffnen“ (Symbol `Download`).
- Weitere Ausdrucke darunter: „Weiterer Ausdruck, gedruckt Di 27.10.2026 um 20:31“ mit „PDF öffnen“.
- Ohne PDF: „ID ff914420“, darunter „Das PDF hängt an, wenn du den QR-Code unter „Scheibe holen“ scannst.“

Zeile „Von der Anlage“, Zustand und Satz (`REQUEST_STATUS_TEXT`, `REQUEST_STATUS_NOTE`):

| Zustand | Text | Satz |
| --- | --- | --- |
| offen, ungefüllt | wartet auf die Anlage | Spiegel holt die Werte, sobald die Anlage läuft. |
| offen, gefüllt | geholt, wird noch ergänzt | (kein Satz) |
| `missing` | nicht gefunden | Die Anlage hat keine Scheibe mit dieser ID. |
| `mismatch` | an diesem Tag nicht gefunden | Die Scheibe mit dieser ID lief an einem anderen Tag. |
| `printMismatch` | passt nicht zum Ausdruck | Die Scheibe der Anlage begann erst nach dem Druck. Spiegel hat nichts übernommen. |
| `held` | lässt sich nicht holen | Die Scheibe bleibt an der Anlage. |
| `taken` | gehört zu einem anderen Konto | Diese Scheibe bekommt ein anderes Konto über die Sportpassnummer. |
| `expired` | keine Antwort von der Anlage | Die Anlage hat sich 30 Tage nicht gemeldet. |
| `done` | geholt | (kein Satz) |
| `withdrawn` | zurückgezogen | (kein Satz) |

Knöpfe der Zeile: „Nicht mehr holen“ (offen, ungefüllt), „Entfernen“ (beendet, ungefüllt).

**Gründe ohne Werte**

- „ohne Werte“ (`noValues`, vorhanden) für eine Scheibe vom Ausdruck ohne offenen Auftrag.
- Satz im Gerüst (`emptyText`): „Für diese Scheibe gibt es nur den Ausdruck, noch keine Werte.“

**Nach der Durchsicht mit dem User (27. Oktober 2026)**

| Ort | Text |
| --- | --- |
| Link ohne Eingabe (Feldfehler) | Füge den Link aus dem QR-Code ein. |
| Blatt „Neue Scheibe“ ohne Wahl (Feldfehler, Knopf aktiv) | Wähle eine Disziplin. |
| Uhrzeit nicht bekannt (Liste, „–“ mit Grund) | ohne Uhrzeit |
| Serien ohne Werte / mit Gesamtergebnis | Noch keine Serien. / Keine Serien. |
| Schüsse ohne Werte / mit Summen | Noch keine Schüsse. / Keine Einzelschüsse. |
| Analyse ohne Werte | Noch keine Werte. |
| ohne „noch“, wenn keine Werte mehr kommen (eingetragen, kein offener Auftrag) | Keine Serien. / Keine Schüsse. / Keine Werte. |

Der Grund steht einmal deutlich in der Ergebnis-Box (und in „Von der Anlage“), die übrigen Stellen wiederholen ihn nicht.

**Dialoge** (`consequences.ts`)

`cardFetchStop({ id, when, card })`:

- Titel: „Nicht mehr holen?“
- Worum es geht: „Spiegel wartet auf die Werte der Scheibe vom {when} (ID {id}).“
- Was passiert: „Spiegel holt diese Scheibe nicht mehr von der Anlage.“
- Was nicht passiert: `card` ? „Die Scheibe bleibt in Spiegel, mit ihrem Ausdruck.“ : „Deine Scheiben bleiben.“, dazu
  „An der Meyton-Anlage ändert sich nichts.“
- Rückgängig: „Unter „Scheibe holen“ dieselbe Scheibe noch einmal holen.“
- Knopf „Nicht mehr holen“, destruktiv.

`cardFetchDismiss({ id, when, state })`:

- Titel: „Hinweis entfernen?“
- Worum es geht: „Spiegel hat die Werte der Scheibe vom {when} (ID {id}) nicht bekommen: {state}.“
- Was passiert: „Der Hinweis verschwindet von dieser Seite.“
- Was nicht passiert: „Die Scheibe bleibt in Spiegel, mit ihrem Ausdruck.“, „An der Meyton-Anlage ändert sich nichts.“
- Rückgängig: wie oben.
- Knopf „Entfernen“, nicht destruktiv.

`{when}` geht wie überall durch `spoken`.

Entfallen: `cardRequest`, `cardRequestWithdraw`, `cardRequestRemove`.

## Files

### Task 0 · Branch und Plan

- `git switch -c feat/tis-1b2-fetch-card main`
- `git show feat/treffsicher-in-spiegel:plans/2026-10-27-tis-1b2-fetch-card.md > plans/2026-10-27-tis-1b2-fetch-card.md`
- Commit: `docs(plans): plan fetching a card on one page (1b-2)`

### Task 1 · Wanduhr aus einem Zeitpunkt (`@vereinsheim/lib/format`)

- `packages/lib/src/format.ts`: `export function wallTimeOfMs(utcMs: number, timeZone: string): number` =
  `utcMs + zoneOffsetMs(utcMs, timeZone)` (ms bleiben). JSDoc: Umkehrung von `zonedWallTimeMs`, die Wanduhr der Zone als
  UTC-Felder (wie Meytons `datetime` in `startHintMs`).
- `packages/lib/src/format.test.ts`:
  - Berlin Sommer (+2 h) und Winter (+1 h).
  - Rundlauf `zonedWallTimeMs(wallTimeOfMs(t, z), z) === t` für einen Tag im Oktober 2026 in 15-Minuten-Schritten,
    außer in der doppelten Stunde am 25. Oktober.
  - Millisekunden bleiben.
- Commit: `feat(lib): wall time of an instant in a time zone`

### Task 2 · Offen aus 1b-1: Aufräumen und Lesen der Ausdrucke

- `apps/spiegel/src/lib/printouts/files.ts`:
  - `filesToRemove` nimmt `anyCard: boolean` statt `totalRows: number`. Regel: `!anyCard && files.some(PDF)` → `[]`.
  - `removeOrphanPrintoutFiles`: `const anyCard = (await db.card.findFirst({ select: { id: true } })) !== null`,
    `skipped` entsprechend.
  - JSDoc: „Gibt es gar keine Scheibe …“.
- `apps/spiegel/src/lib/printouts/queries.ts`, `printoutFile`:
  - `where: { id, card: { is: { ownerId, ...VISIBLE_CARD } } }` (Import aus `../db/visible`).
  - Liefert zusätzlich `hex: footerId`.
  - JSDoc: nicht wartend, nicht im Papierkorb, nicht bei ignorierter Disziplin, wie die Seite der Scheibe.
- Tests:
  - `files.test.ts`:
    - Tabelle der Ausdrucke leer, aber Scheiben da: die letzte verwaiste Datei geht.
    - Keine Scheibe: nichts geht.
  - `queries.test.ts`:
    - `printoutFile` für eine Scheibe im Papierkorb `null`.
    - Für eine Scheibe einer ignorierten Disziplin `null`.
    - Für den Besitzer sonst die Bytes.
- Commit: `fix(spiegel): sweep printouts unless there is no card, no printout file from the trash`

### Task 3 · Schema und Migration **[geschützt]**

- `apps/spiegel/prisma/schema.prisma`:
  - `enum CardRequestStatus`: `printMismatch` am Ende. Kommentar: „… an dem Abend nicht gefunden, passt nicht zum
    Ausdruck (begann nach dem Druck), gehört einem anderen Konto …“.
  - `model CardRequest`, Kommentar an `cardId`: „die Scheibe des Auftrags: beim Holen angelegt (vom Ausdruck, bis die
    Brücke sie füllt) oder bei älteren Aufträgen die geholte; null, solange keine da ist“.
  - Neuer Index `@@index([cardId])` mit Kommentar „Seite einer Scheibe und Übersichten: der Auftrag an einer Scheibe,
    `SET NULL` beim Löschen“.
- Migration (aus `apps/spiegel`):
  1. `pnpm --filter spiegel exec prisma migrate status` → aktuell. Sonst Stopp und melden.
  2. `mkdir prisma/migrations/20261027180000_card_request_print_mismatch`, dann
     `pnpm --filter spiegel exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/20261027180000_card_request_print_mismatch/migration.sql`.
     Kennt Prisma 7 die Option nicht, die Form aus `prisma migrate diff --help` nehmen. **Nie** `migrate dev`.
  3. Erlaubt sind genau `ALTER TYPE "CardRequestStatus" ADD VALUE 'printMismatch';` und
     `CREATE INDEX "CardRequest_cardId_idx" ON "CardRequest"("cardId");`. Sonst Stopp und melden.
  4. `pnpm --filter spiegel exec prisma migrate deploy`, dann `pnpm --filter spiegel exec prisma generate`.
  5. Gegenprobe: derselbe `migrate diff` ist leer, `migrate status` aktuell.
- Typen grün halten: `src/components/profile/CardRequests.tsx` `REQUEST_STATUS_TEXT` bekommt
  `printMismatch: "passt nicht zum Ausdruck"` (die Datei fällt in Task 15).
- Commit: `feat(spiegel): request status for a printout that does not match, index requests by card`

### Task 4 · Zustände eines Auftrags und Druckzeit (rein)

- `apps/spiegel/src/lib/card-requests/status.ts` (neu gefasst, ohne Datenbank):
  - `REQUEST_STATUS_TEXT: Record<CardRequestStatus, string>` und `REQUEST_STATUS_NOTE: Partial<Record<…>>`, Wortlaut aus
    „Neue Texte“.
  - `requestStateText(status, filled)`: offen und gefüllt „geholt, wird noch ergänzt“.
  - `requestShown(status, filled)`: ungefüllt und nicht `withdrawn`/`done`, oder gefüllt und `open`.
  - `requestRemovable(status, filled)`: ungefüllt und nicht `withdrawn`/`done`.
  - `REMOVABLE_STATUSES` und `isRemovable` entfallen.
- `apps/spiegel/src/lib/card-requests/id.ts`:
  - `export const PRINT_GRACE_MS = 5 * 60_000` (JSDoc: Druck und Stand an verschiedenen Rechnern der Anlage, SF-29).
  - `export const startsBeforePrint = (startWallMs: number, printedWallMs: number) => startWallMs <= printedWallMs + PRINT_GRACE_MS`.
- Tests:
  - `status.test.ts`: jede Kombination, Wortlaut, `OLD_WORDS` und `forbiddenWords` über alle Texte.
  - `id.test.ts`: Grenze genau bei fünf Minuten, eine ms darüber falsch.
- Commit: `feat(spiegel): request states for the card page and the print time rule`

### Task 5 · Aufträge: gefüllt statt „hat eine Scheibe“

`apps/spiegel/src/lib/card-requests/queries.ts`:

- Gemeinsame Bedingung `const UNFILLED = { OR: [{ cardId: null }, { card: { is: { sourceId: null } } }] }` mit JSDoc
  (Entscheidung 7).
- `expireRequests`: gefüllt (`card: { is: { sourceId: { not: null } } }`) → `done`, `UNFILLED` → `expired`.
- `finishRequests`: `card: { is: { state: "final", sourceId: { not: null } } }`.
- `recordRequestOutcomes`: `UNFILLED` statt `cardId: null`.
- `openRequestsFor` wählt dazu `cardId` und
  `card: { select: { sourceId: true, ownerId: true, printouts: { select: { printedAt: true } } } }`.
- `removeRequest` wird `dismissRequest(db, { userId, requestId, nowMs })`:
  - `updateMany` mit `id`, `userId`, `status: { notIn: ["withdrawn", "done"] }`, `UNFILLED`.
  - Setzt `status: "withdrawn", closedAt`, liefert `count === 1`.
- `withdrawRequest`, `requestCard`, `ownRequests`, `OwnRequest`, `RequestResult` entfallen. `requestSiteId`,
  `MAX_OPEN_REQUESTS`, `REQUEST_DAYS` bleiben.

`apps/spiegel/src/lib/db/purge.ts`, `purgeCards`:

- Vor `card.deleteMany` je Scheibe
  `tx.cardRequest.updateMany({ where: { cardId: card.id, status: "open" }, data: { status: "withdrawn", closedAt: new Date() } })`,
  für beide Zweige (mit und ohne Quelle).
- Kommentar: Eine Scheibe vom Ausdruck hinterlässt keine Sperre. Ein offener Auftrag holte sie sonst zurück.

Tests:

- `queries.test.ts`:
  - Frist: ungefüllt mit Scheibe → `expired`, gefüllt → `done`.
  - `finishRequests` lässt eine ungefüllte `final` Scheibe vom Ausdruck offen.
  - `recordRequestOutcomes` schließt `missing` an einer ungefüllten Scheibe, nicht an einer gefüllten.
  - `dismissRequest`: offen und beendet ungefüllt → `withdrawn`. Gefüllt offen, `done` und fremd → false. Die Scheibe
    bleibt.
- `src/lib/db/purge.test.ts`: Endgültig löschen setzt den offenen Auftrag auf `withdrawn`, einen beendeten nicht.
- `src/lib/card-requests/actions.ts` und `actions.test.ts` bleiben bis Task 9 (sie rufen nur noch `requestCard` auf). Damit
  das Gate grün bleibt, in diesem Task `requestCardAction`/`withdrawCardRequest` und ihre Tests entfernen und
  `removeCardRequest` auf `dismissRequest` umstellen. `CardRequests.tsx` zeigt bis Task 15 nur noch die Liste ohne
  Formular (`ProfileScreen` übergibt `[]`, die Seite ruft `ownRequests` nicht mehr).
- Commit: `refactor(spiegel): requests distinguish filled cards, removing a request withdraws it`

### Task 6 · Einlesen: Druckzeit prüfen, die Scheibe vom Ausdruck füllen

`apps/spiegel/src/lib/ingest/ingest.ts`:

Vor der Schleife:

- `const unfilled = (r) => r.cardId === null || r.card?.sourceId === null`.
- `fillOf(r)` = `r.cardId` wenn `r.card?.sourceId === null && r.card.ownerId === r.userId`, sonst null.
- `printedWall: Map<number, number>`: je Auftrag mit Druckzeiten an der Scheibe
  `wallTimeOfMs(max(printedAt), target.timeZone)`.
- `passes: Set<number>`: Aufträge, für die ein Stand des Stapels mit derselben ScheibenID, `eveningOfStart(startOf(s)) === r.day`
  und `startsBeforePrint(startOf(s), printedWall)` existiert.

In der Schleife:

- `close` nimmt auch `"printMismatch"`.
- Anderer Abend und „vergeben“ schließen nur `unfilled(r)`.
- Nach der Prüfung der fremden Sportpassnummer:
  `if (claim && unfilled(claim) && printedWall.has(claim.id) && !passes.has(claim.id)) { await close(claim.id, "printMismatch"); claim = undefined }`.
- `held` schließt nur `unfilled(claim)`.
- `toAdapt`-Eintrag bekommt `fill?: { cardId: string; printedWallMs: number | null }` aus dem Auftrag
  (`fillOf(claim)`, sonst vorhandenes `fill`).
- `claims` merkt `cardId`.

`adaptKey(…, fill?)`, wenn `fill` gesetzt ist und `latest` fehlt:

- Erst `db.card.findFirst({ where: { id: fill.cardId, sourceId: null, origin: "pdf" }, select: { id: true } })`. Fehlt
  sie, ohne `fill` weiter.
- Ziel ist der Index in `ends` des jüngsten Blocks mit
  `startsBeforePrint(startOf(adapted[end.index].item.snapshot), fill.printedWallMs)`. Ohne Druckzeit oder ohne Treffer
  das letzte Ende.
- Nur dieses Ende schreibt mit `fill.cardId`.
- `Placement` bekommt `fill?: string`.
- `writeAdapted` gibt `cardId: fill` an `writeRevision` weiter.

Schleife nach dem Schreiben:

- Für einen Auftrag mit `cardId`: `db.card.findUnique({ where: { id }, select: { sourceId: true, state: true } })`.
  Gefüllt und `final` → `closeRequest(done)`, sonst nichts (kein `attachRequestCard`).
- Ältere ohne `cardId` wie bisher.
- Modulkopf und JSDoc nachziehen.

Tests in `apps/spiegel/src/lib/ingest/requests.test.ts`, neuer `describe("Scheibe vom Ausdruck")`:

- Hilfen:
  - `pdfCard(day, printedAt | null)` über `writeEnteredCard` (Herkunft `pdf`, Disziplin der Testanlage) und
    `attachPrintout` mit erfundener `StoredPrintout` (sha256 aus 64 Hex-Zeichen, `hex: printedId(id)`), dazu ein
    `CardRequest` mit `cardId`.
  - Druckzeiten aus `startHintMs` der Stände über `zonedWallTimeMs`.
- Fälle:
  1. Gedruckt nach den Schüssen: dieselbe `cardId` trägt Quelle, ScheibenID, `origin: "raw"`, `place: null`, zwei
     Revisionen, die Disziplin des Stands. Keine zweite Scheibe. Auftrag offen mit derselben `cardId`.
  2. Gedruckt sechs Minuten vor dem ersten Schuss: kein `RawSnapshot` der Kennung, Auftrag `printMismatch`, Scheibe
     unverändert `pdf`.
  3. Drei Minuten vor dem ersten Schuss: gefüllt.
  4. SF-03 (`as(sent("SF-03"), …)`):
     - nach beiden Blöcken gedruckt → die Scheibe vom Ausdruck ist Block 1, Block 0 eine eigene neue Scheibe;
     - zwischen den Blöcken gedruckt → Block 0, Block 1 neu.
  5. Ohne Ausdruck (getippte ID): gefüllt. Ein Stand eines anderen Abends schließt einen gefüllten Auftrag nicht.
  6. Zustimmung eines anderen Kontos: `taken`, Scheibe unverändert.
  7. Heartbeat `missing`: an der ungefüllten Scheibe vom Ausdruck geschlossen, an einer gefüllten nicht.
  8. `finishRequests`: ungefüllt bleibt offen, gefüllt und endgültig `done`.
  9. Endgültig gelöscht, dann ein Stand: verworfen (`no-consent`), keine Scheibe.
- Mutationsprobe (§9): `startsBeforePrint` testweise auf `true` → Fall 2 rot. `fill` testweise weglassen → Fall 1 rot
  (zwei Scheiben).
- Commit: `feat(spiegel): fill the printout card from the bridge after checking the print time`

### Task 7 · Brücke Ende zu Ende mit Scheiben vom Ausdruck

- `apps/spiegel/tools/bridge-e2e.ts`:
  - Der Auftrag `REQUESTED` hängt an einer Scheibe vom Ausdruck mit Druckzeit jetzt (`writeEnteredCard` +
    `attachPrintout`).
  - `REQUESTED_UNKNOWN` hängt an einer ohne Ausdruck.
  - `REQUESTED_EMPTY` bleibt ein älterer ohne Scheibe.
  - Erwartet:
    - `fetched.cardId` ist die Scheibe vom Ausdruck und hat jetzt eine Quelle; keine zweite Scheibe mit `REQUESTED`;
    - `unknown` `missing` an seiner Scheibe vom Ausdruck (bleibt ohne Quelle);
    - `empty` `missing` wie bisher.
  - Kommentar und Ausgabe nachziehen.
- Lauf: `pnpm --filter spiegel bridge-e2e` (braucht Docker und Go) grün. Ergebnis im Bericht.
- Commit: `test(spiegel): bridge end to end fills printout cards`

### Task 8 · Holen: Kern ohne Oberfläche

`apps/spiegel/src/lib/fetch-card/queries.ts` (neu):

- `newCardChoices(db, { userId, siteId })` → `{ options: NewCardOption[]; preset: { disciplineId: number | null; kind: CardKind } }`:
  - Optionen: `discipline.findMany` mit `siteId`, `confirmedAt: { not: null }`, `ignoredAt: null`,
    `familyId: { not: null }`, `targetId: { not: null }`. Nur Scheibenbilder mit `Object.hasOwn(TARGETS, …)`. Sortiert
    nach Familie und Name. `NewCardOption = { id, name, family }`.
  - Vorbelegung: `card.findFirst({ where: { ownerId, ...VISIBLE_CARD }, orderBy: { startedAt: "desc" } })` (Index
    `ownerId, startedAt`), Disziplin nur, wenn sie unter den Optionen ist. Art über `kindOfRow(row, false)`, ohne Scheibe
    `training`.
- `fetchCard(db, input: FetchInput): Promise<FetchResult>` mit:
  - `FetchInput = { userId, siteId, scheibenId, day, file: StoredPrintout | null, choice: { disciplineId: number; kind: CardKind } | null, nowMs? }`.
  - `FetchResult = opened{cardId, attached} | restored{cardId} | pending | choose{relifts} | created{cardId, relifted} | taken | blocked | tooMany | notAllowed | trashExpired`.
- Eine Transaktion. Zuerst ``SELECT id FROM "User" WHERE id = … FOR UPDATE``, die Zeitzone der Anlage, dann:
  1. Eigene Scheibe nach Entscheidung 11. Abend über `eveningDay(startedAt, site.timeZone)`. Für Ausdrucke
     `printouts: { some: { footerId: printedId(scheibenId) } }`.
     - Wartend: Ausdruck anhängen, `pending`.
     - Im Papierkorb: nach 30 Tagen `trashExpired`, sonst `deletedAt: null` (Bedingung im Befehl, §9), anhängen,
       `restored`.
     - Sichtbar: anhängen. Ist sie ungefüllt ohne offenen Auftrag, neuen Auftrag anlegen (Grenze), `opened`.
  2. Fremde Scheibe der Brücke an diesem Abend → `taken`.
  3. Grabsteine und Sperren anderer Konten dieses Abends → `blocked`.
  4. Eigene Sperren dieses Abends merken (`relifts`).
  5. Ohne `choice` → `choose`, nichts geschrieben.
  6. Mit `choice`:
     - Disziplin gegen dieselbe Bedingung wie `newCardChoices` prüfen (`FOR SHARE`), sonst `notAllowed`.
     - Ungefüllte offene Aufträge des Kontos zählen, ab `MAX_OPEN_REQUESTS` → `tooMany`.
     - Eigene Sperren löschen.
     - `writeEnteredCardIn(tx, { ownerId, origin: "pdf", disciplineId, startedAtMs, kind, details: {}, reason: "printout" })`
       mit `startedAtMs` nach Entscheidung 3.
     - Die Art zusätzlich als `kindChoice` (neuer optionaler Parameter `kindChoice` an `writeEnteredCardIn`, in derselben
       Transaktion). Test: nach dem Füllen durch einen Stand mit Art „training“ liefert `kindOfRow` die gewählte Art.
     - `attachPrintout`.
     - Offenen älteren Auftrag ohne Scheibe für ID und Tag umhängen, sonst neuen anlegen.
     - `created`.
- `legacyRequests(db, userId)`: offene Aufträge ohne Scheibe → `{ id, hex, day }[]`, neueste zuerst. `expireRequests`
  vorher.
- `cardFetchInfo(db, { cardId, ownerId })`, nur für eine eigene, sichtbare Scheibe, sonst null. Liefert
  `{ hex: string | null; printouts: { id; printedAtMs }[]; request: { id; status; filled; hex; day } | null }`:
  - `hex` aus `scheibenId` (mit Quelle), sonst `footerId` des jüngsten Ausdrucks, sonst `scheibenId` des jüngsten
    Auftrags.
  - `request` der jüngste Auftrag mit `requestShown`.

Tests in `apps/spiegel/src/lib/fetch-card/queries.test.ts` (eigene Anlage über `createTestSite`; ein zweites Konto):

1. Neu ohne Wahl: `choose`, keine Scheibe, kein Auftrag, Sperre bleibt.
2. Neu mit PDF und Wahl: Scheibe `pdf` mit Druckzeit, Disziplin und Art; eine `Printout`-Zeile; Auftrag offen mit
   `cardId`, Tag aus der Druckzeit.
3. Getippte ID: 12 Uhr des Tags, kein Ausdruck, Auftrag.
4. Derselbe Ausdruck noch einmal → `opened`, eine Zeile. Ein zweiter Ausdruck derselben ID → zwei Zeilen. Kein zweiter
   Auftrag.
5. Eigene Scheibe der Brücke → `opened`, Ausdruck hängt, kein Auftrag.
6. Im Papierkorb → `restored`. Älter als 30 Tage → `trashExpired`.
7. Wartend → `pending`.
8. Fremde Scheibe → `taken`, nichts geschrieben.
9. Fremde Sperre und eigener Grabstein → `blocked`.
10. Eigene Sperre → `choose` mit `relifts`. Mit Wahl ist die Zeile weg, `created` mit `relifted`. Mit fremder Sperre
    desselben Abends `blocked`, eigene bleibt.
11. Zehn ungefüllte offene → `tooMany`. Gefüllte zählen nicht.
12. Älterer offener Auftrag ohne Scheibe → bekommt die `cardId`, kein zweiter.
13. Nach `dismissRequest` holen → `opened` mit neuem offenem Auftrag.
14. Ignorierte, fremde oder familienlose Disziplin → `notAllowed`.
15. Zwei gleichzeitige `fetchCard` mit demselben Ausdruck und Wahl (`Promise.all`) → eine Scheibe.

Weitere Tests:

- `newCardChoices`: Vorbelegung aus der jüngsten sichtbaren Scheibe; ignorierte Disziplin nicht vorbelegt.
- `cardFetchInfo`: `hex` aus jeder Quelle; `withdrawn` nicht gezeigt; fremde Scheibe null.

Commit: `feat(spiegel): fetch a card by printout or id, find or create it with its request`

### Task 9 · Texte und Actions

`apps/spiegel/src/lib/admin/consequences.ts`:

- `cardFetchStop`, `cardFetchDismiss` (Wortlaut aus „Neue Texte“).
- `cardRequest`, `cardRequestWithdraw`, `cardRequestRemove` entfernen.
- `consequences.test.ts` nachziehen (Wortlaut, Schreibregeln).

`apps/spiegel/src/lib/fetch-card/texts.ts` (rein):

- `fetchErrorText(reason: FetchFailure | StoreRejection | FetchRefusal): string`.
- `fetchToast(outcome)`.
- Test `texts.test.ts`: jeder Grund hat einen Text, `OLD_WORDS`.

`apps/spiegel/src/lib/fetch-card/actions.ts` (`"use server"`, nur direkt deklarierte async-Funktionen):

- `fetchCardByLink(url: string, choice: NewCardChoice | null)`.
- `fetchCardByUpload(form: FormData)`: Felder `file`, `disciplineId`, `kind`. `File` prüfen, Größe vor `arrayBuffer`.
- `fetchCardById(id: string, day: string, choice: NewCardChoice | null)`: Feldfehler wie bisher. `validDay` zieht aus dem
  alten `card-requests/actions.ts` um.
- `stopCardFetch(requestId: number)`: `dismissRequest`.
- Alle Actions:
  - `shooterId()`, `requestSiteId`, Zeitzone der Anlage;
  - `fetchPrintout` → `storePrintout({ bytes, timeZone: site.timeZone, fileName })` → `fetchCard`;
  - Ergebnis `ActionResult<FetchOutcome>` mit `choose { hex, day, relifts }`;
  - danach `revalidatePath("/", "layout")`, nie werfen;
  - Fehler nur mit Namen ins Log.
- `apps/spiegel/src/lib/card-requests/actions.ts` und `actions.test.ts` löschen.

Test `apps/spiegel/src/lib/fetch-card/actions.test.ts`:

- Aufbau wie das bisherige `card-requests/actions.test.ts` (Sitzung gemockt), `UPLOAD_DIR` im Temp-Verzeichnis wie
  `store.test.ts`, Ausdruck aus `buildPdf` über einen lokalen `createServer` wie `fetch.test.ts`.
- Fälle:
  - ohne Sitzung;
  - Feldfehler der ID;
  - Link → `choose`, dann mit Wahl `created`;
  - Upload zu groß → Text `tooLarge`;
  - Upload kein PDF → `notPdf`;
  - `stopCardFetch` fremd → Fehler.
- Ohne Anlage in der Dev-Datenbank (`site.count() === 0`) die Fälle mit Anlage überspringen wie heute.

Commit: `feat(spiegel): actions and texts for fetching a card`

### Task 10 · `waiting` durch die Ansichten (shot-ui)

`packages/shot-ui/src/detail.ts`:

- `DetailInput.waiting?: boolean`.
- `detailReason`: bei `printout` ohne Werte `input.waiting === false ? "noValues" : "waiting"`.
- `emptyText(provenance, waiting?)`: `printout` und `waiting === false` → „Für diese Scheibe gibt es nur den Ausdruck,
  noch keine Werte.“
- `levelReasons(…, waiting?)` entsprechend.
- Hilfe `noValuesReason(provenance, waiting)` als eine Stelle für alle drei.

Durchreichen neben `provenance`, jeweils nur `waiting: false`, wenn gesetzt:

- `list/evenings.ts` (Eingabe und Aufruf von `detailReason`).
- `period/item.ts` (`waiting?: false`).
- `period/fromProjection.ts`.
- `period/model.ts:437`, `period/basis.ts:34`.
- `start/model.ts:144`.
- `readout/CardSummary.tsx` (`SummaryCard.waiting`).
- `compare/model.ts:224` (Seite mit `waiting`, `noValuesReason`).

Tests:

- `detail.test.ts`: Fälle `waiting` undefined/true/false.
- Je ein Fall in `list/evenings.test.ts`, `period/basis.test.ts`, `readout/CardSummary.test.tsx`: „ohne Werte“ statt
  „wartet auf die Anlage“.
- `words.test.tsx`/`season.test.ts` unverändert grün (keine neuen Felder bei gemessenen).

Commit: `feat(shot-ui): a printout card without an open request has no values instead of waiting`

### Task 11 · `waiting` in Spiegel und Demo-Auftrag

`apps/spiegel/src/lib/db/reads.ts`:

- `openRequestCardIds(db, ids)`: offene, ungefüllte Aufträge an diesen Scheiben (`cardId: { in }`, Index aus Task 3).
- In `ownerCards`, `familyCards`, `cardWithShots` für Scheiben mit `origin === "pdf"` `waiting: false` setzen, wenn keine
  in der Menge ist. Bei `sharedCard` ebenso, die geteilte Seite zeigt denselben Grund.
- `OverviewCard.waiting?: false`, `PageCard.waiting?: false`.

Durchreichen:

- `src/lib/pages.ts:39`.
- `src/lib/compare.ts:172` (`waiting: { a, b }` wie `provenance`).
- `src/components/card/CardScreen.tsx:419` an `SummaryResult`, `levelReasons`, `emptyText`.

`apps/spiegel/tools/seed-own.ts` (nur `--demo`):

- Nach den Demo-Scheiben bekommt die Scheibe `level: "none"` einen offenen Auftrag: vorherige Aufträge dieser Scheibe
  löschen, dann `CardRequest` mit ID `7fff0a00` (`decodePrintoutId`), Tag `eveningDay(startedAtMs, site.timeZone)`,
  `cardId`.
- Dazu eine eigene Sperre des Demo-Kontos für `7fff0a03`: `deleteLock.upsert`, Quelle der Dev-Anlage, Zyklus 0,
  `startedAt: new Date("2026-10-01T17:00:00Z")`.
- Ausgabe der Zahlen.

Tests:

- `reads.test.ts`: eine Scheibe vom Ausdruck mit offenem Auftrag ohne `waiting`. Nach `dismissRequest` `waiting: false`.
  Gemessene ohne Feld.

Commit: `feat(spiegel): show whether a printout card still waits for the bridge`

### Task 12 · PDF-Route

`apps/spiegel/src/lib/printouts/http.ts` (neu), `printoutResponse(db, printoutId, userId | null): Promise<Response>`:

- Ohne Konto 401.
- Kennung nicht `cuid`-förmig (`/^c[a-z0-9]{20,}$/`) 404.
- Sonst `printoutFile`, ohne Treffer 404.
- Treffer: `Content-Type: application/pdf`, `Content-Disposition: inline; filename="ausdruck-<hex>.pdf"`,
  `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.

`apps/spiegel/src/app/api/printouts/[id]/route.ts`: `GET` mit `getAuthSession()`, ruft nur `printoutResponse`.
`proxy.ts` deckt den Pfad schon ab (Anmeldung).

Test `http.test.ts`: Besitzer 200 mit den Köpfen und den Bytes; anderes Konto 404; Papierkorb 404; wartend 404; Datei fehlt
404; ohne Konto 401.

Commit: `feat(spiegel): owner-only route for printout files`

### Task 13 · Kasten „Diese Scheibe“: Ausdruck und Holen

`apps/spiegel/src/components/card/DisciplineChoice.tsx` (neu):

- Aus `CardDiscipline` herausgezogen: `byFamily`, `OPTION`, eine Gruppe von Knöpfen mit `aria-current`.
- Props `options: { id; name; family; note?: string; current: boolean }[]`, `onChoose`.
- `CardDiscipline` nutzt sie (Markup unverändert, `CardDiscipline.test.tsx` grün).

`apps/spiegel/src/components/card/CardPrintout.tsx` (neu):

- `ActionRow` „Ausdruck“ mit `data-card-printout`, `data-printed-id`.
- Links `a[data-printout-file]` auf `/api/printouts/<id>` mit `target="_blank" rel="noopener"`, Symbol `Download`.
- Wortlaut aus „Neue Texte“, Zeiten über `formatWeekdayDate`/`formatTimeOfDay` mit `timeZone`.

`apps/spiegel/src/components/card/CardFetch.tsx` (neu):

- `ActionRow` „Von der Anlage“ mit `data-card-fetch`, `data-fetch-status`.
- Knopf nach `requestRemovable`/Zustand, `DecisionDialog` mit `cardFetchStop` bzw. `cardFetchDismiss`, `stopCardFetch`,
  danach `router.refresh()`, Fehler als `role="alert"`.

`CardActions.tsx`:

- Neue Prop `fetch: CardFetchInfo | null`.
- Zeilen in der Folge Ausdruck (wenn `hex` oder Ausdrucke), Von der Anlage (wenn `request`), Disziplin, Teilen, Löschen.
- JSDoc nachziehen.

`CardScreen.tsx`: `own.fetch` durchreichen. `src/app/(app)/cards/[id]/page.tsx`: `fetch: await cardFetchInfo(db, { cardId: id, ownerId })`.

Tests:

- `CardActions.test.tsx`:
  - Folge der Zeilen.
  - Ohne ID keine Zeile „Ausdruck“.
  - Mit `printMismatch` „passt nicht zum Ausdruck“ und „Entfernen“.
  - Offen und gefüllt ohne Knopf.
- `CardPrintout.test.tsx`: ID klein auf acht Zeichen, Link-Adresse, zweiter Ausdruck.
- `CardScreen.test.tsx`: geteilte Seite ohne `data-card-printout`.

Commit: `feat(spiegel): printout, id and fetch state on the card page`

### Task 14 · QR lesen

- `apps/spiegel/package.json`:
  - `"jsqr": "1.4.0"` (dependencies);
  - `"qrcode": "1.5.4"`, `"@types/qrcode": "1.5.6"` (devDependencies, Versionen wie Ringwerk);
  - `pnpm install`, danach `pnpm install --frozen-lockfile` (§9). Den Lockfile-Diff auf fremde Importer prüfen.
- `apps/spiegel/src/lib/scan/qr.ts`:
  - `qrLink(text)`: getrimmt, nur `http:`/`https:`, höchstens 2.048 Zeichen, sonst null.
  - `fitSize(width, height, max)`.
  - `decodePixels(data, width, height, { both })` über `await import("jsqr")` (`inversionAttempts`: Video
    `dontInvert`, Foto `attemptBoth`).
  - `createQrReader()`: natives `BarcodeDetector`, wenn `getSupportedFormats()` `qr_code` nennt, sonst Canvas auf höchstens
    640 px (Video) bzw. 1.600 px (Foto) und `decodePixels`.
  - Ohne React. Kommentar zur Wahl (Entscheidung 17).
- `qr.test.ts`:
  - `qrLink`-Fälle;
  - `fitSize`;
  - ein QR aus `QRCode.create(url).modules` als RGBA mit Rand → `decodePixels` liefert die Adresse;
  - leeres Bild → null.
- Commit: `feat(spiegel): read a qr code from a camera frame or a photo`

### Task 15 · Seite „Scheibe holen“ ohne Kamera

`apps/spiegel/src/app/(app)/scan/page.tsx`:

- Server: `requireSession`, `newCardChoices`, `legacyRequests`, `today` (`formatIsoDate`), `timeZone`.
- `metadata.title` „Scheibe holen“.
- `src/components/shell/Placeholder.tsx` löschen (einziger Nutzer).

`apps/spiegel/src/components/scan/ScanScreen.tsx`:

- `Page`, `PAGE_SINGLE`, Kopf wie Profil.
- Blöcke als Karten (`rounded-2xl border bg-card p-4`) in der Folge Kamera (Platz für Task 16), Link, PDF, ID, je
  `data-fetch-way` und Fehler `data-fetch-error`.
- Felder `#fetch-link`, `#fetch-upload` (`type=file`, `accept="application/pdf"`), `#fetch-id`, `#fetch-day`, gesteuert
  (§9).
- Je Block ein eigenes `pending`.
- `submit(source, choice)`:
  - `choose` → Blatt;
  - `opened`/`created`/`restored` → `toast.success(fetchToast)` und `router.push("/cards/<id>")`;
  - `pending` → `/open`.

`NewCardSheet.tsx`:

- `Sheet` „Neue Scheibe“ mit `data-new-card`.
- Satz, Zeile zur ID, ggf. Satz zur Sperre.
- `DisciplineChoice` (Vorbelegung `current`), Art über `Segmented` mit `data-kind-option`.
- Knopf „Scheibe anlegen“ (ohne Disziplin gesperrt mit „Wähle eine Disziplin.“).

`LegacyRequests.tsx`:

- `data-legacy-requests`, Zeilen `data-legacy-request`.
- „Nicht mehr holen“ mit `cardFetchStop({ card: false })`.

Profil:

- `src/components/profile/CardRequests.tsx` und `CardRequests.test.tsx` löschen.
- `ProfileScreen` ohne `requests`/`today`, Profilseite ohne `ownRequests`.
- `ProfileScreen.test.tsx` nachziehen.

Tests:

- `ScanScreen.test.tsx`: vier Wege in der Folge, Felder mit Namen, ältere Aufträge nur mit Einträgen.
- `NewCardSheet.test.tsx`: Vorbelegung markiert, ohne Vorbelegung gesperrt, Satz zur Sperre.

Commit: `feat(spiegel): one page to fetch a card by link, upload or id`

### Task 16 · Kamera und Foto

`apps/spiegel/src/components/scan/CameraScan.tsx`:

- „Kamera starten“: `getUserMedia({ video: { facingMode: "environment" }, audio: false })`, `<video playsInline muted>`.
- Etwa alle 200 ms ein Bild lesen (`createQrReader`).
- Treffer: Spuren stoppen; `qrLink`, dann `onLink(url)`, sonst Text „Code ohne Link“.
- Stoppen bei Treffer, „Kamera beenden“, Unmount und `visibilitychange`.
- `NotAllowedError` → Text „verweigert“. Ohne `navigator.mediaDevices` oder `!isSecureContext` → Text „keine Kamera“.
- „Foto aufnehmen“ immer da: `<input type="file" accept="image/*" capture="environment">`, `createImageBitmap`, Leser mit
  `both`.
- Daten-Attribute `data-camera-start`, `data-camera-photo`.
- In `ScanScreen` einsetzen.

Test `CameraScan.test.tsx` (Markup): Knöpfe mit Namen. Die Bedienung prüft ein Mensch (headless keine Kamera).

Commit: `feat(spiegel): scan the qr code with the camera or a photo`

### Task 17 · Navigation

- `packages/shot-ui/src/layout/AppFrame.tsx`:
  - `ITEMS.scan = { label: "Scheibe holen", short: "Holen", Icon: ScanQrCode }`;
  - Prop `scan` und `BAR.filter` entfernen;
  - JSDoc „Scheibe holen ist die Aktion in der Mitte“.
- `AppFrame.test.tsx`:
  - `describe("ohne Scannen")` entfernen;
  - `aria-label="Scheibe holen"`;
  - Pille der Seitenleiste mit Text „Scheibe holen“;
  - fünf Felder.
- `apps/spiegel/src/components/shell/AppShell.tsx`: `scan={false}` und Kommentar entfernen.
- Commit: `feat(spiegel): fetch a card from the middle of the navigation`

### Task 18 · Skriptprüfung

`packages/pruefen/src/browser.ts`:

- `async setFiles(locator: Locator, paths: readonly string[]): Promise<void>`: `Runtime.evaluate` des Locators →
  `objectId`, dann `DOM.setFileInputFiles({ files, objectId })`, dann `Runtime.releaseObject`.
- JSDoc.

`apps/spiegel/tools/printout-sample.ts`:

- `export async function samplePrintout({ hex = "ff914420", printed = "2026-10-02T19:52:12+02:00" })`, `CreationDate`
  aus `printed` gebaut (`D:YYYYMMDDHHmmSS+HH'mm'`).
- Optionen `--id <hex>`, `--printed <iso>`.
- `main` nur bei `require.main === module`.

`apps/spiegel/tools/pruefen.ts`:

- Abschnitt „Scheibe per ID holen“ (`cardRequests`, `PROBE_REQUEST`) durch „Scheibe holen“ (`fetchCards`) ersetzen.
- Probe-IDs `7fff0a01` (Link), `7fff0a02` (getippt), `7fff0a03` (Sperre aus `seed:own --demo`, Tag `2026-10-01`).
- Vorweg: Reste abgebrochener Läufe unter `/cards?provenance=printout` an `[data-printed-id]` erkennen, löschen und im
  Papierkorb endgültig löschen.
- Ein lokaler `createServer` liefert `samplePrintout` unter `/print_<hex>.pdf`.
- Upload über eine Temp-Datei und `setFiles`.
- Tag über den nativen Setter mit `input`-Ereignis.

Prüfungen:

1. „Telefon: untere Leiste mit Holen in der Mitte“: Bereiche `start,cards,scan,progress,profile`, `aria-label` „Scheibe
   holen“. Ersetzt die bisherige in `openAndBar`. Am Desktop die Pille „Scheibe holen“.
2. `/scan`: vier Wege in der Folge. Kamera: Knopf vorhanden (Bedienung „nicht belegt: headless keine Kamera“).
3. Link `7fff0a01` (heute 19:30): Blatt „Neue Scheibe“ mit genau einer markierten Disziplin, die der jüngsten Scheibe des
   Demo-Kontos. „Scheibe anlegen“ führt auf `/cards/<id>`, dort:
   - Ergebnis „–“ mit „wartet auf die Anlage“;
   - `data-printed-id="7fff0a01"`;
   - `fetch(href)` des PDF-Links liefert `application/pdf`;
   - `data-fetch-status="open"`.
4. Upload eines zweiten Ausdrucks `7fff0a01` (20:10): ohne Blatt auf dieselbe Scheibe, zwei `a[data-printout-file]`.
5. ID `7fff0a02` mit heute: Blatt, Anlegen, Zeile „Ausdruck“ ohne PDF-Link, Auftrag wartet.
6. „Nicht mehr holen“: Dialog nennt „Die Scheibe bleibt in Spiegel“. Danach keine Zeile „Von der Anlage“, Grund „ohne
   Werte“, Scheibe da.
7. ID `7fff0a03` mit `2026-10-01`: Blatt mit „hattest du gelöscht“. Nach dem Anlegen fehlt der Eintrag vom 1. Oktober
   unter `[data-trash-blocked]`. Ohne Sperre: „nicht belegt: vorher seed:own --demo“.
8. Falsche ID zeigt den Feldfehler ohne Blatt.
9. Aufräumen: alle angelegten Scheiben löschen und im Papierkorb „Endgültig löschen“. Keine Probe-ID mehr in der Liste.

`main`: `section("Scheibe holen", () => fetchCards(page))` an der Stelle von „Scheibe per ID holen“. Fünf Minuten Grenze
prüfen.

Commit: `test(spiegel): script checks for fetching a card`

### Task 19 · Doku

`vault/spiegel/spiegel-assignment.md`:

- TL;DR (QR, Link, PDF, ID auf einer Seite „Scheibe holen“; Fundbüro heißt Fundbüro).
- Tabelle: Zeile „ID vom Ausdruck“ in „Scheibe holen“ aufgehen lassen, Zeile Fundbüro umbenennen.
- „Der QR-Weg im Detail“:
  - Schritte 1, 3, 4, 5 nach diesem Plan (Seite, Blatt, Druckzeit mit fünf Minuten, Block, Scheibe der Brücke gefüllt,
    Ausgänge an der Scheibe);
  - „Stand“: gebaut (1b-2).
- „Scheibe per ID“: getippte ID ist ein Weg der Seite. Sie legt eine Scheibe vom Ausdruck an, prüft nur den Abend, zeigt
  die Ausgänge an der Scheibe. Ältere Aufträge auf `/scan`. Entfernen setzt „zurückgezogen“.
- Keywords.

`vault/spiegel/spiegel-navigation.md`:

- TL;DR, Tabelle Bereiche (`/scan` „Scheibe holen“, untere Leiste Mitte als Symbol, Seitenleiste als Pille).
- App-Rahmen ohne `scan={false}`.
- „Was noch fehlt“: Scannen und „Weiche Sperre aufheben“ erledigt (eigene Sperre bei ausdrücklichem Holen, Papierkorb
  wiederherstellen).
- Neuer Abschnitt „Ausdruck und Holen an der Scheibe“ (Zeilen im Kasten).
- Skizze: untere Leiste mit Holen.

`vault/spiegel/spiegel-ingest-pipeline.md`, Abschnitt „Auftrag per ID beim Einlesen“: gefüllt/ungefüllt, Druckzeit,
`printMismatch`, Block, `cardId` an `writeRevision`.

`vault/spiegel/spiegel-privacy.md`:

- „Scheibe per ID“ und Restrisiko: eigene Sperre fällt beim Holen, `requestCard` → `fetchCard`.
- Aufräumen: „gar keine Scheibe“.

`vault/spiegel/spiegel-roadmap.md`:

- SP-1.7 Status (b-2 erledigt; Vorschau und Bestätigung entfallen, ADR-028).
- SP-1.8 „Scannen kommt mit SP-1.7 b“ streichen.

`vault/architecture/architecture.md:54`: „Scheibe per ID holen“ → „Scheibe holen“.

`apps/spiegel/CLAUDE.md`:

- Aufbau: `/scan` „Scheibe holen“ in der Navigation.
- Regel „Scheibe per ID holen“ → „Scheibe holen“ (`src/lib/fetch-card/`, Entscheidungen 1 bis 16).
- Ausdrucke: `printoutFile` mit `VISIBLE_CARD`, PDF-Route, Aufräumen bei „keine Scheibe“.
- Ingest „Nichts ohne Zustimmung“: Druckzeit.
- Befehle: `printout-sample` mit `--id`/`--printed`.
- Skriptprüfung: „Scheibe holen“.

`packages/shot-ui/CLAUDE.md`:

- `AppFrame`-Zeile und Rahmen-Regeln (Namen, ohne `scan`).
- `detail`-Zeile (`waiting`).
- Symbole „Scheibe holen `ScanQrCode`“.

`packages/pruefen/CLAUDE.md`: `setFiles` in der Zeile `browser`.

Danach `/sync-graph`. Commit: `docs(spiegel): fetching a card on one page`

### Task 20 · ADR-028 Nachtrag **[geschützt: `vault/decisions/`]**

`vault/decisions/adr-028.md`:

- TL;DR: „„Scheibe holen“ ist der Rückfall“ → „das Fundbüro ist der Rückfall“, dazu „Nachtrag 27. Oktober: eine Seite
  „Scheibe holen““.
- Neuer Abschnitt „Nachtrag (27. Oktober 2026)“:
  - eine Seite mit vier Wegen, jeder gleich;
  - die getippte ID legt ebenfalls eine Scheibe an (Herkunft vom Ausdruck);
  - Eintrag „Scheibe holen“/„Holen“ in der Mitte der Navigation;
  - Druckzeit mit fünf Minuten Spielraum, welcher Block die Scheibe füllt;
  - Ausgänge an der Scheibe, Liste im Profil entfällt;
  - ausdrückliches Holen hebt die eigene Löschsperre auf und holt aus dem Papierkorb zurück;
  - das Fundbüro heißt nur noch Fundbüro.
- Keywords ergänzen.
- `vault/decisions/decisions.md` nur, wenn sich die Kurzbeschreibung dort auf „Scheibe holen“ als Fundbüro bezieht.
- Commit: `docs(adr): ADR-028 addendum, one page to fetch a card`

### Task 21 · Prüfung an der Prod-Kopie und im Browser

- `pnpm --filter spiegel seed:own --demo`, dann `pnpm check`, dann `pnpm --filter spiegel pruefen --start --alle`.
- Sichtprüfung im Browser (Telefon und Desktop, hell und dunkel): `/scan`, Blatt, Seite einer neuen Scheibe, Kasten,
  untere Leiste.
- Kamera am Telefon über HTTPS: `pnpm --filter spiegel exec next dev --webpack --port 3002 --experimental-https` (dem
  Zertifikat am Telefon vertrauen) oder nach dem Deploy auf der Subdomain. Ergebnis im Bericht, sonst „nicht belegt“.
- Dev-Datenbank: `SELECT status, (\"cardId\" IS NULL) AS legacy, count(*) FROM \"CardRequest\" GROUP BY 1, 2` als Zahl in
  `reports/` (Vorlage für Prod).

## Required Docs

- `CLAUDE.md`, `vault/conventions.md` §2 (Kasten „Diese Scheibe“, Bestätigungen), §3, §6, §9 (Formulare gesteuert,
  Prüfen und Schreiben in einer Transaktion, Mocks filtern, Mutationsprobe, `pnpm add`), §10 („Kein Knopf ohne Folge“,
  „So schreiben wir“).
- `apps/spiegel/CLAUDE.md` (Schichten, `VISIBLE_CARD`, Ingest-API, Scheibe per ID, Ausdrucke, Löschen, Skriptprüfung,
  Migrationen nur anhängen).
- `packages/shot-ui/CLAUDE.md` (AppFrame, Gerüst je Detailtiefe, Gründe), `packages/ui/CLAUDE.md` (`Sheet`, `Segmented`,
  `DecisionDialog`), `packages/pruefen/CLAUDE.md`.
- Koordinationsplan `plans/2026-10-26-treffsicher-in-spiegel.md` (Grundsätze, Stufe 1 → 1b).
- `vault/decisions/adr-028.md` (Nachtrag 26. Oktober), `vault/spiegel/spiegel-assignment.md`,
  `vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-ingest-pipeline.md`, `vault/spiegel/spiegel-privacy.md`,
  `vault/meyton/meyton-printout.md`.
- `.claude/skills/migrate/SKILL.md`, hier mit `migrate diff`/`migrate deploy` statt `migrate dev`.

## Test steps

1. `pnpm --filter @vereinsheim/lib test`, `pnpm --filter @vereinsheim/shot-ui test` grün.
2. `pnpm --filter spiegel test -- printouts card-requests fetch-card requests purge reads consequences CardActions scan`
   grün, danach `pnpm --filter spiegel test` ganz.
3. Mutationsproben aus Task 6 (und `filesToRemove` ohne die Bedingung `anyCard` → Test rot), danach zurück.
4. `pnpm --filter spiegel bridge-e2e` grün (Docker, Go).
5. `pnpm --filter spiegel seed:own --demo`, `pnpm build` (oder `pnpm check`), `pnpm --filter spiegel pruefen --start --alle`:
   Abschnitt „Scheibe holen“ und alle übrigen grün. „Detailtiefen“ zeigt weiter „wartet auf die Anlage“ (Demo-Auftrag).
6. Von Hand mit der Prod-Kopie, Testkonto oder Demo-Konto:
   - Link auf `printout-sample --id 7fff0a09` (lokaler Server);
   - danach in `psql` `Card.origin = 'pdf'`, `CardRequest.cardId` gesetzt, `Printout.printedAt` wie im PDF;
   - Seite der Scheibe öffnet das PDF.
7. `git diff main --stat`: nichts unter `apps/spiegel-bridge/`, `packages/ingest-contract/`, `compose.yml`, `Caddyfile`,
   `scripts/`.

## Verification

- Gate: `pnpm check` grün (lint, format:check, test, tsc, `next build`; Server Actions nur direkt deklarierte async-Funktionen).
- `pnpm --filter spiegel pruefen --start` ohne FAIL. Kamera und Foto im Bericht als von Hand geprüft oder „nicht belegt“,
  mit den Tests, die den Pfad decken (`qr.test.ts`).
- Migration: `migrate status` aktuell, zweiter `migrate diff` leer, nur `ADD VALUE` und `CREATE INDEX`.
- Vertrag unverändert, keine neue Brücke (`git diff main -- packages/ingest-contract apps/spiegel-bridge` leer).
- **Vor dem Deploy** (Koordinationsplan): den Speicher des Lesers im echten Image auf dem VPS messen (Einzeiler aus der Doku
  von 1b-1, durch den User). Liegt `maxRssKb` über 80 MiB, erst Grenze oder Speicher anpassen.
- **Rückweg nach dem Deploy:** Das alte Image kennt `printMismatch` nicht. Vor einem Rollback
  `UPDATE "CardRequest" SET status = 'mismatch' WHERE status = 'printMismatch'` (in `vault/operations`-Hinweis des Berichts).
- Bericht unter `reports/2026-10-27-tis-1b2-fetch-card.md`: Ergebnisse, „nicht belegt“, Zahl offener älterer Aufträge der
  Prod-Kopie.

