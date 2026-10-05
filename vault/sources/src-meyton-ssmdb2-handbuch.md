---
id: src-meyton-ssmdb2-handbuch
type: source
title: "Meyton: Beschreibung der Scheibenablage in der Meyton-DB (SSMDB2), Datenbankversion 9"
url: https://software.meyton.info/wp-content/uploads/Upload/Manuals/DE/SSMDB2/Scheibenablage_SSMDB2_V9_de.pdf
retrieved: 2026-10-05
keywords: [ssmdb2, handbuch, scheibenablage, meyton elektronik, datenbankversion 9]
---

**TL;DR** Siebenseitiges Herstellerhandbuch (Stand 23.02.2026) zur MySQL-Ablage SSMDB2: Zugang, Befüllung über Kontrollzentrum und Programme, die drei Tabellen `Scheiben`, `Serien`, `Treffer` mit Feldern und Datentypen, Aufbau der DisziplinID, Status-Werte und Wertungsmodi 0–12.

Provenienz-Note. Das Original wird bewusst **nicht** in `.raw/` abgelegt: Es ist ein urheberrechtlich geschütztes Herstellerdokument und öffentlich unter der URL abrufbar. Die entscheidungsrelevanten Punkte stehen als Auszug in [[meyton-ssmdb2]].

Kernpunkte:

- MySQL-Datenbank `SSMDB2` auf dem Meyton-Serverrechner, Standard-IP 192.168.10.200, Standard-Zugangsdaten im Handbuch; Zugriff auch per MySQL Connector/ODBC.
- Befüllung automatisch durch den Dienst im Kontrollzentrum (Bereich SSMDB2) oder manuell aus accmanII, masterII, ranklistII.
- `Treffer.x`/`y` in 1/100 mm im kartesischen System mit Ursprung in der Scheibenmitte; `Stellung = 0` ist die Probestellung; Zeitstempel in Sekunden plus Feld Millisekunden.
- DisziplinID: Entfernung, DSB-Regelnummer, Zahl der Wertungsschüsse (Beispiel 40180060).
