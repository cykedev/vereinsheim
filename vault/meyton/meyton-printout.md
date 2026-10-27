---
id: meyton-printout
type: concept
title: "Meyton-Ergebnisausdruck und QR-Code"
aliases: [meyton-ausdruck, meyton-qr, print-pdf, qrcode-meyton]
keywords: [ausdruck, werte lesen, meyton-values, reader_version, printoutreading, selbstprüfung, valuesstatus, werte nicht lesbar, neu lesen, printout-import, alte ausdrucke, ergebnisausdruck, pdf, qr-code, meyton-pdf, readprintout, creationdate, erstellzeit, druckzeit, xmp, pdf.js, unpdf, identity-h, ghostscript, qrcode.meyton.eu, 195.201.88.185, http, lighttpd, uuid, id im fuß, scheibenid, hex, vorzeichenbehaftet, qt 5.12.8, trefferkreis, trefferlage, streuwert, trefferbild, gegenprobe, printout-check, readprintoutvalues, zähler, innenzehner, beste teiler, weiteste, startnr, standnr]
part_of: ["[[meyton]]"]
relates_to: ["[[treffsicher-meyton-import]]", "[[meyton-pdf-format-change]]", "[[spiegel-assignment]]"]
---

**TL;DR** Der QR-Code am Meyton-Stand führt per HTTP auf ein PDF bei Meyton (`http://195.201.88.185/print_<UUID>.pdf`, eine Woche abrufbar). Das PDF enthält Stand, Zeiten, Name mit #Nummer, alle Werte, Teiler, Trefferkreis bzw. Streuwert und Trefferlage; Koordinaten nicht als Zahl, aber im Trefferbild als Vektorgrafik auf 0,01 mm genau (gemessen am 27. Oktober 2026). Im Fuß steht eine Hex-ID, die ScheibenID (am 9. Oktober 2026 an der eigenen Anlage belegt), die Spiegel für die exakte Zuordnung nutzt. Für die Zuordnung liest Spiegel nur diese ID und die Erstellzeit aus den Metadaten, unabhängig vom Layout ([[adr-028]]). Getrennt davon liest Spiegel seit 1c die Werte und die Lage jedes Schusses aus dem Trefferbild, mit Selbstprüfung und Version des Lesers (siehe „Werte lesen“).

## Link

Beobachtet am Beispiel vom 2. Oktober 2026 (abgerufen am 5. Oktober):

- Form `http://195.201.88.185/print_<UUID>.pdf`, Dateiname eine zufällige UUID ohne Bedeutung.
- **Nur HTTP**, HTTPS antwortet nicht; Server lighttpd 1.4.63.
- Die IP gehört zu `qrcode.meyton.eu` (CNAME `data.vse.meyton.de`, Rückwärtsauflösung `qrcode.vse.meyton.de`).
- `Last-Modified` entspricht der Druckzeit; der Ausdruck ist eine Woche abrufbar.
- Den QR gibt es laut Verein zu jedem Ausdruck, also auch bei Trainings ohne Starter.

## Inhalt

| Bereich | Beispiel | Nutzen |
|---|---|---|
| Kopf | Disziplin „LP 40 alt“, Klasse, StartNr, StandNr, Wertung mit Datum und Uhrzeit, Name mit #Nummer, Verein | Gegenprobe; #Nummer ist die SportpassID zur Druckzeit (siehe unten); neben der Klasse der Modus beim Druck: „Probe“, „Wertung“, „Training“ oder „Vorbereitung/Probe“ |
| Fuß | initialisiert und gedruckt (Uhrzeit), `ID: ff914420`, Seitenzahl | Wechsel auf Wertung, Druckzeit, ScheibenID |
| Ergebnis | Ringe und Zehntel (etwa „352 (371,4)“), Serien, Zähler je Ring, Innenzehner | Gegenprobe; auswärts das Ergebnis selbst |
| Teiler | die drei besten und die drei weitesten mit Schussnummer | Gegenprobe der Formel ([[spiegel-target-library]]) |
| Streuung | Trefferkreis in mm, Trefferlage in mm (links/rechts, hoch/tief); dasselbe je Serie | Meytons eigene Streumaße |
| Je Schuss | Zehntelwert, Stern für Innenzehner, Richtungspfeil | Gegenprobe Schuss für Schuss |
| Grafik | kleine Scheiben mit nummerierten Treffern (Vektorgrafik) | Lage je Schuss auf 0,01 mm zurückrechenbar (siehe unten) |
| Metadaten | Qt 5.12.8, „Meyton Elektronik GmbH“, Erstellzeit mit Zeitzone | Druckpfad wie im Treffsicher-Fixture `meyton-qt-identity-h.pdf` |
| Fehlt | x/y-Koordinaten als Zahl, Zeit je Schuss | Zeit nur aus der SSMDB2 |

