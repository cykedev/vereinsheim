---
id: spiegel-edge-cases
type: concept
title: "Spiegel — Sonderfälle und Fallstricke"
aliases: [sonderfälle, edge-cases, fallstricke, sonderfall-katalog, testmatrix]
keywords: [sonderfall, edge case, druckzeit, pdf-metadaten, regelnummer, regelkollision, fallstrick, nur probe, probeschüsse, lange probe, wertung vergessen, schusszahl, abgebrochen, unvollständig, zustand, fehlschuss, platzhalter, handeintrag, falsche disziplin, verdeckte wertung, modus 0, querschuss, korrektur, umnummerierung, fingerabdruck, massenlöschung, reset, epoche, grabstein, zeitstempel, millisekunden, uhr, sportpass, überlauf, nicht meine, zwischenstand, vorschau, ssrf, polling, index, lesesperre, myisam, stromausfall, netztrennung, gäste-lan, r50, visier, disziplin-familie, rekorde, zeilenversionen, testdaten, schießprotokoll, merkmale, lebenszeichen, zerrissene lesung, torn read, neustart der probe, probe-block, uhr je stand, anzeigeart, toleranz, rundung, abend-mitschnitt]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-ingest-pipeline]]", "[[spiegel-bridge]]", "[[spiegel-metrics]]", "[[spiegel-assignment]]", "[[spiegel-roadmap]]", "[[meyton-ssmdb2]]"]
documented_in: ["[[src-ssmdb2-abend-2026-10-09]]", "[[src-ssmdb2-kopie-2026-10-09]]"]
---

**TL;DR** Katalog der Sonderfälle mit festen IDs: was schiefgehen kann, wie Spiegel sich absichert und wie wir es prüfen. Entstanden aus einem kritischen Review mit unabhängigem Gegenleser (5. Oktober 2026). Jeder Fall wird ein Testfall (SP-1.0), und jede Abnahme in der [[spiegel-roadmap]] nennt die IDs, die das Feature abdecken muss. Die Leitregeln fassen die Absicherungen zusammen.

# Spiegel — Sonderfälle und Fallstricke

## Leitregeln

1. **Auswertung ist schussbasiert, nicht wertungsbasiert.** Eine Scheibe nur mit Probe ist vollwertiges Training: Auf der Scheibe zeigt Spiegel sie genau wie Wertung, mit Schüssen 1…n, Serien zu zehn und Ergebnis (User, 8. Oktober 2026); erst wenn Wertung folgt, trennt es Probe und Wertung. Ein amtliches Ergebnis ist es trotzdem nicht: Rekorde und Verläufe nehmen es nur mit „Probe einbeziehen“ (SF-01).
2. **Reihenfolge je Stellung nach Nummer, zwischen Probe und Wertung nach Zeit.** Zeit ist immer das Paar aus Zeitstempel und Millisekunden, nie deren Summe.
3. **Die Scheibe ist der jüngste stabile Stand, wie am Ausdruck** (User, 9. Oktober 2026, [[adr-027]]). Bei der Wertung greift die Korrektur. Probe gibt es nur, solange Meyton sie stehen lässt: bei Wertung keine (SF-03), nach einem Neustart nur den letzten Block (SF-72). Spiegel sammelt keine Probe über Snapshots.
4. **Fehlen ist keine Löschung.** Fehler, leere Ergebnisse und massenhaftes Verschwinden ändern nichts; einzelne Löschungen werden markiert, neue Epochen bestätigt der Admin. Eine einzelne Lesung beweist nichts: Gesendet wird, was zwei Lesungen hintereinander gleich zeigen (SF-71).
5. **Vollständig ist ein Zustand, kein Zeitpunkt.** Offen, ruhend, endgültig, getaktet vom Lebenszeichen der Anlage; gegen die Schusszahl zählen nur Wertungsschüsse.
6. **Nichts verlässt das Schützenhaus ungeprüft.** Erst Vorschau und Gegenprobe, dann die Scheibe; verdeckte Wertung bleibt samt Kopfzeile zurück; Spiegel prüft die Zustimmung ein zweites Mal.
7. **Im Zweifel keine automatische Zuordnung.** Mehrdeutige SportpassIDs gehen an den Admin, „Nicht meine“ hinterlässt einen Grabstein.
8. **Vergleichbar machen:** Werte je Schuss, gleiche Schusszahl oder Maße, die kaum von ihr abhängen, robuste Streuung, Disziplin-Familien.
9. **Die Anlage hat Vorrang.** Kurze Abfragen über Indizes mit Zeitbudget; Nachladen nur, wenn niemand schießt.
10. **Unbekanntes sichtbar machen,** nie still deuten und nie verwerfen.
11. **Jeder Fall hat einen Testfall.** Die Daten liefert SP-1.0, die Fakten über unsere Anlage SP-0.1 (SQL-Checkliste) und SP-0.6 (Schießprotokoll).

## Merkmale und Zustand

