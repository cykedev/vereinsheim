---
id: meyton-printout
type: concept
title: "Meyton-Ergebnisausdruck und QR-Code"
aliases: [meyton-ausdruck, meyton-qr, print-pdf, qrcode-meyton]
keywords: [ausdruck, ergebnisausdruck, pdf, qr-code, meyton-pdf, readprintout, creationdate, erstellzeit, druckzeit, xmp, pdf.js, unpdf, identity-h, ghostscript, qrcode.meyton.eu, 195.201.88.185, http, lighttpd, uuid, id im fuß, scheibenid, hex, vorzeichenbehaftet, qt 5.12.8, trefferkreis, trefferlage, streuwert, trefferbild, gegenprobe, printout-check, readprintoutvalues, zähler, innenzehner, beste teiler, weiteste, startnr, standnr]
part_of: ["[[meyton]]"]
relates_to: ["[[treffsicher-meyton-import]]", "[[meyton-pdf-format-change]]", "[[spiegel-assignment]]"]
---

**TL;DR** Der QR-Code am Meyton-Stand führt per HTTP auf ein PDF bei Meyton (`http://195.201.88.185/print_<UUID>.pdf`, eine Woche abrufbar). Das PDF enthält Stand, Zeiten, Name mit #Nummer, alle Werte, Teiler, Trefferkreis bzw. Streuwert und Trefferlage; Koordinaten nicht als Zahl, aber im Trefferbild als Vektorgrafik auf 0,01 mm genau (gemessen am 27. Oktober 2026). Im Fuß steht eine Hex-ID, die ScheibenID (am 9. Oktober 2026 an der eigenen Anlage belegt), die Spiegel für die exakte Zuordnung nutzt. Für die Zuordnung liest Spiegel nur diese ID und die Erstellzeit aus den Metadaten, unabhängig vom Layout ([[adr-028]]).

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

**Grundlage:** 73 PDFs, alle lesbar; 67 eigene, 6 ohne Namen mit #Nummer (nur gezählt). Die 67 tragen 63 IDs, davon
haben 12 eine Scheibe des Kontos in der Dev-Datenbank: **12 Paare** (9 im Modus Wertung, 3 in Probe), 480 Schüsse, 48
Serien. Die private Kopie der SSMDB2 vom 9. Oktober bringt kein Paar dazu (11 der 12 IDs, sonst keine); die übrigen
Ausdrucke stammen von Scheiben, die die Ablage nicht mehr hat.

**Zwei Layouts:** Ghostscript (62 eigene) mit „Streuwert“, Qt (5, die jüngsten) mit „Trefferkreis“. Beide drucken
Ergebnis, Serien, Zähler, Innenzehner, Weiteste, beste Teiler und Trefferlage, gesamt und je Serie, dazu die Werte je
Schuss zeilenweise in Schussfolge (fünf je Zeile). Ein Ausdruck ohne Namen druckt zusätzlich den Teiler je Schuss
(„10.0 766T“). Das Trefferbild ist Vektorgrafik: eine Scheibe für alle Schüsse, eine je Serie, jede mit eigenem
Maßstab (bis 1,2 mm je Punkt). Ringe sind Kreise um eine gemeinsame Mitte, jeder Treffer eine Marke in der
Folge der Schüsse: ein Kreis im Kaliber mit der Nummer genau in seiner Mitte, in älteren Ausdrucken (14) ein Kreuz ohne
Nummer. 2 Ausdrucke (Trainingsscheibe) haben kein Trefferbild.