Der Trefferkreis einer Serie kann so groß sein wie der der ganzen Scheibe, wenn zwei Treffer dieser Serie ihn bestimmen.

**Gegen die Rohdaten geprüft** (Ausdruck und Ablage vom 9. Oktober 2026, [[src-ssmdb2-abend-2026-10-09]]): Alle 40 Zehntel, Innenzehner, Serien, Ergebnis, beste Teiler und der Kopf stimmen. Der **Trefferkreis** ist der kleinste Kreis um die Schussmitten plus Kaliber (4,5 mm), auf 1/100 mm gerundet; der größte Abstand zweier Treffer passt nicht, sobald drei Schüsse den Kreis bestimmen. Die **Trefferlage** ist der Schwerpunkt, auf 1/100 mm **abgeschnitten** (5,756 mm steht als 5,75). „Weiteste“ sind die Teiler, auf ganze Zahlen abgeschnitten. „initialisiert“ ist der Wechsel auf Wertung, nicht der erste Probeschuss; die Zeit im Kopf ist der letzte Schuss. Spiegel rundet wie Meyton, wo es dieselbe Zahl zeigt (SF-76).

## Werte auf dem Ausdruck, gemessen (27. Oktober 2026)

Gegenprobe 1c-0 mit dem Prototyp `@vereinsheim/meyton-pdf/values` und dem Werkzeug
`pnpm --filter spiegel printout-check <ordner>` an den Ausdrucken eines Schützen, verglichen mit den Rohdaten derselben
Scheibe in der Dev-Datenbank (Prod-Kopie). Nur Zahlen und Definitionen, der Bericht liegt lokal unter `reports/tis-1c0/`.

**Grundlage:** 73 PDFs, alle lesbar; 67 eigene, 6 ohne Namen vor der #Nummer (nur gezählt). Die 67 tragen 63
verschiedene IDs, davon haben 12 eine Scheibe des Kontos in der Dev-Datenbank: **12 Paare** (9 im Modus Wertung, 3 in
Probe), 480 Schüsse, 48 Serien. Die private Kopie der SSMDB2 vom 9. Oktober bringt kein Paar dazu (11 der 12 IDs, sonst
keine); die übrigen Ausdrucke stammen von Scheiben, die die Ablage nicht mehr hat. Was nur aus dem PDF folgt
(Layouts, Selbstprüfung, Disziplin, Marken), ist über alle 67 eigenen gezählt.

**Zwei Layouts**, beide eine Seite: Ghostscript 9.55.0 ohne Ersteller (62, März 2025 bis Juli 2026) mit „Streuwert“,
Qt 5.12.8 mit Ersteller „Meyton Elektronik GmbH“ (5, September bis Oktober 2026) mit „Trefferkreis“ und „initialisiert“
im Fuß. Beide drucken Ergebnis, Serien, Zähler, Innenzehner, Weiteste, beste Teiler und Trefferlage, gesamt und je
Serie, dazu die Werte je Schuss zeilenweise in Schussfolge (fünf je Zeile). Ein Ausdruck ohne Namen druckt zusätzlich
den Teiler je Schuss (Wert, dann Teiler mit „T“). Das Trefferbild ist Vektorgrafik: eine Scheibe für alle Schüsse, eine
je Serie, jede mit eigenem Ausschnitt und Maßstab (bis 1,2 mm je Punkt). Ringe sind Kreise um eine gemeinsame Mitte,
jeder Treffer eine Marke in der Folge der Schüsse. 2 Ausdrucke (Trainingsscheibe) haben kein Trefferbild.