Statt stiller Annahmen trägt jede Scheibe sichtbare **Merkmale**: `nur-probe`, `unvollstaendig`, `ueber-soll`, `korrigiert`, `an-der-quelle-entfernt`, `nur-pdf`, `pdf-zwischenstand`, `neu-gewertet`, `als-wertung-gezaehlt`, `disziplin-unbekannt`, `uhr-abweichung`, `automatisch-zugeordnet`, `ausgenommen`. Je Schuss gibt es `fehlschuss` und `verdaechtig`. Verläufe, Rekorde und Vergleiche filtern darüber; die Oberfläche zeigt sie als ruhige Hinweise ([[spiegel-ui-design]]).

Der **Zustand** einer Scheibe ist offen (ihr Lebenszeichen läuft, der Stand ist belegt), ruhend (fünf Minuten ohne Lebenszeichen, gemessen an der Beobachtungszeit und nicht an der Uhr des Stands; ein neues Lebenszeichen öffnet sie wieder) oder endgültig (die Anlage war dazwischen aus, oder zwölf Stunden ohne Änderung). Rekorde und Mitteilungen entstehen erst bei endgültig. Das Lebenszeichen ist `Scheiben.Zeitstempel`: Es steigt alle 5 bis 10 s, solange der Stand belegt ist, und steht ab dem Freigeben, 16 s bis 17,5 min nach dem letzten Schuss (9. Oktober 2026).

## Katalog

Die Spalte „Prüfen“ nennt, wo der Fall belegt wird: SQL-Checkliste (SP-0.1), Schießprotokoll (SP-0.6), Fixture oder Test (SP-1.0 und das jeweilige Feature). Die Fälle mit Bezug zur Ablage (der Zuschnitt von SP-1.0 b und SF-32) liegen seit dem 10. Oktober 2026 in `packages/ssmdb2-cases`, `cases/v1/<SF-ID>`, mit Snapshots, SQL je Schritt und erwartetem Ergebnis; wo die Spalte „Fixture“ nennt, ist bei diesen Fällen dieses Paket gemeint. Viele Risiken beruhen auf Vermutungen über unsere Anlage; die beiden Erkundungen bestätigen oder erledigen sie.

### Probe und Wertung

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-01 | Nur auf Probe trainiert | Ein Filter wie `Trefferzahl > 0` (so in meyton-scheibenanzeige) verliert das Training; „0 Ringe“ im Verlauf | Kein Filter auf Trefferzahl oder Summen; Merkmal `nur-probe`; volle Analyse, Ergebnis wie Wertung, nicht amtlich (seit 8. Oktober 2026); Schalter „Probe einbeziehen“ | Belegt am 9. Oktober 2026: 13 von 17 Scheiben nur Probe, bis 60 Schuss; Fixture |
| SF-02 | LP 40, aber 60 Probeschüsse | Zählt die Probe gegen die Schusszahl, gilt die Scheibe vor dem ersten Wertungsschuss als fertig; der Prototyp nimmt fünf Probeschüsse an | Gegen die Schusszahl zählen nur Wertungsschüsse; Probe beliebig lang. Seit U4 zeigt die Oberfläche keine Probe neben Wertung mehr (`asOnPrintout`); ein Training nur aus Probe steht in Serien zu zehn | Schießprotokoll, Fixture |
| SF-03 | Probe fehlt nach dem ersten Wertungsschuss | **Belegt (9. Oktober 2026): gelöscht**, im selben Lesevorgang wie der erste Wertungsschuss. Ein Snapshot ohne Probe sieht aus wie eine Korrektur; QR und Nachladen kommen zu spät; ohne `Startzeit` verschiebt sich der Beginn | **Entschieden (9. Oktober 2026, User):** keine Probe bei Wertung, wie am Ausdruck. Spiegel sammelt sie nicht, auch wenn es sie live gesehen hat; die Brücke puffert nichts ([[adr-027]]). Ein Snapshot ohne die Probe ist deshalb keine Korrektur, sondern der Normalfall. Epoche nie aus dem Beginn | Abend-Mitschnitt 9. Oktober 2026; offen: der Weg zurück auf Probe (SF-04) |
| SF-04 | Zurück von Wertung auf Probe | „Probe zuerst“ verdreht Wiedergabe, Intervalle und Pausen; in der Wertung allein reißt die Probe eine Lücke in `seq`, die wie ein fehlender Schuss aussieht und eine Pause verdeckt | Leitregel 2; in einer Auswahl nur der Wertung ist ein Sprung in `seq`, den nur Probe füllt, keine Lücke: Abstände und Pausen gelten von Wertungsschuss zu Wertungsschuss (`stepsInOrder` mit Kontext, 9. Oktober 2026). Die Oberfläche zeigt die Probe seit U4 nicht mehr (`asOnPrintout`), der Fachkern bleibt robust | Schießprotokoll, Fixture, Tests in `metrics.test.ts` und `timing.test.ts` |
| SF-05 | Umschalten vergessen: 40 „Probeschüsse“ sind das eigentliche Training | Das Training fehlt in den Ergebnis-Verläufen | Aktion „Als Wertung zählen“, Merkmal `als-wertung-gezaehlt`, nicht amtlich; für Rekorde wie eine Scheibe nur mit Probe, also nur mit `includeProbeOnly` (User, 9. Oktober 2026; `FLAG_COUNTED_AS_MATCH` in `shot-core/analysis/records.ts`) | Fixture, Test in `records.test.ts` |
| SF-72 | Neustart der Probe | Die alte Probe wird mit dem ersten neuen Schuss gelöscht; die ScheibenID bleibt, die Nummern beginnen wieder bei 1. Fünfmal an einem Abend, bis zu 48 Schüsse; trifft gerade reine Probe-Trainings, und ein Abgleich über die Nummer verwechselt alte und neue Schüsse | Wie am Ausdruck (Leitregel 3): nur der letzte Block; was davor geschossen wurde, ist weg. Ein Abgleich über die Nummer darf alte und neue Schüsse nicht verwechseln: Neustart heißt neuer Stand, keine Korrektur | Abend-Mitschnitt 9. Oktober 2026; Ausdrucke des Users: zweimal zwei ganze Probe-Trainings auf einer ID, beide gedruckt (13. Oktober 2026); offen: welche Taste ihn auslöst und ob jeder Block eine eigene Scheibe wird ([[spiegel-open-questions]]); Fixture |
| SF-06 | Ausdruck einer reinen Probe | Betrifft nur fremde Anlagen (SP-2.6): Der volle Parser bricht womöglich ohne Serien ab oder hält Probe für Wertung | `meyton-pdf` erkennt „Probe“ im Kopf und kommt ohne Serien aus; für die Zuordnung zählen nur ID und Druckzeit | Fixture (SP-2.6) |

