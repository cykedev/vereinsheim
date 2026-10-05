---
id: meyton-ssmdb2
type: concept
title: "Meyton SSMDB2 — die Scheibenablage in MySQL"
aliases: [ssmdb2, scheibenablage, small shootmaster database, meyton-db]
keywords: [ssmdb2, mysql, scheibenablage, scheiben, serien, treffer, scheibenid, stellung, probe, disziplinid, regelnummer, wertungsmodus, verdeckte wertung, ring01, teiler01, teiler001, zeitstempel, millisekunden, sportpassid, starterliste, status, rwk, liga, kontrollzentrum, odbc, read only, erkundung]
part_of: ["[[meyton]]"]
documented_in: ["[[src-meyton-ssmdb2-handbuch]]", "[[src-meyton-live-display]]", "[[src-meyton-recherche-2026-10]]"]
relates_to: ["[[spiegel-bridge]]", "[[spiegel-ingest-pipeline]]"]
---

**TL;DR** Die SSMDB2 („Small ShootMaster DataBase 2“) ist eine MySQL-Datenbank auf dem Meyton-Server, in die ShootMaster Ergebnisse in Echtzeit oder auf Knopfdruck schreibt. Drei Tabellen (`Scheiben`, `Serien`, `Treffer`) enthalten Trefferlage in 1/100 mm, Ring, Zehntel, Teiler und Zeitstempel mit Millisekunden. Lesen geht nur mit dem Standard-Zugang; die Felder haben einige Stolperfallen.

## Zugang

- MySQL auf dem Meyton-Server (Standard 192.168.10.200), Datenbank `SSMDB2`, Standard-Zugang laut Handbuch (auf allen Anlagen gleich). Auch über ODBC.
- Seit ShootMaster 5.3 gibt es keinen root-Zugang mehr, die Haupt-DB ist für Externe gesperrt; ein eigener Lese-Benutzer ist nicht vorgesehen. Wer liest, schützt sich selbst: Read-only-Transaktionen, nur SELECT.
- Beim Verein ist der Dienst aktiviert (Stand 5. Oktober 2026); es gibt nur 10-m-Stände.
- Befüllt wird die Ablage vom Dienst im Kontrollzentrum (Bereich SSMDB2) oder manuell aus Preisschießen (accmanII), Wettkampfsteuerung (masterII) und Auswertung (ranklistII). Eine automatische Löschung ist nicht dokumentiert; manuelles Leeren ist möglich.

## Tabellen

| Tabelle | Schlüssel | Inhalt |
|---|---|---|
| `Scheiben` | `ScheibenID` | Starterliste(+ID), Startzeit, StartNr, Nachname, Vorname, Geschlecht, Land, SportpassID, StandNr, StandNrText, Disziplin, DisziplinID, Klasse(+ID), Verein(+ID), Mannschaft(+ID), Rangliste(+ID), Gruppe(+ID), Status, Trefferzahl, TotalRing, TotalRing01, BesterTeiler01, BesterTeiler001, Zeitstempel (letzte Änderung) |
| `Serien` | `ScheibenID`, `Stellung`, `Serie` | Ring, Ring01 |
| `Treffer` | `ScheibenID`, `Stellung`, `Treffer` | Serie, x, y (1/100 mm ab Scheibenmitte), Innenzehner, Wertung (Modus), Text, Ring, Ring01, Teiler01, Teiler001, Zeitstempel (Sekunde), Millisekunden. `Stellung = 0` ist die Probe |

Laut Community-Projekt gibt es zusätzlich eine Tabelle `Version` mit der Schema-Version.

## DisziplinID

Achtstellig: 1. Ziffer Entfernung (1 = 10 m, 2 = 15 m, 3 = 25 m, 4 = 50 m, 5 = 100 m, 6 = 300 m, 7 = sonstige), Ziffern 2–5 Regelnummer, letzte drei Ziffern Zahl der Wertungsschüsse. Beispiel `40180060` = 50 m, Regel 1.80 (KK liegend), 60 Schuss. Nur bei DSB-Disziplinen sind die Ziffern 2–5 die DSB-Regel; Training, Liga und ISSF nutzen Meyton-eigene Nummern ([[spiegel-target-library]]).

## Status und Wertungsmodus

- **Status** (Scheiben): RWK, Liga, Heim, Gast, S (Stammschütze), E (Ersatz), F (festgeschossener Ersatz), AK (außer Konkurrenz), Einlage (Preisschießen), GMM/BMM (ISSF-Finale), I (ungültig). Daraus lässt sich Training gegen Wettkampf ableiten.
- **Wertung** (Treffer, seit 5.2): 0 unbekannt, 1 Zehntel, 2 ganze Ringe, 3 Teiler, 4 Trefferumkreis, **5 komplett verdeckt** (kein Wert, keine Lage), 6 Schweizer 100er, 7 Zehntel + bester Teiler, 8 ganze Ringe + bester Teiler, 9 Zehntelteiler, **10 verdeckt** (Lage sichtbar), 11 Hundertstelteiler, 12 Nachkommastelle.