**Kreise und Kreuze:** Ist der Ausschnitt eines Bilds klein (Rahmen 45 bis 88 mm breit, 257 Bilder), ist jeder Treffer
ein Kreis im Kaliber mit seiner Nummer genau in der Mitte. Ist er groß (91 bis 109 mm, 71 Bilder in 14 Ausdrucken,
März 2025 bis März 2026), ist jeder Treffer ein Kreuz fester Größe ohne Nummer. Ein Kreuz steht also nicht für einen
Treffer außerhalb des Bilds: Von 5.260 Marken liegt keine außerhalb ihres Rahmens, und die Mitte eines Kreuzes trägt die
Lage so genau wie ein Kreis (siehe Frage 5). Im Prototyp ist die Art der Marke `holeShape` („circle“, „cross“).

| Frage | Ergebnis |
|---|---|
| 1 Werte je Schuss | 12 Paare: Zehntel und Innenzehner 480 von 480 gleich, Folge = Schussnummer; Ergebnis, Serien (Ringe und Zehntel), Zähler, Innenzehner 100 % gleich. Der Ring der Rohdaten ist die ganze Zahl des Werts (480 von 480) |
| 2 Teiler | 12 Paare: Einheit 1/100 mm (`Teiler001` / 100). Beste Teiler auf eine Nachkommastelle **abgeschnitten** (180 von 180, gerundet nur 98), Weiteste auf ganze Zahlen abgeschnitten (36 von 36), Schussnummer und Rang immer richtig. Aus den Marken gerechnet: höchstens 1,0 · 1/100 mm neben `distanceTenthsUm` (480, 95 % unter 0,66); die gedruckten besten Teiler liegen höchstens 0,7 · 1/100 mm neben dem aus der Marke (36) |
| 3 Trefferlage | 12 Paare: Schwerpunkt der gezeigten Schüsse (Probe im Modus Probe), je Achse auf 1/100 mm **abgeschnitten** (60 von 60, gesamt und je Serie), höchstens 0,012 mm daneben; rechts und hoch positiv wie in Spiegel |
| 4 Trefferkreis | **kleinster Kreis um die Trefferzentren plus Kaliber** (4,5 mm), auf 1/100 mm gerundet: höchstens 0,005 mm daneben (4 Scheiben, 16 Serien, nur Qt). Ohne Kaliber 4,5 mm daneben, größter Abstand zweier Treffer bis 5,7 mm, doppelter größter Abstand zur Mitte bis 19 mm |
| 4 Streuwert | Standardabweichung je Achse mit **n − 1**, gesamt √((σx² + σy²) / 2), auf 1/100 mm gerundet: höchstens 0,005 mm daneben (8 Scheiben, 32 Serien, nur Ghostscript); mit n bis 1,1 mm daneben |
| 5 Trefferbild | Mitte und Maßstab aus den Ringen: jede Marke höchstens **0,01 mm** neben der Lage der Rohdaten (960 Marken, Kreise wie Kreuze), so genau wie die Rohdaten selbst (1/100 mm). Die Nummern liegen höchstens 0,26 mm neben der Lage (800, 95 % unter 0,14 mm), keine fehlt; 266 von 400 Marken der ganzen Scheibe überdecken eine andere, die Nummern sind dann nicht lesbar, die Marken schon. Die Marken sind also die genauere Quelle |
| 6 Abdeckung | siehe Grundlage; es fehlten im eigenen Ausdruck: Trefferkreis (62, Ghostscript), Streuwert (6, davon 5 Qt), Innenzehner (3), Ergebnis und Serien (2), Trefferbild (2), Teiler je Schuss (alle) |
| Selbstprüfung | 67 eigene: Bei 65 passen alle gedruckten Summen zu den gelesenen Werten (Ring = ganze Zahl des Werts): Ergebnis 65 von 65, Serien 263 von 263, Innenzehner 64 von 64, Zähler 737 von 739. Die 2 Widersprüche sind die Trainingsscheibe: ihr Zähler hat 12 Felder statt 11, die Regel „10 bis 0“ passt dort nicht |
| Standnummer | 12 von 12 gleich `Card.stand` |
| Disziplin im Kopf | 64 von 67 genau einer Disziplin der Anlage wörtlich zugeordnet, 3 keiner: Trainingsscheibe und „LP 40 alt SpO“ gibt es an der Anlage (noch) nicht als Disziplin; bei den 12 Paaren immer die Disziplin vom Stand |
| initialisiert | nur im Qt-Layout, auf die Minute: im Modus Probe 47 bis 79 s vor dem ersten Schuss (3), im Modus Wertung 73 s vor dem ersten Wertungsschuss (1, die Probe war gelöscht). Mit 4 Paaren nicht eindeutig; passt zu „Beginn der Scheibe, beim Wechsel auf Wertung neu“ |