| Frage | Ergebnis über die 12 Paare |
|---|---|
| 1 Werte je Schuss | Zehntel und Innenzehner 480 von 480 gleich, Folge = Schussnummer; Ergebnis, Serien (Ringe und Zehntel), Zähler, Innenzehner 100 % gleich |
| 2 Teiler | Einheit 1/100 mm (`Teiler001` / 100). Beste Teiler auf eine Nachkommastelle **abgeschnitten** (180 von 180), Weiteste auf ganze Zahlen abgeschnitten (36 von 36), Schussnummer und Rang immer richtig |
| 3 Trefferlage | Schwerpunkt der gezeigten Schüsse (Probe im Modus Probe), je Achse auf 1/100 mm **abgeschnitten** (60 von 60, gesamt und je Serie), höchstens 0,012 mm daneben; rechts und hoch positiv wie in Spiegel |
| 4 Trefferkreis | **kleinster Kreis um die Trefferzentren plus Kaliber** (4,5 mm), auf 1/100 mm gerundet: höchstens 0,005 mm daneben (4 Scheiben, 16 Serien, nur Qt). Ohne Kaliber 4,5 mm daneben, größter Abstand zweier Treffer bis 5,7 mm, doppelter größter Abstand zur Mitte bis 19 mm |
| 4 Streuwert | Standardabweichung je Achse mit **n − 1**, gesamt √((σx² + σy²) / 2), auf 1/100 mm gerundet: höchstens 0,005 mm daneben (8 Scheiben, 32 Serien, nur Ghostscript); mit n bis 1,1 mm daneben |
| 5 Trefferbild | Mitte und Maßstab aus den Ringen: jede Marke höchstens **0,01 mm** neben der Lage der Rohdaten (960 Marken, Kreise wie Kreuze), so genau wie die Rohdaten selbst (1/100 mm). Die Nummern sitzen höchstens 0,26 mm neben ihrer Marke, keine fehlt; 266 von 400 Marken der ganzen Scheibe überdecken eine andere, die Nummern sind dann nicht lesbar, die Marken schon |
| 6 Abdeckung | siehe Grundlage; es fehlten im eigenen Ausdruck: Trefferkreis (62, Ghostscript), Streuwert (6, davon 5 Qt), Innenzehner (3), Ergebnis und Serien (2), Trefferbild (2), Teiler je Schuss (alle) |

**Empfehlung für 1c-1 (Parser und Modell):**

- Übernehmen: Werte je Schuss mit Zehntel und Innenzehner in Schussfolge, Serien-Summen und Ergebnis (Zähler und
  Innenzehner nur als Prüfung, sie folgen aus den Werten). Die genannten Teiler am jeweiligen Schuss mit dem Vermerk,
  dass sie abgeschnitten sind (bester Teiler auf 0,1, also bis knapp 0,1 · 1/100 mm zu klein). Trefferlage gesamt und
  je Serie als Summe: abgeschnitten auf 1/100 mm, für Versatz und Richtung genau genug.
- Trefferkreis: zählt beim Streukreis, als Durchmesser des kleinsten Kreises um die Zentren = Trefferkreis − Kaliber
  (Spiegels Definition `enclosingDiameter` ohne Kaliber prüfen, bevor er einfließt). Belegt nur am Qt-Layout.
- Streuwert (Ghostscript): eine eigene Angabe, die σ je Achse genau trägt (n − 1); ob er in Spiegels σ eingeht, ist eine
  Frage an 1c-1, solange σ dort anders definiert ist.
- Nicht übernehmen: die Nummern im Trefferbild (verdeckt, wo Treffer dicht liegen).

**1c-2 (Lagen aus dem Trefferbild) lohnt sich:** Die Schwelle (95 % der Schüsse unter 0,5 mm, ein Bruchteil eines
Zehntels der Luftpistole mit 0,8 mm) ist weit unterschritten, jede Marke liegt höchstens 0,01 mm daneben. Die Lagen
kommen aus den Kreisen und Kreuzen, nicht aus den Nummern; die Folge der Marken ist die Schussfolge.

**Nicht belegt:** der Teiler je Schuss (nur ein Ausdruck ohne Namen), Zwischenausdrucke (kein Paar zeigte weniger Schüsse
als die Rohdaten), Trefferkreis nur an 4 Qt-Ausdrucken, Probe nur an 3 Paaren, Modus Training und die Trainingsscheibe,
Luftgewehr, fremde Anlagen und andere Meyton-Versionen, Disziplinen ohne eigene Ausdrucke.

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
