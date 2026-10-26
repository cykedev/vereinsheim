---
id: meyton-printout
type: concept
title: "Meyton-Ergebnisausdruck und QR-Code"
aliases: [meyton-ausdruck, meyton-qr, print-pdf, qrcode-meyton]
keywords: [ausdruck, ergebnisausdruck, pdf, qr-code, meyton-pdf, readprintout, creationdate, erstellzeit, druckzeit, xmp, pdf.js, unpdf, identity-h, ghostscript, qrcode.meyton.eu, 195.201.88.185, http, lighttpd, uuid, id im fuß, scheibenid, hex, vorzeichenbehaftet, qt 5.12.8, trefferkreis, trefferlage, zähler, innenzehner, beste teiler, weiteste, startnr, standnr]
part_of: ["[[meyton]]"]
relates_to: ["[[treffsicher-meyton-import]]", "[[meyton-pdf-format-change]]", "[[spiegel-assignment]]"]
---

**TL;DR** Der QR-Code am Meyton-Stand führt per HTTP auf ein PDF bei Meyton (`http://195.201.88.185/print_<UUID>.pdf`, eine Woche abrufbar). Das PDF enthält Stand, Zeiten, Name mit #Nummer, alle Werte, Teiler, Trefferkreis und Trefferlage, aber keine Koordinaten. Im Fuß steht eine Hex-ID, die ScheibenID (am 9. Oktober 2026 an der eigenen Anlage belegt), die Spiegel für die exakte Zuordnung nutzt. Für die Zuordnung liest Spiegel nur diese ID und die Erstellzeit aus den Metadaten, unabhängig vom Layout ([[adr-028]]).

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
| Grafik | kleine Scheiben mit nummerierten Treffern (Vektorgrafik) | später für fremde Anlagen in Koordinaten zurückrechenbar |
| Metadaten | Qt 5.12.8, „Meyton Elektronik GmbH“, Erstellzeit mit Zeitzone | Druckpfad wie im Treffsicher-Fixture `meyton-qt-identity-h.pdf` |
| Fehlt | x/y-Koordinaten, Zeit je Schuss | nur aus der SSMDB2 |

Der Trefferkreis einer Serie kann so groß sein wie der der ganzen Scheibe, wenn zwei Treffer dieser Serie ihn bestimmen.

**Gegen die Rohdaten geprüft** (Ausdruck und Ablage vom 9. Oktober 2026, [[src-ssmdb2-abend-2026-10-09]]): Alle 40 Zehntel, Innenzehner, Serien, Ergebnis, beste Teiler und der Kopf stimmen. Der **Trefferkreis** ist der kleinste Kreis um die Schussmitten plus Kaliber (4,5 mm), auf 1/100 mm gerundet; der größte Abstand zweier Treffer passt nicht, sobald drei Schüsse den Kreis bestimmen. Die **Trefferlage** ist der Schwerpunkt, auf 1/100 mm **abgeschnitten** (5,756 mm steht als 5,75). „Weiteste“ sind die Teiler, auf ganze Zahlen abgeschnitten. „initialisiert“ ist der Wechsel auf Wertung, nicht der erste Probeschuss; die Zeit im Kopf ist der letzte Schuss. Spiegel rundet wie Meyton, wo es dieselbe Zahl zeigt (SF-76).

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
