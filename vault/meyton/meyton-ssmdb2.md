---
id: meyton-ssmdb2
type: concept
title: "Meyton SSMDB2 — die Scheibenablage in MySQL"
aliases: [ssmdb2, scheibenablage, small shootmaster database, meyton-db]
keywords: [ssmdb2, mysql, scheibenablage, scheiben, serien, treffer, scheibenid, stellung, probe, disziplinid, regelnummer, wertungsmodus, verdeckte wertung, ring01, teiler01, teiler001, zeitstempel, millisekunden, sportpassid, starterliste, status, rwk, liga, kontrollzentrum, odbc, read only, erkundung, index, explain, show create table, timestamp, sitzungs-zeitzone, nur probe, versuche am stand, sportpass überlauf]
part_of: ["[[meyton]]"]
documented_in: ["[[src-meyton-ssmdb2-handbuch]]", "[[src-meyton-live-display]]", "[[src-meyton-recherche-2026-10]]", "[[src-meyton-disziplin-erstellen]]", "[[src-ssmdb2-zugang-recherche]]"]
relates_to: ["[[spiegel-bridge]]", "[[spiegel-ingest-pipeline]]"]
---

**TL;DR** Die SSMDB2 („Small ShootMaster DataBase 2“) ist eine MySQL-Datenbank auf dem Meyton-Server, in die ShootMaster Ergebnisse in Echtzeit oder auf Knopfdruck schreibt. Drei Tabellen (`Scheiben`, `Serien`, `Treffer`) enthalten Trefferlage in 1/100 mm, Ring, Zehntel, Teiler und Zeitstempel mit Millisekunden. Lesen geht nur mit dem Standard-Zugang; die Felder haben einige Stolperfallen.

## Zugang

- Datenbank `SSMDB2` auf dem Meyton-Server (Standard 192.168.10.200), „per Netzwerk erreichbar“ ohne weitere Einstellung; Benutzer `meyton`, das Passwort steht im Handbuch auf Seite 3 und ist in V5, V7 und V9 gleich (auf allen Anlagen gleich; **nicht ins Repo**). Port 3306 nutzen alle Community-Projekte, das Handbuch nennt keinen. Auch über ODBC (bei Architekturfehlern Connector/ODBC 3.5.1) ([[src-ssmdb2-zugang-recherche]]).
- Der Hersteller schreibt „MySQL“; laut Meyton-Forum ist es MariaDB. ShootMaster 6.0 setzt openSUSE Leap 15.3 bis 15.6 voraus, Leap 15.6 bringt MariaDB 10.11 mit; die Version ist unbelegt und wird vor Ort gelesen ([[ssmdb2-erkundung]]). Ein MariaDB-Client ab 11.4 verlangt TLS und verweigert einen Server ohne TLS, wenn man die Prüfung nicht abschaltet.
- Seit ShootMaster 5.3 gibt es keinen root-Zugang mehr, die Haupt-DB ist für Externe gesperrt; ein eigener Lese-Benutzer ist nicht vorgesehen. Wer liest, schützt sich selbst: Read-only-Transaktionen, nur SELECT.
- Beim Verein ist der Dienst aktiviert (Stand 5. Oktober 2026); es gibt nur 10-m-Stände.
- Befüllt wird die Ablage vom Dienst im Kontrollzentrum (Bereich SSMDB2, in Echtzeit oder nachträglich) oder manuell aus Preisschießen (accmanII), Wettkampfsteuerung (masterII) und Auswertung (ranklistII). Eine automatische Löschung ist nicht dokumentiert; „alle Ergebnisse aus SSMDB2 löschen“ im Kontrollzentrum leert immer die ganze Ablage (SF-23), die zentrale DB bleibt.
- **Netz** laut Meyton-IP-Plan, alle Masken 255.255.0.0, kein Standard-Gateway: Messrahmen 192.168.11.1–159, Steuer-PCs 192.168.10.1–159, ESTA-Show .160–179, Netzteile .180–199, Server .200, Meyton-Clients .201–239, Drucker .240–250, Switches .251–254, WLAN 192.168.2.x. An der IP erkennt Meyton die Rolle einer Workstation; ein fremdes Gerät gehört deshalb **nicht** in .200–.239, sondern auf eine freie Adresse im /16 (etwa 192.168.20.x). Für den QR-Code braucht die Anlage einen Router mit DHCP und Internet.
- **Freigaben** per Samba, meist als Gast: `\\192.168.10.200\ERGEBNIS` (`/var/ShootMasterII/ERGEBNIS`, darin `WM-Shot` und `XML` für den SDF-Export, der standardmäßig aus ist). Dass Ausdrucke als PDF auf einer Freigabe landen, belegt keine Quelle. Der QR-Code zeigt vermutlich auf Meytons Dienst `qrcode.meyton.eu` (nur HTTP), nicht auf einen Server im Vereinsnetz; am echten QR prüfen ([[meyton-printout]]).