**Umgesetzt in 1c** (27. Oktober 2026, siehe „Werte lesen“): Werte je Schuss mit Zehnteln und Innenzehner, Serien und
Ergebnis, Standnummer, Lage je Schuss aus den Marken (Kreise wie Kreuze, nie aus den Nummern), Vorbelegung der Disziplin
bei genau einem wörtlichen Treffer. Zähler, Innenzehner, Summen, Trefferlage, Trefferkreis, Streuwert und die
gedruckten Teiler dienen der Selbstprüfung und werden nicht gespeichert. „initialisiert“ bleibt ungenutzt, Beginn ist die
Druckzeit. Die Lage vom Ausdruck zählt voll wie eine gemessene (Herkunft bleibt „vom Ausdruck“, [[adr-033]], Nachtrag
vom 27. Oktober 2026 zu 1c).

**Nicht belegt seit 1c:** ein Ausdruck im Modus Probe gegen die Brücke. Meyton löscht die Probe beim ersten
Wertungsschuss (SF-03); liefert die Brücke erst danach, fehlen die Probeschüsse, und der Auftrag endet mit „passt nicht
zum Ausdruck“. Das ist richtig, wenn die Probe ein eigener Block war, an echten Daten aber nicht gesehen.

**Nicht belegt:** der Teiler je Schuss (nur ein Ausdruck ohne Namen), Zwischenausdrucke (kein Paar zeigte weniger Schüsse
als die Rohdaten), Trefferkreis nur an 4 Qt-Ausdrucken, „initialisiert“ nur an 4, Probe nur an 3 Paaren, Kreuze nur an 2
Paaren (80 Marken), Modus Training und die Trainingsscheibe, Luftgewehr, fremde Anlagen und andere Meyton-Versionen,
Disziplinen ohne eigene Ausdrucke.

## Werte lesen

Seit 1c (27. Oktober 2026) liest Spiegel aus jedem Ausdruck nach ID und Druckzeit auch die Werte, im selben Kindprozess
(SF-48) in der restlichen Zeit. Die Zuordnung hängt weiter nur an ID und Druckzeit ([[adr-028]]); scheitern die Werte,
gelten ID und Druckzeit trotzdem. Dafür schreibt der Kindprozess ID und Druckzeit als eigene Zeile vor den Werten: pdf.js
baut die Zeichnung eines präparierten PDFs sekundenlang am Stück, ohne dass eine Prüfung der Zeit dazwischenkommt.

- **Leser:** `readPrintoutValues` und die reine Lesung `printoutReading` (`@vereinsheim/meyton-pdf/reading`), Version
  `meyton-values@1` (`READER_VERSION`). Die Lesung enthält keinen Namen, keine Nummer, keine ID und kein Datum.
- **Layout** nur nach dem Erzeuger: `GPL Ghostscript …` → `ghostscript`, `Qt …` → `qt`, sonst `unknown`. Ein
  unbekanntes liest der Leser trotzdem, die Selbstprüfung entscheidet.
- **Modus:** „Probe“ und „Vorbereitung/Probe“ geben Probeschüsse (ohne Summen), „Wertung“ Wertungsschüsse mit Serien
  und Ergebnis; jeder andere (etwa „Training“, nicht belegt) gibt keine Werte.
