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

- **Nur lesen:** Abfragen in Read-only-Sitzungen (`SET SESSION TRANSACTION READ ONLY`, sonst Rückfrage)
  mit nur `SELECT`, `SHOW`, `EXPLAIN`; im General Log einer Testanlage nachgeprüft. Die Kopie
  (`mariadb-dump --single-transaction --skip-lock-tables --force`) sendet dazu nur Sitzungsbefehle, nie
  `LOCK TABLES` (unter MyISAM würde das ShootMaster blockieren, SF-51). Die Checkliste bricht jede
  Abfrage nach 60 s ab (`max_statement_time` bzw. `max_execution_time`).
- **Zugang:** Benutzer `meyton` wird vorgeschlagen, das Passwort steht im Handbuch und wird nur
  abgefragt; es geht über eine temporäre Datei (Rechte 600, beim Beenden gelöscht) an den Client, nie
  über die Kommandozeile und nie ins Repo. Dieselbe Datei schaltet die Zertifikatsprüfung des
  MariaDB-11-Clients ab, der sonst einen Server ohne TLS ganz verweigert.
- **Nicht abbrechen:** Fehlt eine Tabelle, eine Spalte, `NOW(3)` oder das Recht auf eine View, steht der
  Fehler im Bericht und der Lauf geht weiter; bricht er doch ab, nennt das Skript Ordner und Fortsetzung.
- **Keine Namen im Bericht** ([[adr-029]]): Die Checkliste fragt Personenbezüge nur als Anzahlen ab. Der
  Mitschnitt trägt in `bericht/protokoll.tsv` stabile Pseudonyme (`P1` für Namen, `S1` für
  Sportpassnummern; Spalten ohne Groß-/Kleinschreibung erkannt), `--frei--` bleibt stehen (SF-13). Das
  Rohprotokoll mit Namen liegt in `privat/`. Am Ende sucht die Namensprüfung alle Namen und
  Sportpassnummern (ab fünf Stellen) der Ablage als ganze Wörter im Bericht und meldet nur Anzahlen;
  ist sie nicht möglich, gibt `LIESMICH.md` keine Entwarnung.
- **Mitschnitt** wie die Brücke: je Durchgang eine Read-only-Transaktion über Scheiben, Serien und
  Treffer der betroffenen Scheiben. Das Zeitfenster kommt aus den Daten (jüngster Eintrag oder
  Server-Uhr, was früher ist, minus zehn Minuten), damit ein Versatz zwischen Server-Uhr und
  Zeitstempeln nicht stört (SF-29, SF-31). Vor Schritt 1 laufen alle Abfragen einmal im Vordergrund;
  nach jedem Schritt zeigt das Skript, wie viele Stände es gesehen hat, und warnt rot, wenn es keine
  sind. Das Netz über `Treffer.Zeitstempel` (SF-50) läuft alle 10 s, bei einem Vollscan laut `EXPLAIN`
  nur alle 60 s. Nur der Mitschnitt schreibt ins Rohprotokoll; Marker der Schritte übernimmt er aus
  einer eigenen Datei. Gemessen wird die Stand-Abfrage allein; die Grundlast des Clients (`SELECT 1`, im
  Docker-Fall vor allem `docker exec`, gemessen 85 bis 240 ms) zieht er ab. Liegt eine Abfrage mehr als
  300 ms darüber, verdoppelt er den Takt (SF-49), nach zehn schnellen halbiert er ihn wieder.
- Der Mac bleibt wach (`caffeinate`); `smbutil` fragt nie nach einem Passwort.

## Selbsttest

`tools/ssmdb2-erkunden/test/selbsttest.sh` startet `mariadb:11` **ohne TLS**, mit einem Benutzer, der
nur lesen darf, dem Schema nach Handbuch V9 (MyISAM) und Testdaten mit erfundenen Namen. Er läuft:

- alle Phasen mit `--auto`; der Simulator schießt je Schritt mit Zeitstempeln zwei Stunden hinter der
  Server-Uhr, darunter die ungünstige Lesart von SF-03 (die Probe verschwindet mit dem ersten
  Wertungsschuss);
- eine zweite Datenbank mit anderem Schema (Tabellen klein geschrieben, ohne `Version`, eine Spalte
  `Name`, eine View): kein Abbruch, Kopie als unvollständig gemeldet, Namensprüfung „nicht möglich“,
  der Mitschnitt meldet in der Vorprüfung, dass er nicht lesen kann, die Schritte laufen trotzdem;
- einen Lauf ohne `--auto` mit Antworten über stdin, wie am Abend (er fand, dass `docker exec -i`
  Eingaben des Users verbrauchte), mit der ID so getippt, wie sie gedruckt ist (`ID: FF914420`).

53 Prüfungen, unter anderem: Kopie einspielbar mit gleichen Zeilen, keine Testnamen und kein Passwort in
der Ausgabe, Zugangsdateien gelöscht, verschwindende Probe im Protokoll sichtbar, `ff914420` → −7257056
samt Tabellenzeile. Gegenproben: ohne gelöschte Probe und mit einer Abfrage, die Namen ausgibt, werden
die zugehörigen Prüfungen rot. Läuft auch mit der macOS-Bash 3.2 (`ERKUNDEN_BASH=/bin/bash`).

## Danach

`bericht/` wird mit `/ingest` ausgewertet: Antworten in [[meyton-ssmdb2]], [[spiegel-open-questions]]
und [[spiegel-edge-cases]], echtes Schema für SP-1.0b. Die Kopie in `privat/` dient als lokale
Entwicklungs-Datenbank und gehört nie ins Repo.