## Tabellen

| Tabelle | Schlüssel | Inhalt |
|---|---|---|
| `Scheiben` | `ScheibenID` | Starterliste(+ID), Startzeit, StartNr, Nachname, Vorname, Geschlecht, Land, SportpassID, StandNr, StandNrText, Disziplin, DisziplinID, Klasse(+ID), Verein(+ID), Mannschaft(+ID), Rangliste(+ID), Gruppe(+ID), Status, Trefferzahl, TotalRing, TotalRing01, BesterTeiler01, BesterTeiler001, Zeitstempel (letzte Änderung) |
| `Serien` | `ScheibenID`, `Stellung`, `Serie` | Ring, Ring01 |
| `Treffer` | `ScheibenID`, `Stellung`, `Treffer` | Serie, x, y (1/100 mm ab Scheibenmitte), Innenzehner, Wertung (Modus), Text, Ring, Ring01, Teiler01, Teiler001, Zeitstempel (Sekunde), Millisekunden. `Stellung = 0` ist die Probe |

Laut Community-Projekt gibt es zusätzlich eine Tabelle `Version` mit der Schema-Version.

## DisziplinID

Achtstellig: 1. Ziffer Entfernung (1 = 10 m, 2 = 15 m, 3 = 25 m, 4 = 50 m, 5 = 100 m, 6 = 300 m, 7 = sonstige), Ziffern 2–5 Regelnummer, letzte drei Ziffern Zahl der Wertungsschüsse. Beispiel `40180060` = 50 m, Regel 1.80 (KK liegend), 60 Schuss. Nur bei DSB-Disziplinen sind die Ziffern 2–5 die DSB-Regel; Training, Liga und ISSF nutzen Meyton-eigene Nummern ([[spiegel-target-library]]).

Meytons Standardlisten stehen im Handbuch „Disziplin erstellen“ ([[src-meyton-disziplin-erstellen]]). Daraus: Die Regelnummer ist nicht eindeutig (`10610040` „LP Liga“ gegen `10610220` „ISSF AR Men Final“, `10100040` französische Luftpistole), die letzten drei Ziffern sind über 100 Varianten-Codes (220 Finale, 240 Liga Bayern) und bei `000` offen („LG/LP Training Spiegel“). Vereinseigene Disziplinen haben teils kurze, nicht achtstellige IDs.

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

Handbuchstände: V5 (08/2023) → V7 (03/2024): `SportpassID` von `int(11)` auf `bigint(20)`. V7 → V9 (Datenbankversion 9, zu ShootMaster 6.0): neu `Scheiben.StandNrText varchar(36)`, `Scheiben.BesterTeiler001 int(11)`, `Treffer.Serie smallint(6)`; `Treffer.Stellung` 0 heißt Probe. `Startzeit` und beide `Zeitstempel` sind `datetime`, `Millisekunden` ist `smallint`. Die Tabelle `Version` steht in keinem Handbuch; Community-Projekte lesen daraus die Schema-Version (v8 ≈ 5.4, v9 ≈ 6.0, nicht belegt).

## Stolperfallen