- **Selbstprüfung** (Gründe in dieser Folge): `empty` keine Schüsse, `mode`, `shotValue` (Wert über 10,9 oder
  Innenzehner unter 10), `series` (Serien nicht 1 … n), `sums` (Summe je Serie, Zeile „Serien“, Ergebnis; Ring je Schuss
  wie Meyton min(10, ⌊Wert⌋)), `innerTens`, `counts` (genau 11 Felder von 10 bis 0; die Trainingsscheibe druckt 12),
  `marks` (Marken im Bild der Scheibe = Schüsse, je Serie ein Bild mit ihren Schüssen), `teilerRefs` (Schussnummer der
  Teiler außerhalb). Was nicht gedruckt ist, prüft sie nicht.
- **Gegen das Scheibenbild der Disziplin** (`detailsFromReading` in Spiegel): Maßstab und Mitte jedes Bilds aus seinen
  Ringen (jedes Verhältnis höchstens 0,5 % neben dem Median, sonst `rings`, auch ohne Scheibenbild), Lage je Schuss aus
  dem Bild seiner Serie auf 10 µm, gegengeprüft am Bild der ganzen Scheibe (0,05 mm, sonst `marks`). Dann Trefferlage
  (Schwerpunkt, je Achse 0,02 mm), Trefferkreis (kleinster Kreis plus Kaliber, 0,02 mm), Streuwert (σ mit n − 1,
  0,02 mm) und Teiler (beste 1,5, weiteste 2,0 · 1/100 mm) gegen die Lagen, gesamt und je Serie. Zuletzt muss jede
  Marke den gedruckten Wert ihres Schusses tragen (dieselbe Gegenprobe wie beim Einlesen, `verifyShots`), sonst
  gehören die Marken anderen Schüssen (`marks`). An den eigenen Ausdrucken: 0 von 1.950 Schüssen verdächtig.
- **Teiler aus der Lage:** Spiegel speichert keinen Teiler je Schuss vom Ausdruck, sondern rechnet ihn aus der Lage,
  eine Regel für jeden Schuss. Folge: Der beste Teiler auf der Seite kann in der letzten Stelle vom Papier abweichen
  (höchstens 0,01 mm; Meyton schneidet ab, die Marken liegen bis 0,01 mm daneben).
- **Status je Ausdruck** (`Printout.valuesStatus`): `ok` (Lesung gespeichert, passt), `empty` (keine Werte darauf),
  `inconsistent` (Widerspruch), `unreadable` (Leser scheiterte). Ein Widerspruch in sich verwirft die Lesung. Passt
  eine stimmige Lesung nur nicht zur Disziplin der Scheibe (Scheibenbild, Schusszahl), bleibt sie gespeichert
  (Grundsatz „Immer das Maximum an Daten speichern“, entschieden mit dem User am 27. Oktober 2026). Die Seite einer
  Scheibe vom Ausdruck ohne Brücke sagt es leise an der Zeile des Ausdrucks. Der Admin zählt nur Ausdrucke ohne
  Lesung, als Zustand an der Anlage.
- **Welcher Ausdruck:** an einer Scheibe vom Ausdruck ohne Brücke der zuletzt gedruckte mit gespeicherter Lesung;
  passt er nicht zur Disziplin, der nächste. Gibt keiner Werte, verliert die Scheibe ihre Werte vom Ausdruck (neue
  Revision ohne Angaben). Ändert der Schütze die Disziplin oder der Admin deren Scheibenbild oder Schusszahl, wendet
  Spiegel die gespeicherten Lesungen neu an (`recomputeDisciplineCard`).
- **Neu lesen:** Beim Start und stündlich liest Spiegel Ausdrucke mit einer anderen oder keiner Version des Lesers neu
  (höchstens 50 je Lauf, nur Scheiben vom Ausdruck ohne Brücke, nicht wartend, nicht im Papierkorb). Läuft der Server
  mit zu altem Node, endet der Lauf und die Zeilen bleiben für später. Ein anderer Fehler beim Lesen (Zeit, Speicher)
  ist `unreadable` mit dieser Version, überschreibt aber nie eine stimmige Lesung: Auch ein erneutes Holen desselben
  PDFs mit einem Lesefehler lässt die Werte der Scheibe stehen (`writePrintoutValues`).