### Schusszahl, Vollständigkeit, Einheit

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-07 | Abgebrochene Scheibe (23 von 40) | Summe 200 statt rund 360 verzerrt Verläufe und Rekorde | Merkmal `unvollstaendig`; Summen nur für vollständige Scheiben, sonst Werte je Schuss | Belegt am 9. Oktober 2026: LG 40 nach 10 Schuss abgebrochen und auf neuer ScheibenID fortgesetzt; Fixture |
| SF-08 | Mehr Wertungsschüsse, als die DisziplinID sagt. **Belegt (9. Oktober 2026):** 53 Schüsse in 16 Scheiben; Meyton speichert sie mit echter Lage, aber Ring und Zehntel 0, `Text` „0F“ oder „inv“ und `Teiler01`/`Teiler001` 2147483647; `Trefferzahl` zählt sie mit | Abschluss und Serienzählung brechen; ein Schuss mit echter Lage und Wert 0 verzerrt Streukreis und Schwerpunkt, und eine Gegenprobe über den Platzhalter-Teiler (214 m) „passt“ nur zufällig | Merkmal `ueber-soll`; Abschluss nie allein über die Schusszahl. Der Adapter (SP-1.6) erkennt den Platzhalter-Teiler als „kein Abstand“ und markiert den Schuss: amtlich 0, nicht in Kennzahlen der Lage, keine Gegenprobe; im Fachkern `FLAG_OVER_TARGET`, Wert 0 und Zeit zählen, Lage und Abstand nicht (13. Oktober 2026) | Kopie vom 9. Oktober 2026; Fixture |
| SF-09 | Schusszahl `000` oder Vereinsvariante mit beliebiger Endziffer | Die Scheibe schließt sofort oder nie | Schusszahl nur als Hinweis; Zustand statt Abschluss | SQL-Checkliste; belegt: Meytons „LG/LP Training Spiegel“ (19110000, 19210000) |
| SF-10 | Lange Pause mitten im Training | Scheibe gilt zu früh als fertig | Ruhend erst, wenn das Lebenszeichen fünf Minuten steht; eine Pause am belegten Stand hält die Scheibe offen, ein neues Lebenszeichen öffnet sie wieder | Abend-Mitschnitt 9. Oktober 2026 (Lebenszeichen); Fixture |
| SF-11 | Mehrere Scheiben an einem Abend (Aufwärmen, Neustart, „LG Probe + 10 Wertung“) | Der Schütze denkt in Abenden, sieht aber viele kleine Scheiben | Einheit = Schütze und Tag; Liste nach Abend gruppiert (seit N2, [[spiegel-navigation]]; vor 4 Uhr Ortszeit zählt zum Vortag, auch an den Tagen der Zeitumstellung). Ein Zeitraum schneidet weiter um Mitternacht: eine Scheibe um 01:00 am ersten Tag des Zeitraums gehört dazu und steht unter dem Abend davor, wie auf der Seite des Zeitraums. Einklappen von Nebenscheiben offen, bis echte Daten zeigen, ob es sie gibt | Fixture |
| SF-12 | Zwei Schützen nacheinander auf einer Scheibe | Mischdaten | Teilen an einem Schuss, verankert über den Fingerabdruck, nicht die Nummer | Fixture |
| SF-13 | Training ohne Starter heißt in der Ablage womöglich `--frei--`; beim Verein heißen 112 Scheiben `unknown` (alle in „Trash“, alle mit Sportpass) | Der bisher empfohlene Filter verwirft genau diese Trainings, der QR-Weg findet nichts; eine Namensprüfung hält `unknown` für einen Namen | Nur Scheiben ohne Treffer weglassen, nie nach Namen filtern; `--frei--` und `unknown` sind Platzhalter | Kopie vom 9. Oktober 2026 |