| Befund | Umgang |
|---|---|
| Ring-Felder unterschiedlich skaliert (Serien in ganzen Ringen, Gesamt- und Zehntelwerte ×10) | Skala je Feld im Adapter, per Test am echten Datensatz |
| `Startzeit` oft `0000-00-00` | Beginn aus dem ersten Treffer |
| Zeiten sind Ortszeit ohne Zone | Zeitzone der Anlage, Rohwert behalten, Uhrabweichung messen |
| `ScheibenID` vorzeichenbehaftet 32 Bit, oft negativ, nur je Instanz eindeutig | Schlüssel Quelle + Epoche + ScheibenID |
| Platzhalter `--frei--` für freie Stände; womöglich heißen so auch Trainings ohne Starter | nur Scheiben ohne Treffer weglassen, nie nach dem Namen filtern |
| keine Standbelegung in der DB | für Live optional LANA ([[meyton-interfaces]]) |
| Korrekturen und Löschungen ändern Zeilen nachträglich | Snapshots mit Revision, Abgleich der letzten Tage |
| Probeschüsse laut Release-Notiz nur bis zum ersten Wertungsschuss gespeichert; unklar, ob sie dann gelöscht oder nur nicht mehr geschrieben werden | während des Schießens mitlesen und auf der Brücke puffern; Versuch in Phase 0 |
| `SportpassID` war bis Handbuch V5 `int(11)` (höchstens 2147483647), Sportpassnummern dürfen 12 Stellen haben; seit V7 `bigint(20)`. Ältere Einträge können gekappt sein, dann teilen sich viele Schützen eine ID | Typ und Spitzenwerte vor Ort prüfen; mehrdeutige IDs nie automatisch zuordnen ([[spiegel-assignment]]) |
| im Training oft frei getippte Namen | Zuordnung nicht über Namen ([[spiegel-assignment]]) |
| Indizes unbekannt; eine Abfrage ohne Index liest bei jedem Takt die ganze Tabelle, während geschossen wird | `SHOW INDEX` und `EXPLAIN` vor dem ersten Polling |
| Ist `Zeitstempel` ein `TIMESTAMP`, rechnet MySQL ihn in die Sitzungs-Zeitzone um; laut Handbuch V9 ist es `datetime` (Ortszeit ohne Zone, Community bestätigt) | Spaltentyp vor Ort bestätigen, Sitzungs-Zeitzone trotzdem fest setzen und mitsenden |
| Ob `Scheiben.Zeitstempel` bei Probeschüssen steigt, ist offen | Versuch in Phase 0; davon hängt die Änderungserkennung ab |
| `Zeitstempel + Millisekunden` rechnet MySQL als Zahl; spätere Schüsse wirken dann älter | als Paar vergleichen |
| Engine unbekannt: MyISAM sperrt beim Lesen die Tabelle und kann nach hartem Stromaus beschädigt sein; InnoDB zeigt einer lang offenen Transaktion keine neuen Zeilen | kurze Abfragen, Fehler nie als Löschung werten, `SHOW TABLE STATUS` |
| Wertungsmodus `0` (unbekannt), womöglich bei Probe oder Altdaten | Admin gibt Modus 0 je Disziplin frei, Zähler im Heartbeat |
| Die SportpassID steht als Kopie in jeder Scheibe; eine später nachgepflegte Nummer fehlt in alten Scheiben | rückwirkend nur mit Namensvorschlag und Bestätigung |

## Erkundung vor Ort

Das Werkzeug dafür ist `tools/ssmdb2-erkunden/erkunden.sh` ([[ssmdb2-erkundung]]); es führt diese Abfragen aus, ergänzt um Skalen, Zeittypen und die Grenzen des Vertrags.