## Versionen

| Version | Datum | Was sich ändert |
|---|---|---|
| 5.2 | 06/2023 | Feld `Treffer.Wertung` |
| 5.3 | 06/2024 | Haupt-DB für Externe gesperrt, kein root; Sportpassnummern bis 12 Stellen |
| 5.4 | 09/2025 | Probeschüsse (Stellung 0) und Serie je Treffer in der Ablage |
| 6.0.2 | 07/2026 | Feld `BesterTeiler001`; **der Verein nutzt diese Version** |

## Stolperfallen

| Befund | Umgang |
|---|---|
| Ring-Felder unterschiedlich skaliert (Serien in ganzen Ringen, Gesamt- und Zehntelwerte ×10) | Skala je Feld im Adapter, per Test am echten Datensatz |
| `Startzeit` oft `0000-00-00` | Beginn aus dem ersten Treffer |
| Zeiten sind Ortszeit ohne Zone | Zeitzone der Anlage, Rohwert behalten, Uhrabweichung messen |
| `ScheibenID` vorzeichenbehaftet 32 Bit, oft negativ, nur je Instanz eindeutig | Schlüssel Quelle + Epoche + ScheibenID |
| Platzhalter `--frei--` für freie Stände | filtern |
| keine Standbelegung in der DB | für Live optional LANA ([[meyton-interfaces]]) |
| Korrekturen und Löschungen ändern Zeilen nachträglich | Snapshots mit Revision, Abgleich der letzten Tage |
| Probeschüsse laut Release-Notiz nur bis zum ersten Wertungsschuss gespeichert | während des Schießens mitlesen |
| `SportpassID` ist `int(11)`, Sportpassnummern dürfen 12 Stellen haben | vor Ort prüfen |
| im Training oft frei getippte Namen | Zuordnung nicht über Namen ([[spiegel-assignment]]) |

## Erkundung vor Ort

Nur lesen, Ergebnisse mit Namen nicht weitergeben. Feste IP aus dem Workstation-Bereich (.10.201–239).

```sql
SET SESSION TRANSACTION READ ONLY;
SELECT * FROM Version;
SELECT COUNT(*) AS scheiben, MIN(Zeitstempel) AS erste, MAX(Zeitstempel) AS letzte FROM Scheiben;
SELECT COUNT(*) AS treffer FROM Treffer;
SELECT DisziplinID, Disziplin, COUNT(*) AS anzahl FROM Scheiben GROUP BY DisziplinID, Disziplin ORDER BY anzahl DESC;
SELECT Starterliste, Rangliste, Status, COUNT(*) AS anzahl FROM Scheiben GROUP BY Starterliste, Rangliste, Status ORDER BY anzahl DESC LIMIT 40;
SELECT COUNT(*) AS gesamt, SUM(SportpassID > 0) AS mit_sportpass,
       SUM(TRIM(Nachname) IN ('', '--frei--')) AS ohne_namen, MAX(SportpassID) AS max_sportpass FROM Scheiben;
SELECT COUNT(*) AS probeschuesse, MIN(Zeitstempel), MAX(Zeitstempel) FROM Treffer WHERE Stellung = 0;
SELECT SUM(Startzeit IS NULL OR Startzeit < '1971-01-01') AS ohne_startzeit, MIN(ScheibenID), MAX(ScheibenID) FROM Scheiben;
SELECT Wertung, COUNT(*) AS anzahl FROM Treffer GROUP BY Wertung;
-- eine Scheibe im Detail (ID einsetzen)
SELECT Stellung, Treffer, Serie, x, y, ROUND(SQRT(x*x + y*y)) AS abstand, Ring, Ring01, Teiler01, Teiler001,
       Innenzehner, Wertung, Zeitstempel, Millisekunden FROM Treffer WHERE ScheibenID = 12345 ORDER BY Stellung, Treffer;
SELECT s.Stellung, s.Serie, s.Ring, s.Ring01, SUM(t.Ring) AS summe_ring, SUM(t.Ring01) AS summe_ring01
FROM Serien s JOIN Treffer t ON t.ScheibenID = s.ScheibenID AND t.Stellung = s.Stellung AND t.Serie = s.Serie
WHERE s.ScheibenID = 12345 GROUP BY s.Stellung, s.Serie, s.Ring, s.Ring01;
-- ID aus dem Ausdruck (siehe meyton-printout)
SELECT ScheibenID, StandNr, Disziplin, TotalRing, TotalRing01, Zeitstempel FROM Scheiben WHERE ScheibenID = -7257056;
SELECT NOW();
```

Dazu am Stand: einen Probeschuss bewusst hoch rechts setzen (sind x und y positiv, zeigt y nach oben) und die Zeit bis zur neuen Zeile in `Treffer` stoppen.