### Werte und Treffer

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-14 | Fehlschuss, Nuller, Treffer weit außen | Gruppen-Zoom und Streukreis explodieren | Merkmal `fehlschuss`; Zoom ohne Ausreißer; robuste Streuung | SQL-Checkliste, Fixture |
| SF-15 | Platzhalter oder Handeintrag (x = y = 0, Teiler 0, `Text` gesetzt) | Erscheint als perfekte 10,9 und als Teiler-Rekord | Gegenprobe je Schuss; bei Widerspruch Merkmal `verdaechtig`, nicht gezeichnet, kein Rekord | SQL-Checkliste, Fixture |
| SF-16 | Falsche Disziplin gewählt (LG-Schütze auf LP-Disziplin) | Werte in sich stimmig, Gegenprobe grün, Verlauf trotzdem falsch | „Disziplin korrigieren“: Spiegel wertet aus x/y neu, Merkmal `neu-gewertet`, nicht amtlich | Schießprotokoll, Fixture |
| SF-17 | Unbekannte DisziplinID oder Vereinsvariante | Keine Scheibe zum Zeichnen | Rückfall über Entfernung und Name; sonst schlägt die Gegenprobe ein Scheibenbild vor, der Admin bestätigt; bis dahin neutrales Raster | Fixture |
| SF-18 | Ganzring-Disziplin (LP) | Ganze Ringe und Zehntel gemischt; Zehntel fehlen womöglich | Ringe nach amtlichem Modus; Zehntel amtlich oder aus x/y, gekennzeichnet; der Umschalter zeigt beide Wertungen, ohne Zehntel steht dort „–“ | Fixture |
| SF-19 | Preis- oder Königsschießen: Probe sichtbar, Wertung verdeckt; gemischte Modi | Werte vorzeitig sichtbar; `TotalRing` in der Kopfzeile verrät Modus 10. Belegt: Modus 5 bei 25 Ein-Schuss-Scheiben „König LG/LP“, und die Ablage enthält trotzdem die Lage und meist den Wert | Ab dem ersten verdeckten Schuss bleibt die ganze Scheibe samt Kopfzeile in der Brücke; Freigabe durch den Admin | Kopie vom 9. Oktober 2026; Fixture |
| SF-20 | Wertungsmodus 0 (unbekannt), etwa bei Probe oder Altdaten | „Unbekannt nie hochladen“ hält still alles zurück | Admin gibt Modus 0 je Disziplin frei; Heartbeat und Statusseite zählen Zurückgehaltenes je Modus | SQL-Checkliste |
| SF-75 | Meyton wertet jede Grenze 10 µm großzügiger als die Regel (ein Schuss erreicht einen Wert, wenn sein Abstand unter Grenze + 10 µm liegt) | Nach reiner Regel gewertet, liegen 15 von 640 Schüssen ein Zehntel unter Meyton; die Gegenprobe meldet falsche Widersprüche, „neu gewertet“ weicht vom Ausdruck ab | `shot-core` wertet mit der Meyton-Toleranz (`MEYTON_TOLERANCE_UM`, umgesetzt am 9. Oktober 2026); so stimmen alle 640 Schüsse des Abends (aus Lage und `Teiler001`) und 43 000 von 43 000 der Historie aus `Teiler001`, Zehntel wie Innenzehner; aus der Lage alle bis auf 48 Schüsse über der Soll-Zahl (Platzhalter-Teiler, SF-08) | Tests „Abend vom 9. Oktober 2026“ (40 Schüsse, vier Grenzabstände) und „Alle eigenen Scheiben“ (953 Schüsse aus zwei Jahren) in `scoring.test.ts` |
| SF-76 | Kennzahlen im Ausdruck anders gerundet | Spiegel zeigt 0,22 mm, der Ausdruck 0,21 mm, und der Schütze misstraut der Zahl | Wie Meyton: Trefferlage (Schwerpunkt) und „Weiteste“ abgeschnitten, Trefferkreis (Hüllkreis plus Kaliber) gerundet; wo Spiegel anders rechnet, heißt die Zahl anders ([[meyton-printout]]) | Test „Ausdruck vom 9. Oktober 2026“ in `geometry.test.ts` |
| SF-21 | Querschuss, Korrektur durch die Standaufsicht | Treffer verschwindet oder ändert sich | Wertung folgt dem neuesten Snapshot; Merkmal `korrigiert` | Schießprotokoll, Fixture |
| SF-70 | **Belegt (9. Oktober 2026):** Vereinsspiele (Regel 8000 bis 8154: Schach, Balken, Dart, Lotto, Dreieck, Blanko, Spiegel) und Meytons Trainingsscheiben (`19001000`, `19002000`, `10119000`) landeten über „LG“/„LP“ im Namen auf der Standardscheibe und passten dort fast nie; seitdem stehen Meytons Spiele und Trainingsscheiben als Nullzeilen im Katalog (Regeln 8000 bis 8154, 9001, 9002); die Vereinsdisziplin `10119000` stellt der Admin auf „ohne Scheibe“ (`targetId: null`), denn vereinseigene Nummern gehören nicht in den Code ([[adr-029]]). Regelnummer nicht eindeutig: 0610 ist „LP Liga“ (10610040) und ISSF-Luftgewehr-Finale (10610220), 0100 die französische Luftpistole; Disziplinen wie Kyffhäuser, 12-kreisig, Löwenbräu oder LP5 tragen „LG“/„LP“ im Namen, nutzen aber eine eigene Scheibe | Ein Rückfall über Regelbereiche oder den Namen wählt das falsche Scheibenbild | Admin-Zuordnung, dann Katalog über Regelnummer und Schusscode mit Nullzeilen für Disziplinen mit eigener Scheibe, dann Name; sonst Vorschlag mit Admin-Bestätigung | Test (SP-1.1) |