- **Beim Einlesen** prüft Spiegel zusätzlich zur Druckzeit Schuss für Schuss gegen die Rohdaten ([[spiegel-assignment]]);
  passen sie, werden die Rohdaten eine neue Revision derselben Scheibe.
- **Node:** Der Leser braucht Node 26 (`READER_MIN_NODE`, wie `engines` und `.nvmrc`); auf einem älteren meldet der
  Server es im Log und „Scheibe holen“ sagt „Dieser Server kann keine Ausdrucke lesen“.

**Lokale Regression:** Die eigenen Ausdrucke eines Schützen liegen nur lokal und gitignored in
`packages/meyton-pdf/src/__fixtures__/private/printouts/` (ADR-029, Nachtrag). `private.test.ts` vergleicht jede Lesung
mit einem Schnappschuss daneben und verlangt mindestens 90 % mit Werten; ohne Ordner läuft nichts. Stand 27. Oktober
2026: 67 eigene Ausdrucke, 65 mit Werten, 2 `mode` (Trainingsscheibe).

## Alte Ausdrucke einlesen

Ein Ordner alter Ausdrucke wird zu Scheiben eines Kontos, derselbe Weg wie ein Upload, ohne Auftrag an die Brücke: die
eigene Scheibe des Abends bekommt das PDF (eine Scheibe vom Ausdruck auch seine Werte), sonst entsteht eine Scheibe vom
Ausdruck (Training, ohne Ort) mit der Disziplin aus dem Kopf, wenn genau eine wählbare so heißt; ohne Disziplin
übersprungen. Idempotent über sha256, der Bericht nur mit Zahlen.

- **Dev:** `pnpm --filter spiegel printout-import <ordner> --email <adresse> --dry-run`, dann ohne `--dry-run`. Die
  Dateien landen unter `apps/spiegel/uploads/printouts/` des Checkouts, aus dem der Dev-Server läuft.
- **Prod** (nach dem Deploy, durch den User): Postgres hängt nur im Netz `data` und ist nicht veröffentlicht
  ([[adr-003]]). Den Tunnel deshalb auf die Adresse des Containers `db` im Docker-Netz legen (auf dem VPS mit
  `docker inspect` nachsehen), etwa `ssh -L 15432:<adresse>:5432 <vps>`. Dann `DATABASE_URL` auf
  `localhost:15432/spiegel` mit dem Owner von Spiegel setzen, `UPLOAD_DIR` auf einen leeren Ordner,
  `printout-import <ordner> --email <adresse> --dry-run`, dann ohne `--dry-run`. Die Sperre „nur gegen die lokale
  Dev-Datenbank“ des Werkzeugs lässt einen Tunnel auf `localhost` durch: Vor dem Lauf ohne `--dry-run` die Adresse
  prüfen. Danach die Dateien aus `<UPLOAD_DIR>/printouts/*.pdf` mit `docker cp` in den Container `app-spiegel`
  nach `/app/uploads/printouts/` kopieren (Volume `uploads_spiegel`). Ohne die Dateien zeigt die Seite die Werte, aber
  kein PDF, und das Neulesen zählt sie als fehlend.

## ID im Fuß

Meral-IT hat für den XML-Export festgestellt, dass dessen hexadezimale ID die ScheibenID als vorzeichenbehaftete 32-Bit-Zahl ist. Die ID im Ausdruck sieht genauso aus: `ff914420` = 4287710240 − 2³² = **−7257056**. Ein Fixture in Treffsicher trägt `46a13c20` (positiv). Prüfung in SP-0.2 der [[spiegel-roadmap]]:

```sql
SELECT CAST(CONV('ff914420', 16, 10) AS SIGNED) - 4294967296 AS scheiben_id;  -- nur bei Werten ab 80000000 abziehen
SELECT ScheibenID, StandNr, Disziplin, TotalRing, TotalRing01 FROM Scheiben WHERE ScheibenID = -7257056;
```

