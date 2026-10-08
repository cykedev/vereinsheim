---
id: ssmdb2-erkundung
type: operation
title: "SSMDB2 vor Ort erkunden (Werkzeug für SP-0.1 und SP-0.6)"
aliases: [erkunden.sh, ssmdb2-erkunden, erkundungsabend, schießprotokoll-skript]
keywords: [erkundung, vor ort, schützenheim, skript, erkunden.sh, sql-checkliste, schießprotokoll, mitschnitt, dump, kopie, mysql-client, mariadb, docker, read-only, nur lesen, pseudonym, bericht, privat, selbsttest, testanlage, probe verschwindet, latenz, pdf-id, sp-0.1, sp-0.6]
part_of: ["[[meyton]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-edge-cases]]", "[[spiegel-open-questions]]", "[[spiegel-roadmap]]"]
governed_by: ["[[adr-027]]", "[[adr-029]]"]
---

**TL;DR** `tools/ssmdb2-erkunden/erkunden.sh` erledigt SP-0.1 und SP-0.6 an einem Abend: Es verbindet sich read-only mit der SSMDB2, beantwortet die SQL-Checkliste, zieht eine vollständige Kopie und führt durch ein Schießprotokoll, das man allein schießen kann, während es jede Sekunde mitliest. Heraus kommen `bericht/` (ohne Namen, zum Auswerten) und `privat/` (Kopie mit Namen, bleibt auf dem Mac). Ein Selbsttest spielt den Abend vorher gegen eine nachgebaute Anlage durch.

# SSMDB2 vor Ort erkunden

Anleitung für den Abend: `tools/ssmdb2-erkunden/README.md`. Plan: `plans/2026-10-08-ssmdb2-erkunden.md`.

## Phasen

| Phase | Was | Wann |
|---|---|---|
| `selbsttest` | Client (lokal oder Docker `mariadb:11`), `perl`, `awk`, `gzip`, `curl` | zu Hause und vor Ort |
| `verbinden` | Version, `NOW()` gegen die Uhr des Macs, Zeitzonen, Zeichensatz, Tabelle `Version`, Internet aus dem Gerätenetz, SMB-Freigaben | sofort |
| `checkliste` | die SQL-Checkliste aus [[meyton-ssmdb2]] in zehn Themen (`abfragen/`), dazu Skalen, Grenzen des Vertrags, Zeittypen | niemand schießt |
| `dump` | vollständige Kopie ohne `LOCK TABLES`, Schema ohne Daten | niemand schießt |
| `protokoll` | elf geführte Schritte, Mitschnitt jede Sekunde, IDs der Ausdrucke | beim Schießen |
| `abschluss` | Checkliste ein zweites Mal, Namensprüfung, `LIESMICH.md` | danach |

## Regeln

- **Nur lesen:** jede Sitzung `SET SESSION TRANSACTION READ ONLY` (sonst Rückfrage), nur `SELECT`, `SHOW`,
  `EXPLAIN`; die Kopie mit `--single-transaction --skip-lock-tables` (unter MyISAM würde `LOCK TABLES`
  ShootMaster blockieren, SF-51).
- **Zugang** nur abgefragt, in einer temporären Datei mit Rechten 600 an den Client gegeben und beim
  Beenden gelöscht; nie auf der Kommandozeile.
- **Keine Namen im Bericht** ([[adr-029]]): Die Checkliste fragt Personenbezüge nur als Anzahlen ab. Der
  Mitschnitt trägt in `bericht/protokoll.tsv` stabile Pseudonyme (`P1` für Namen, `S1` für
  Sportpassnummern; gleicher Wert, gleiches Pseudonym), `--frei--` bleibt stehen (SF-13). Das
  Rohprotokoll mit Namen liegt in `privat/`. Am Ende sucht die Namensprüfung alle Namen und Nummern der
  Ablage als ganze Wörter im Bericht und meldet nur Anzahlen.
- **Mitschnitt** wie die Brücke: je Durchgang eine Read-only-Transaktion über Scheiben, Serien und
  Treffer der Scheiben ab Start minus zehn Minuten, alle zehn Durchgänge zusätzlich über
  `Treffer.Zeitstempel` (SF-50). Geschrieben wird nur bei Änderung, mit Mac-Zeit, Anlagenzeit und
  Dauer. Die Grundlast des Clients (im Docker-Fall vor allem `docker exec`, etwa 200 ms) wird zu Beginn
  gemessen; nur was darüber liegt, zählt als Abfragekosten und kann den Takt verlangsamen (SF-49).

## Selbsttest

`tools/ssmdb2-erkunden/test/selbsttest.sh` startet `mariadb:11` mit einem geschätzten Schema (MyISAM,
Spalten wie die Vertrags-Beispiele) und Testdaten mit erfundenen Namen, lässt alle Phasen mit `--auto`
laufen und simuliert das Schießen je Schritt, darunter die ungünstige Lesart von SF-03 (die Probe
verschwindet mit dem ersten Wertungsschuss). 33 Prüfungen, unter anderem: Kopie einspielbar mit
gleichen Zeilen, keine Testnamen und kein Passwort in der Ausgabe, verschwindende Probe im Protokoll
sichtbar, `ff914420` → −7257056. Läuft auch mit der macOS-Bash 3.2 (`ERKUNDEN_BASH=/bin/bash`).

## Danach

`bericht/` wird mit `/ingest` ausgewertet: Antworten in [[meyton-ssmdb2]], [[spiegel-open-questions]]
und [[spiegel-edge-cases]], echtes Schema für SP-1.0b. Die Kopie in `privat/` dient als lokale
Entwicklungs-Datenbank und gehört nie ins Repo.
