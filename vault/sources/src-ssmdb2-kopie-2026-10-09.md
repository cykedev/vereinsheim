---
id: src-ssmdb2-kopie-2026-10-09
type: source
title: "Kopie und SQL-Checkliste der SSMDB2, 9. Oktober 2026 (zwei Jahre Historie)"
retrieved: 2026-10-09
keywords: [sp-0.1, kopie, dump, sql-checkliste, historie, zwei jahre, innodb, primärschlüssel, kein index, fremdschlüssel, on delete cascade, scheibenid, überlauf, millisekunden-zähler, trash, unknown, platzhalter, vereinsspiele, schach, balken, dart, lotto, königsschießen, trainingsscheibe, zimmerstutzen, öffnungszeiten, dienstag, freitag, schusstakt, nachlauf, uhrsprung, erstbefüllung, initial load]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-edge-cases]]", "[[spiegel-bridge]]", "[[ssmdb2-erkundung]]", "[[src-ssmdb2-abend-2026-10-09]]"]
---

**TL;DR** Kopie der ganzen SSMDB2 nach dem Trainingsabend vom 9. Oktober 2026 (1.532 Scheiben, 4.635 Serien, 45.008 Treffer, 1. Oktober 2024 bis 9. Oktober 2026, gepackt 1 MB, Dauer 0,5 s) samt SQL-Checkliste, lokal in eine Wegwerf-Datenbank eingespielt und ausgewertet. Belegt: InnoDB ohne Zusatzindizes, Fremdschlüssel mit Kaskade, Probe erst seit September 2026, reine Probe überlebt Wochen, Meytons Toleranz von 10 µm an 43.000 von 43.000 Schüssen, Vereinsspiele mit eigenen Scheiben, ScheibenID als Zeitzähler mit Überlauf. Kopie und Auswertung bleiben auf dem Mac des Users ([[adr-029]]); hier nur Anzahlen.

## Struktur

- **Engine InnoDB**, Zeichensatz utf8mb3. Nur Primärschlüssel: `Scheiben(ScheibenID)`, `Serien(ScheibenID, Stellung, Serie)`, `Treffer(ScheibenID, Stellung, Treffer)`; **kein Index auf `Zeitstempel`**. `EXPLAIN` der Änderungserkennung über `Scheiben.Zeitstempel` liest die ganze Tabelle (1.532 Zeilen, 5 ms), über `Treffer.Zeitstempel` den ganzen Primärschlüssel (45.000 Zeilen); über die ScheibenID je eine Zeile.
- `Serien` und `Treffer` hängen per Fremdschlüssel an `Scheiben`, **`ON DELETE CASCADE ON UPDATE CASCADE`**. Schreibt Meyton eine Scheibe neu (löschen, anlegen), verschwinden ihre Treffer kurz: die wahrscheinliche Ursache der zerrissenen Lesungen trotz InnoDB ([[src-ssmdb2-abend-2026-10-09]], SF-71).
- `Zeitstempel` beider Tabellen `datetime` (kein `TIMESTAMP`, SF-31 erledigt), `Millisekunden smallint`, `SportpassID bigint(20)`, `Geschlecht enum('male','female','unknown')` mit Vorgabe `unknown`.

## Umfang und Zeit

- 196 Abende in zwei Jahren, fast nur **dienstags (82) und freitags (77)**; im Mittel 7,8 Scheiben je Abend, zuletzt bis 20 Scheiben auf 15 Ständen. Stände 1 bis 18, 20 und 118.
- Erster Schuss meist zwischen 18 und 20 Uhr, letzte Änderung zwischen 19 und 22 Uhr, vereinzelt vormittags und nachmittags.
- Eine Scheibe dauert vom ersten bis zum letzten Schuss im Median 17 min (90 % unter 38 min, höchstens 81 min). Zwischen zwei Schüssen liegen im Median 32 s (90 % unter 67 s); nur 0,8 % der Pausen sind länger als 3 min.
- **Nachlauf** der letzten Änderung hinter dem letzten Schuss (das Lebenszeichen läuft, bis der Stand freigegeben ist): Median 10 min, 90 % unter 70 min, höchstens 2,7 h.
- Die Nummer eines Schusses folgt in jeder Stellung der Zeit, ohne Ausnahme. Millisekunden sind echt (gleichverteilt 0 bis 999). Der **Fingerabdruck** aus Lage, Zeitstempel und Millisekunden ist über alle 45.008 Schüsse eindeutig.
- **Uhrsprung:** Am 15. September 2026 tragen an Stand 6 und 8 die ersten Schüsse den 9. Juli 2009, die späteren das richtige Datum; der Stand-PC startete mit falscher Uhr und stellte sich während des Schießens (SF-30).