### Korrekturen, Löschungen, Schema

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-71 | Zerrissene Lesung: einzelne oder alle Schüsse fehlen für genau einen Durchgang, auch bei Wertung und fertigen Scheiben | 16-mal in 51 Minuten (etwa Wertung 60 → 0, Probe 38 → 0). Wer eine solche Lesung als Stand nimmt, markiert Löschungen oder verliert die Wertung | Die Brücke sendet nur, wenn zwei Lesungen hintereinander gleich sind; Fehlen ist keine Löschung (Leitregel 4) | Abend-Mitschnitt 9. Oktober 2026; Test |
| SF-74 | Anzeigeart am Monitor umgeschaltet | `Treffer.Wertung` und `Text` ändern sich für ganze Serien, ohne dass ein Wert sich ändert; jede Umschaltung sieht aus wie eine Korrektur | `Wertung` und `Text` erzeugen keine neue Revision eines Schusses; die Wertung der Disziplin kommt nie aus `Treffer.Wertung`; verdeckt (5, 10) gilt weiter je Schuss | Abend-Mitschnitt 9. Oktober 2026; Fixture |
| SF-22 | Nach einer Löschung rücken die Nummern nach | Notizen, Teilungen und Revisionsvergleich zeigen auf den falschen Schuss | Fingerabdruck je Schuss aus Zeit, Millisekunden und Lage; Kennzahlwerte hängen an der Revision | Schießprotokoll, Fixture |
| SF-77 | Die ScheibenID ist vermutlich ein Millisekunden-Zähler, der etwa alle 49,7 Tage über 32 Bit läuft: innerhalb eines Abends steigend, über Abende springend, zu 45 % negativ | Ein Wasserstand über die ID verliert Scheiben; eine ID kann in einem späteren Zyklus wiederkehren | Kein Wasserstand über die ID; Schlüssel Quelle + Epoche + ScheibenID, bei einer wiederkehrenden ID entscheidet der Fingerabdruck der Schüsse | Kopie vom 9. Oktober 2026; Test |
| SF-78 | Starterliste „Trash“: 299 Scheiben (20 %), davon 112 mit Namen `unknown`, alle mit Sportpass | Sieht nach gelöschtem Ausschuss aus und würde weggefiltert, obwohl es echte Trainings sind; was eine Scheibe dorthin bringt, ist offen | Nicht nach Starterliste filtern; Zuordnung über den Sportpass wie sonst | Kopie vom 9. Oktober 2026; offen: Bedeutung (Meyton) |
| SF-23 | Ablage geleert, Server neu aufgesetzt, IDs beginnen neu | Hunderte Löschungen, falsche Epochen | Fingerabdruck der Quelle im Heartbeat; Massenverschwinden ergibt einen Hinweis statt Markierungen; neue Epoche nur nach Admin-Bestätigung; **seit 14. Oktober 2026 nicht mehr in der Oberfläche** (User: Technik ist keine Entscheidung des Admins; die ScheibenID ist ein Zeitzähler, alte und neue Scheiben trennen Beginn und Zyklus). Die Brücke eröffnet keine neue Epoche; käme eine, nimmt Spiegel sie nicht an (Grabsteine gelten je Epoche) und die Übersicht zeigt einen Hinweis | Fixture |
| SF-24 | Abfrage scheitert oder ist leer, etwa bei einer nach dem Stromaus beschädigten Tabelle | Der Abgleich markiert alles als „an der Quelle entfernt“ | Fehler und leere Ergebnisse sind nie Löschungen | Test |
| SF-25 | Meyton-Update ändert das Schema | Feste Abfragen brechen oder verschlucken neue Spalten; der alte Adapter deutet falsch | `SELECT *` mit Spaltenliste; Schema-Fingerabdruck aus `Version` und `information_schema`; fehlt eine Spalte, Quarantäne | Fixture mit Zusatzspalte und fehlender Spalte |
| SF-26 | Snapshots kommen in falscher Reihenfolge an | Ein älterer Stand überschreibt einen neueren | Folgenummer (Beobachtungszeit in ms, je Lauf streng steigend) und Beobachtungszeit; nur Neueres zählt | Test |
| SF-27 | Prüfsumme in Brücke und Spiegel verschieden berechnet | Jede Lieferung wirkt neu; Revisionen ohne Änderung | Kanonische Serialisierung mit Testvektoren im Vertrag; neue Revision nur bei inhaltlicher Änderung | Test: Vektoren in `packages/ingest-contract` ([[spiegel-ingest-contract]]) |
| SF-28 | Abgelehnte, gelöschte oder fremde Scheibe | Der nächste Abgleich lädt sie wieder hoch | Abgelehnte und fremde: Grabstein in Spiegel, an die Brücke verteilt. Eigene, selbst gelöschte: 30 Tage Papierkorb, danach weiche Sperre (nur der Schlüssel, an die Brücke verteilt), die ein ausdrückliches Holen aufhebt ([[spiegel-navigation]]) | Test |