**Befunde an 72 Ausdrucken eines Schützen** (13. Oktober 2026, [[src-ssmdb2-kopie-2026-10-09]]):

- Dieselbe ID steht auf mehreren Ausdrucken, wenn auf einer Scheibe mehrmals gedruckt wird, auch nach einem Neustart
  der Probe mit ganz anderem Ergebnis (SF-72). Eine ID meint also eine Scheibe, nicht einen Ausdruck.
- Die #Nummer ist die SportpassID zur Druckzeit. Bei diesem Schützen war sie anfangs falsch eingetragen; die Ablage trägt bei
  denselben Scheiben die später korrigierte Nummer. Die SportpassID einer alten Scheibe kann sich in der Ablage also
  nachträglich ändern (wie, ist offen); ein Opt-in greift damit auch rückwirkend.

## Lesen in Spiegel

`packages/meyton-pdf` liest aus dem PDF nur die ID und die Erstellzeit, ohne
Layout-Wissen ([[adr-028]]). Befund an drei echten PDFs (zwei Treffsicher-Fixtures, der Ausdruck vom
2. Oktober; nur lokal geprüft):

| PDF | Fußzeile, wie pdf.js sie liefert | Info `CreationDate` | XMP `xmp:CreateDate` |
|---|---|---|---|
| Qt 5.12.8 | ein Textstück `ID: 46a13c20 - Seite: 1` | `D:20260828181127+02'00'` | keins |
| Ghostscript 9.55 | ein Textstück `ID: ed850812 − Seite: 1` (echtes Minus) | `D:20260811182954+02'00'` | `2026-08-11T18:29:54+02:00` |
| Ausdruck 2. Oktober (Qt) | ein Textstück `ID: ff914420 - Seite: 1` | `D:20261002195212+02'00'` | keins |

- **ID:** `ID:` ohne Buchstabe oder Ziffer davor (auch keine Umlaute; `DisziplinID:` trifft nicht),
  genau acht Hex-Zeichen am Stück, danach kein Buchstabe und keine Ziffer; auf allen Seiten gesucht
  (SF-44). Einzeln gesetzte Glyphen (`I D : f f 9 1 …`, nach dem Zusammenfassen des Leerraums) gelten
  auch; unregelmäßige Lücken ergeben „keine ID“, nie eine aus getrennten Wörtern gebaute. Beschriftungen
  kennt das Muster nicht: `Disziplin-ID: 19210040` zählt als ID, Vorschau und Bestätigung schützen (SF-41).
  Ergebnis `found` (mit Seiten), `missing` oder `conflict` bei verschiedenen IDs, nie geraten.
- **Erstellzeit:** `CreationDate` aus dem Info-Dict, sonst `xmp:CreateDate` (auch `xap:`); ein Datum mit
  Zeitzone geht vor. `ModDate` zählt nicht (beim Qt-Fixture später als die Erstellung). Ohne Uhrzeit
  oder Zeitzone gibt es keinen absoluten Zeitpunkt, Jahre vor 1970 gelten nicht.
- **Grenzen:** 1 MB, 10 Seiten, 20 000 Textstücke, 100 000 Zeichen, 5 s, geprüft zwischen den Schritten
  von pdf.js. Gegen präparierte PDFs schützen sie **nicht**: Ein 3-KB-PDF brachte pdf.js auf 294 MB,
  ein 128-KB-XMP auf 1,36 GB, eine Operator-Bombe lief 21 s. Der Server liest fremde PDFs deshalb im
  Kindprozess (gebaut mit SP-1.7 b, `apps/spiegel/src/lib/printouts/reader.ts`): eigene Speichergrenze, `--lite-mode`,
  harter Abbruch nach 5 s, einer zur Zeit (SF-48); ein Worker-Thread reicht nicht. pdf.js bekommt eine Kopie des Puffers, weil es ihn leert.

## Datenschutz

Der Ausdruck enthält Name, #Nummer, Verein und Ergebnis. Echte Ausdrucke gehören nicht ins öffentliche Repo; Test-PDFs werden anonymisiert oder synthetisch erzeugt ([[adr-029]]).