## Inhalt

- **Probe erst seit September 2026:** Bis August 2026 haben alle Scheiben Wertung und keine einen Probeschuss; seitdem 63 Scheiben nur mit Probe. Probeschüsse vom 22. September stehen am 9. Oktober noch vollständig da: Eine reine Probe überlebt Wochen.
- Bis zu 70 Schüsse je Scheibe (Vertrag: höchstens 2.000 Zeilen). `Trefferzahl`, `TotalRing`, `TotalRing01` und alle 4.635 Serien stimmen exakt mit den Treffern; auch die Probe hat Serien.
- **Platzhalter:** kein `--frei--`, aber 112 Scheiben mit Nach- und Vorname `unknown`, alle in der Starterliste „Trash“ und alle mit Sportpassnummer. „Trash“ umfasst 299 Scheiben (rund 20 %); was eine Scheibe dorthin bringt, ist offen. Status ist überall leer; Wettkampf und Training unterscheiden Starterliste und Rangliste (etwa „Training-LG“, „Kranzl“, „Jahrespreis“, „Jugend Wettkampf“).
- **Sportpass:** 1.517 von 1.532 Scheiben tragen eine Nummer, 215 verschiedene, keine mit mehreren Namen, die größte achtstellig (kein Überlauf, SF-35).
- **ScheibenID:** innerhalb eines Abends dicht beieinander und mit der Zeit steigend, über Abende springend und zu 45 % negativ; die Sprünge passen zu einem Millisekunden-Zähler, der etwa alle 49,7 Tage über den 32-Bit-Bereich läuft (vermutet). Kein Wasserstand über die ID; Schlüssel nur mit Quelle und Epoche (SF-77).
- **Fehlschüsse:** 377 Schüsse mit Ring 0 und Zehntel 0; 100 weitere mit negativen Zehnteln, alle in Vereinsspielen.
- **Anzeigeart:** alle Codes außer 0 und 10 kommen vor; **Modus 5** („komplett verdeckt“) nur bei 25 Ein-Schuss-Scheiben „König LG/LP“, und die Ablage enthält trotzdem bei allen die Lage und bei 15 den Wert (SF-19).

## Disziplinen und Wertung

39 Disziplinen. Gegen das Modell „Grenze + 10 µm, strikt“ stimmen in allen Katalog-Disziplinen (LG/LP 20, 40, 60, „alt“, Auflage, Liga) **43.000 von 43.000** Zehnteln und Innenzehnern; nach der reinen Regel 41.649 (SF-75). Über den Namen landeten in `shot-core` bis zum 9. Oktober 2026 auf der Standardscheibe, obwohl sie eigene Scheiben haben und fast nie passen (seitdem Nullzeilen im Katalog):

- **Vereinsspiele** (Regel 8000 bis 8154, DisziplinID `18…`): Schach 6x6, Schach-Lotto, Dart, Balken, Dreieck, Blanko, Spiegel, je für LG und LP;
- **Meytons Trainingsscheiben** (`19001000`, `19002000`, `10119000` „LG Training Spiegel“): Werte 0,0 bis 1,9 statt Ringe;
- **Zimmerstutzen** (`10199005`) bleibt schon heute ohne Scheibe.

Passend über den Namen: „König LG/LP“ (Wertung verdeckt), „Kranzl LG“, „LG 40 nachhalten“ (je alle Schüsse gleich).

## Eigene Scheiben des Users

36 Scheiben an 31 Abenden (11. Oktober 2024 bis 9. Oktober 2026), 839 Wertungs- und 130 Probeschüsse, davon 28 Scheiben LP 40 alt; alle mit seiner Sportpassnummer, keine nur mit dem Namen. Eine Erstbefüllung von Spiegel aus der Kopie ist damit möglich (Vorschlag SP-1.13 in [[spiegel-roadmap]]).