### Zeit

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-29 | Uhr des Meyton-Servers geht falsch oder driftet | Scheiben am falschen Tag | Abweichung mit Messzeitpunkt speichern; ab fünf Minuten mit der nächstgelegenen Messung ausgleichen | SQL-Checkliste |
| SF-30 | Uhr springt mitten in der Scheibe (Korrektur, Zeitumstellung) | Reihenfolge nach Zeit falsch. Belegt: Am 15. September 2026 tragen die ersten Schüsse zweier Stände den 9. Juli 2009, die späteren das richtige Datum | Je Stellung zählt die Nummer (sie folgt sonst ohne Ausnahme der Zeit); Widerspruch ergibt Merkmal `uhr-abweichung` | Kopie vom 9. Oktober 2026; Fixture |
| SF-31 | `Zeitstempel` ist ein `TIMESTAMP` | Werte hängen von der Sitzungs-Zeitzone ab. **Erledigt (9. Oktober 2026):** beide sind `datetime` | Sitzungs-Zeitzone trotzdem fest und im Snapshot | Kopie vom 9. Oktober 2026 |
| SF-32 | `Zeitstempel + Millisekunden` in SQL (so stand es im Plan) | MySQL rechnet eine Zahl; spätere Schüsse wirken älter und werden übersehen | Vergleich als Paar | Test |
| SF-73 | Jeder Stand hat seine eigene Uhr: Die Zeitstempel kommen vom Stand, nicht vom Server (Stand 20 ging am 9. Oktober 2026 elf Minuten nach) | Eine Änderungserkennung mit kleinem Fenster gegen die Server-Uhr übersieht den Stand; Scheiben landen zur falschen Uhrzeit | Änderungen je ScheibenID über den zuletzt gesehenen Zeitstempel erkennen, nie über ein Fenster gegen die Server-Uhr; Abweichung je Stand messen (Beobachtung minus Zeitstempel), ab einer Minute Merkmal `uhr-abweichung` und Ausgleich wie SF-29; Abstände aus den Zeitstempeln | Abend-Mitschnitt 9. Oktober 2026; Test |
| SF-33 | Brücke ohne Echtzeituhr nach dem Stromaus, NTP gesperrt | Falsche Zeit, TLS scheitert | Erst nach der Zeitsynchronisierung senden; Rückfall auf `SELECT NOW()` der Anlage | Test |

### Zuordnung und Identität

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-34 | SportpassID vertippt, vertauscht oder von einem fremden Ausdruck abgeschrieben | Fremde Scheiben samt Historie im Konto: eine Datenpanne | Admin sieht beim Bestätigen den Meyton-Namen zur SportpassID; die erste Scheibe bestätigt der Schütze | Test |
| SF-35 | Lange Nummern laufen in `int(11)` über oder werden gekappt; eine ID mit mehreren Namen | Viele Schützen teilen sich eine ID. Beim Verein `bigint(20)`, 215 Nummern, keine mit mehreren Namen, keine gekappt (9. Oktober 2026) | Sperrliste 0, leer, 2147483647 und IDs mit mehreren Namen; vor dem Hashen normalisieren | Kopie vom 9. Oktober 2026 |
| SF-36 | SportpassID erst später in der Schützenverwaltung gepflegt | Alte Scheiben tragen sie nicht; „rückwirkend“ findet nichts | Rückwirkend über Namensvorschläge mit Bestätigung | SQL-Checkliste |
| SF-37 | Falscher Name aus der Liste gewählt, etwa ein Familienmitglied mit Opt-in | Scheibe geht automatisch an ein fremdes Konto | „Nicht meine“ nimmt sie sofort heraus; ohne Besitzer gelöscht, mit Grabstein; Merkmal `automatisch-zugeordnet` | Test |
| SF-38 | Opt-in widerrufen, Konto gelöscht | Die Brücke lädt weiter hoch | Liste bei jedem Start neu, vor jedem Versand geprüft; Spiegel prüft erneut | Test |
| SF-39 | Neuer Ausweis, Vereinswechsel | Neue Scheiben werden nicht erkannt | Alte Nummer widerrufen, neue eintragen; die Scheiben bleiben (eine Nummer je Konto seit 15. Oktober 2026, vorher bis zu drei) | Test |
| SF-40 | Jemand scannt den QR eines anderen | Fremde Scheibe im Konto | Wie beim Papierausdruck: Protokoll, Umkehr, „Das war ich“; passt der Name nicht zum Profil, entscheidet der Admin | Test |