Nur lesen, Ergebnisse mit Namen nicht weitergeben. Feste IP aus dem Workstation-Bereich (.10.201–239). Die Abfragen vor oder nach dem Training ausführen, nicht während geschossen wird: Einige lesen ganze Tabellen.

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
SELECT NOW(), @@session.time_zone, @@global.time_zone, @@system_time_zone;
-- Struktur, Engine, Spaltentypen und Indizes
SHOW TABLE STATUS;
SHOW CREATE TABLE Scheiben;
SHOW CREATE TABLE Serien;
SHOW CREATE TABLE Treffer;
SHOW INDEX FROM Scheiben;
SHOW INDEX FROM Treffer;
-- Kosten der Änderungserkennung (type = ALL heißt: ganze Tabelle)
EXPLAIN SELECT ScheibenID, Zeitstempel, Trefferzahl FROM Scheiben WHERE Zeitstempel >= NOW() - INTERVAL 2 MINUTE;
EXPLAIN SELECT MAX(Zeitstempel) FROM Treffer;
EXPLAIN SELECT * FROM Treffer WHERE ScheibenID = -7257056;
-- Sonderfälle in der Ablage
SELECT COUNT(*) AS nur_probe FROM Scheiben s
WHERE NOT EXISTS (SELECT 1 FROM Treffer t WHERE t.ScheibenID = s.ScheibenID AND t.Stellung > 0);
SELECT DisziplinID, Trefferzahl, COUNT(*) AS anzahl FROM Scheiben GROUP BY DisziplinID, Trefferzahl ORDER BY DisziplinID, Trefferzahl;
SELECT DisziplinID, COUNT(DISTINCT Disziplin) AS namen FROM Scheiben GROUP BY DisziplinID HAVING namen > 1;
SELECT SportpassID, COUNT(DISTINCT Nachname, Vorname) AS namen FROM Scheiben
WHERE SportpassID > 0 GROUP BY SportpassID HAVING namen > 1;
SELECT Serie, COUNT(*) AS anzahl FROM Treffer WHERE Stellung = 0 GROUP BY Serie;
SELECT COUNT(*) AS ohne_lage FROM Treffer WHERE x = 0 AND y = 0;
SELECT Ring, COUNT(*) AS anzahl FROM Treffer WHERE Ring <= 1 GROUP BY Ring;
SELECT COUNT(*) AS mit_text FROM Treffer WHERE Text <> '';
SELECT s.DisziplinID, t.Stellung, t.Wertung, COUNT(*) AS anzahl FROM Treffer t
JOIN Scheiben s ON s.ScheibenID = t.ScheibenID GROUP BY s.DisziplinID, t.Stellung, t.Wertung;
SELECT COUNT(*) AS frei_mit_treffern FROM Scheiben s WHERE TRIM(s.Nachname) = '--frei--'
AND EXISTS (SELECT 1 FROM Treffer t WHERE t.ScheibenID = s.ScheibenID);
```

## Schießprotokoll

Das Werkzeug [[ssmdb2-erkundung]] führt durch diese Versuche in einer Fassung, die man allein schießen kann, und liest dabei jede Sekunde mit.

Diese Versuche schießen wir mit der Standaufsicht an einem Abend, während ein kleines Skript wie die Brücke mitliest und jeden Zustand mit Zeit festhält (SP-0.6 der [[spiegel-roadmap]]). Die Fälle stehen mit IDs in [[spiegel-edge-cases]].

1. **Achsen und Latenz:** einen Probeschuss bewusst hoch rechts setzen; sind x und y positiv, zeigt y nach oben. Zeit bis zur neuen Zeile stoppen.
2. **Probe und Zeitstempel:** Steigt `Scheiben.Zeitstempel` bei einem Probeschuss?
3. **Probe → Wertung → Probe:** 3 Probe, 2 Wertung, zurück auf Probe, 2 Probe, 2 Wertung; nach jeder Stufe abfragen. Bleibt die Probe stehen? Lässt sich zurückschalten, und mit welcher Nummer landet der Schuss?
4. **Lange Probe:** LP 40 mit 15 Probeschüssen. Was zählt `Trefferzahl`, und hält Meyton die Scheibe für fertig?
5. **Nur Probe:** eine Scheibe nur mit Probe beenden. Steht sie in `Scheiben`, mit welcher `Trefferzahl`?
6. **Abbruch:** eine Scheibe nach drei Wertungsschüssen beenden. Welcher `Status`, welche Zahlen?
7. **Ohne Starter:** ohne gewählten Namen schießen und ausdrucken. Landet die Scheibe in der Ablage, und unter welchem Namen (`--frei--`)?
8. **Zwischen- und Doppelausdruck:** nach fünf Schuss drucken, weiterschießen, erneut drucken, dann noch einmal. Tragen alle Ausdrucke dieselbe ID?
9. **Korrektur:** Die Aufsicht löscht einen Schuss und korrigiert einen Wert, soweit die Anlage das erlaubt. Rücken die Nummern nach, ändert sich `Text`?
10. **Falsche Disziplin:** ein paar Schuss mit dem Luftgewehr auf einer Luftpistolen-Disziplin. Was steht in `Ring01`?
11. **Verdeckte Wertung:** wenn die Aufsicht es einrichten kann, zwei Schuss im Modus 10. Was zeigen `Treffer` und `TotalRing`?

Fehlschüsse schießen wir nicht absichtlich; die SQL-Checkliste sucht sie in der Historie (`Ring <= 1`).
