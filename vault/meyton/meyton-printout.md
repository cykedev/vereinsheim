---
id: meyton-printout
type: concept
title: "Meyton-Ergebnisausdruck und QR-Code"
aliases: [meyton-ausdruck, meyton-qr, print-pdf, qrcode-meyton]
keywords: [ausdruck, ergebnisausdruck, pdf, qr-code, meyton-pdf, readprintout, creationdate, erstellzeit, druckzeit, xmp, pdf.js, unpdf, identity-h, ghostscript, qrcode.meyton.eu, 195.201.88.185, http, lighttpd, uuid, id im fuß, scheibenid, hex, vorzeichenbehaftet, qt 5.12.8, trefferkreis, trefferlage, zähler, innenzehner, beste teiler, weiteste, startnr, standnr]
part_of: ["[[meyton]]"]
relates_to: ["[[treffsicher-meyton-import]]", "[[meyton-pdf-format-change]]", "[[spiegel-assignment]]"]
---

**TL;DR** Der QR-Code am Meyton-Stand führt per HTTP auf ein PDF bei Meyton (`http://195.201.88.185/print_<UUID>.pdf`, eine Woche abrufbar). Das PDF enthält Stand, Zeiten, Name mit #Nummer, alle Werte, Teiler, Trefferkreis und Trefferlage, aber keine Koordinaten. Im Fuß steht eine Hex-ID, vermutlich die ScheibenID, die Spiegel für die exakte Zuordnung nutzt. Für die Zuordnung liest Spiegel nur diese ID und die Erstellzeit aus den Metadaten, unabhängig vom Layout ([[adr-028]]).

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
| Kopf | Disziplin „LP 40 alt“, Klasse, StartNr, StandNr 8, Wertung 02.10.2026 19:51, Name mit #Nummer, Verein | Gegenprobe; #Nummer vermutlich die SportpassID |
| Fuß | initialisiert 19:21, gedruckt 19:52, `ID: ff914420`, Seitenzahl | Beginn, Druckzeit, vermutlich ScheibenID |
| Ergebnis | 352 (371,4), Serien …, Zähler …, Innenzehner 2 | Gegenprobe; auswärts das Ergebnis selbst |
| Teiler | die drei besten und die drei weitesten mit Schussnummer | Gegenprobe der Formel ([[spiegel-target-library]]) |
| Streuung | Trefferkreis … mm, Trefferlage … links, … hoch; dasselbe je Serie | Meytons eigene Streumaße |
| Je Schuss | Zehntelwert, Stern für Innenzehner, Richtungspfeil | Gegenprobe Schuss für Schuss |
| Grafik | kleine Scheiben mit nummerierten Treffern (Vektorgrafik) | später für fremde Anlagen in Koordinaten zurückrechenbar |
| Metadaten | Qt 5.12.8, „Meyton Elektronik GmbH“, erstellt 2026-10-02 19:52:12 +02:00 | Druckpfad wie im Treffsicher-Fixture `meyton-qt-identity-h.pdf` |
| Fehlt | x/y-Koordinaten, Zeit je Schuss | nur aus der SSMDB2 |

Der Trefferkreis von Serie 3 ist mit 66,93 mm so groß wie der der ganzen Scheibe; ihn bestimmen also zwei Treffer aus Serie 3. Welche Definition Meyton nutzt (kleinster Kreis um alle Treffer oder größter Abstand zweier Treffer), zeigen die Rohdaten.

## ID im Fuß

Meral-IT hat für den XML-Export festgestellt, dass dessen hexadezimale ID die ScheibenID als vorzeichenbehaftete 32-Bit-Zahl ist. Die ID im Ausdruck sieht genauso aus: `ff914420` = 4287710240 − 2³² = **−7257056**. Ein Fixture in Treffsicher trägt `46a13c20` (positiv). Prüfung in SP-0.2 der [[spiegel-roadmap]]:

```sql
SELECT CAST(CONV('ff914420', 16, 10) AS SIGNED) - 4294967296 AS scheiben_id;  -- nur bei Werten ab 80000000 abziehen
SELECT ScheibenID, StandNr, Disziplin, TotalRing, TotalRing01 FROM Scheiben WHERE ScheibenID = -7257056;
```

## Lesen in Spiegel

`packages/meyton-pdf` (SP-1.3, Oktober 2026) liest aus dem PDF nur die ID und die Erstellzeit, ohne
Layout-Wissen ([[adr-028]]). Befund an drei echten PDFs (zwei Treffsicher-Fixtures, der Ausdruck vom
2. Oktober; nur lokal geprüft):

| PDF | Fußzeile, wie pdf.js sie liefert | Info `CreationDate` | XMP `xmp:CreateDate` |
|---|---|---|---|
| Qt 5.12.8 | ein Textstück `ID: 46a13c20 - Seite: 1` | `D:20260828181127+02'00'` | keins |
| Ghostscript 9.55 | ein Textstück `ID: ed850812 − Seite: 1` (echtes Minus) | `D:20260811182954+02'00'` | `2026-08-11T18:29:54+02:00` |
| Ausdruck 2. Oktober (Qt) | ein Textstück `ID: ff914420 - Seite: 1` | `D:20261002195212+02'00'` | keins |

- **ID:** `ID:` ohne Buchstabe davor (`DisziplinID:` trifft nicht), genau acht Hex-Zeichen, danach
  kein Buchstabe und keine Ziffer; auf allen Seiten gesucht (SF-44). Leerraum wird vorher
  zusammengefasst, weil pdf.js einzeln gesetzte Glyphen mit Lücken als eigene Stücke liefert.
  Ergebnis `found` (mit Seiten), `missing` oder `conflict` bei verschiedenen IDs, nie geraten.
- **Erstellzeit:** `CreationDate` aus dem Info-Dict, sonst `xmp:CreateDate`; `ModDate` zählt nicht (beim
  Qt-Fixture später als die Erstellung). Ohne Zeitzone gibt es keinen absoluten Zeitpunkt.
- **Grenzen:** 1 MB, 10 Seiten, 20 000 Textstücke, 100 000 Zeichen, 5 s, während des Lesens geprüft
  (SF-48). pdf.js bekommt eine Kopie des Puffers, weil es ihn leert.

## Datenschutz

Der Ausdruck enthält Name, #Nummer, Verein und Ergebnis. Echte Ausdrucke gehören nicht ins öffentliche Repo; Test-PDFs werden anonymisiert oder synthetisch erzeugt ([[adr-029]]).