### Ausdruck und QR

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-41 | QR mit falscher ID, alter Epoche oder Dekodierfehler | Die Brücke lädt eine fremde Scheibe hoch, bevor jemand prüft | Erst Vorschau ohne Namen und Lage, Plausibilität über die Druckzeit, Bestätigung durch den Schützen, dann die ganze Scheibe | Test |
| SF-42 | Ausdruck vor dem Ende (Zwischenstand) | Die Scheibe hat beim Holen mehr Schüsse als der Ausdruck | Druckzeit aus den Metadaten; die Vorschau zeigt den Stand beim Druck und den aktuellen; Merkmal `pdf-zwischenstand` | Schießprotokoll, Fixture |
| SF-43 | Dieselbe Scheibe mehrfach gedruckt | Doppelte Scheiben | Gleiche ID ist gleiche Scheibe, mehrere PDFs daran | Schießprotokoll |
| SF-44 | Mehrseitiger Ausdruck | Die ID steht nur auf einer Seite oder der volle Parser liest nur Seite 1 | ID auf allen Seiten suchen; seitenbewusster Parser wie in Treffsicher für fremde Anlagen | Fixture |
| SF-45 | Link abgelaufen oder Meyton-Server nicht erreichbar | Keine Zuordnung per QR | „Scheibe holen“ am Abend; klarer Hinweis | Test |
| SF-46 | Meyton ändert das PDF-Format (wie am 1. September) | Ein Layout-Parser liefert nichts, die Zuordnung bricht | Für die Zuordnung nur ID und Erstellzeit, unabhängig vom Layout; ohne ID Auswahl nach Druckzeit; den vollen Parser braucht nur das Ergebnis fremder Anlagen | Fixture |
| SF-47 | Beliebige Adresse im QR oder im eingefügten Link | Spiegel ruft interne Adressen ab (SSRF) | Nur konfigurierte Ziele, private Netze gesperrt, keine Weiterleitungen | Test |
| SF-48 | Großes oder präpariertes PDF | Bei 256 MB Speichergrenze stürzt Spiegel ab; in Treffsicher belegte ein 3,2-MB-PDF 665 MB, im Review ein 3-KB-PDF 294 MB und ein 128-KB-XMP 1,36 GB | Enge Grenzen (ein Ausdruck hat rund 40 KB), Streaming, Seitenlimit; auf dem Server lesen nur in einem kurzlebigen Kindprozess mit Speichergrenze, harter Abbruch nach der Zeitgrenze, ein Lesevorgang zur Zeit (Worker-Thread reicht nicht) | Test |

### Brücke und Anlage

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-49 | Sekündliches Polling ohne Index | Last auf dem Rechner, der live wertet. Beim Verein kein Index auf `Zeitstempel`; `Scheiben` ganz zu lesen kostet 5 ms (1.532 Zeilen, rund 750 mehr im Jahr) | Zweistufige Änderungserkennung: `Scheiben` ganz, `Treffer` nur über die ScheibenID; Zeitbudget je Abfrage | Kopie vom 9. Oktober 2026 |
| SF-50 | `Scheiben.Zeitstempel` steigt bei Probeschüssen nicht | Probe wird nicht bemerkt. **Erledigt (9. Oktober 2026):** Er steigt als Lebenszeichen alle 5 bis 10 s, auch in der Probe | Kein Weg über `Treffer` nötig | Abend-Mitschnitt 9. Oktober 2026 |
| SF-51 | MyISAM sperrt beim Lesen, InnoDB zeigt langen Transaktionen keine neuen Zeilen | ShootMaster wartet, oder die Brücke sieht nichts Neues. Beim Verein InnoDB mit `ON DELETE CASCADE`: Schreibt Meyton eine Scheibe neu, fehlen ihre Treffer kurz (SF-71) | Kurze Transaktion je Durchgang | Kopie vom 9. Oktober 2026 |
| SF-52 | Nachladen der Historie, während geschossen wird | Last zur falschen Zeit | Nachladen nur, wenn niemand schießt | Test |
| SF-53 | Strom aus während Upload oder Schreiben | Halbe Datei, doppelte Lieferung | Brücke ohne eigenen Zustand, nur Konfiguration auf der Platte; idempotente Übertragung | Test: Stecker ziehen während des Uploads |
| SF-54 | Strom aus während des Selbst-Updates | Die Brücke startet nicht mehr | Atomarer Tausch, vorige Version als Rückfall | Test: Stecker ziehen |
| SF-55 | Gerät getauscht oder Brücke neu installiert | Brücke weiß nicht, was schon oben ist | Spiegel kennt den letzten bestätigten Stand je Quelle | Test |
| SF-56 | Brücke still defekt, während „aus“ der Normalfall ist | Niemand merkt es | Warnung, wenn QR-Scans von einem Abend ohne Brücken-Kontakt kommen | Test |
| SF-57 | Schützen im Gäste-LAN, Geräte im Gerätenetz; Gerätenetz womöglich ohne Internet | Keine Verbindung zu Spiegel | Nur ausgehend DNS, HTTPS und NTP; sonst LTE oder Client im Gäste-WLAN; Kopplung per Code bei der Installation | SQL-Checkliste (Netzfrage) |
| SF-58 | Großer Rückstau nach langer Pause | Ratenbegrenzung und 256 MB Speicher | Kleine Stapel; warten, so lange Spiegel vorgibt | Test |
| SF-59 | Diagnose oder Fehlermeldung enthält Namen | Personenbezogene Daten in Logs | Diagnose als feste Liste ohne Personenfelder; Logs ohne Inhalt; Test auf `Nachname` | Test: Vertragsfehler ohne Inhalt in `packages/ingest-contract`; Antworten und Logs der API ohne Namen (`apps/spiegel/src/lib/ingest/http.test.ts`, 13. Oktober 2026) |

### Kennzahlen und Verläufe

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-60 | Streukreise über 20 und über 40 Schuss im selben Verlauf | Der Verlauf misst die Schusszahl, nicht die Leistung | σ̂ (Rayleigh-σ, kaum n-abhängig); Streukreis und R50 nur bei gleichem n; `nSensitive` in der Registry | Eigenschaftstest |
| SF-61 | Ein oder zwei Schüsse | Streukreis oder Ellipse ohne Sinn, „0“ in der Kachel | `minShots`; darunter „–“ mit Grund | Test |
| SF-62 | Lange Pausen beim Tempo | Ø Intervall verzerrt; eine feste Grenze von drei Minuten übersieht Pausen, die deutlich länger sind als der eigene Takt (an den Scheiben des Users 3 statt 10 von 906 Abständen) | Median; Pausen getrennt: über dem Doppelten des eigenen Medians, mindestens 60 s, über drei Minuten immer (10. Oktober 2026; bis 15. Oktober 2026 das 2,5-Fache) | Fixture, Tests in `time.test.ts` und `timing.test.ts`, echte LP 60 im Labor |
| SF-63 | Visier in der Probe oder zwischen Serien verstellt | Der Schwerpunkt springt mit Absicht; der Versatz Probe → Wertung wird sinnlos | Ein Ereignis „Visier verstellt“ gibt es nicht (User, 8. Oktober 2026); den Versatz Probe → Wertung (S4) gibt es seit U4 nicht mehr, eine Scheibe ist wie am Ausdruck | Fixture |
| SF-64 | „LP 40“, „LP 40 alt“, „LP Training“ | Verläufe zerfallen | Disziplin-Familien, vom Admin gepflegt | Belegt am 9. Oktober 2026: „LP 40“ und „LP 40 alt“, „LG 40“ und „LG 40 alt“ am selben Abend; SQL-Checkliste |
| SF-65 | Freihand und Auflage auf derselben Scheibe | Unfaire Vergleiche | Familien trennen den Anschlag | Fixture |
| SF-66 | Rekorde aus unvollständigen Serien, Probe, Status `I` oder Sonderwertungen | Falsche Bestwerte | Rekorde nur aus vollständigen Wertungsserien, erst bei endgültig | Fixture |

### Speicher und Betrieb

| ID | Sonderfall | Risiko | Absicherung | Prüfen |
|---|---|---|---|---|
| SF-67 | Ein voller Snapshot je Schuss | Rohdaten wachsen quadratisch (rund 2 GB JSON im Jahr); Löschen muss jede Kopie finden | Zeilenversionen statt Kopien; Anhängen und Korrigieren getrennt | Test: Speicher wächst linear |
| SF-68 | Kennzahl-Version steigt, ohne Hintergrunddienst | Alte Werte bleiben stehen | Versionsprüfung beim Lesen; CLI-Befehl nach dem Deploy | Test |
| SF-69 | Brücken im Feld mit älterem Vertrag | Lieferungen werden abgelehnt | Spiegel nimmt mindestens die Vorversion an; Änderungen nur additiv | Test: eingefrorene Beispiele in `packages/ingest-contract` |

## Pflege

Ein neuer Sonderfall bekommt die nächste freie Nummer und steht in seiner Gruppe; Nummern werden nie neu vergeben. Erledigt die Erkundung einen Fall (etwa weil die Probe doch erhalten bleibt), bleibt die Zeile mit dem Befund stehen.
