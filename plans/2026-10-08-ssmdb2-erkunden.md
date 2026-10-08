# Plan: SSMDB2 vor Ort erkunden (SP-0.1 + SP-0.6)

- **Roadmap:** `vault/spiegel/spiegel-roadmap.md`, SP-0.1 (SQL-Checkliste) und SP-0.6 (Schießprotokoll mit Mitschnitt)
- **Entscheidungen:** ADR-027 (nur lesen, Änderung vom 8. Oktober 2026: Brücke ohne Zustand), ADR-029 (keine Namen ins Repo)
- **Branch:** `feat/spiegel-ssmdb2-erkunden` (auf `feat/spiegel-stateless-bridge`, das noch nicht gemergt ist)
- **Datum:** 2026-10-08

## 1. Context (warum)

Bevor die Brücke (SP-1.4) und der Adapter (SP-1.6b) entstehen, brauchen wir Fakten über unsere Anlage statt
Annahmen: Schema und Spaltentypen, Skalen der Ring- und Teilerfelder, Zeiten und Zeitzonen, Wertungsmodi,
Disziplin-IDs, Indizes und Abfragekosten, und vor allem, wie sich die Ablage **während** des Schießens
verhält (bleibt die Probe nach dem ersten Wertungsschuss stehen? steigt `Scheiben.Zeitstempel` bei Probe?
wie groß ist die Latenz?). Die offenen Fragen stehen in `vault/spiegel/spiegel-open-questions.md`, die
Sonderfälle mit „SQL-Checkliste“ oder „Schießprotokoll“ in `vault/spiegel/spiegel-edge-cases.md`.

Der User fährt an einem Abend ins Schützenheim, steckt seinen Mac ins Meyton-Gerätenetz und startet **ein**
Skript. Es liest nur, sichert die ganze SSMDB2 lokal, beantwortet die SQL-Checkliste und führt ihn
Schritt für Schritt durch ein Schießprotokoll, das er allein schießen kann, während das Skript mitliest.
Heraus kommen zwei Ordner: `privat/` (vollständige Kopie mit Namen, bleibt auf dem Mac) und `bericht/`
(ohne Namen und Sportpassnummern, das bekomme ich zum Auswerten). Mit dem Bericht ziehen wir in der
nächsten Session alle Antworten in den Vault und gehen SP-1.0b, SP-1.4 und SP-1.6 an.

## 2. Entscheidungen

- **D1 Ort:** `tools/ssmdb2-erkunden/` (neues Verzeichnis an der Wurzel). Nicht unter `scripts/`: das ist
  Ops-CLI und im Autopilot geschützt; das Werkzeug gehört zur Entwicklung, nicht zum Betrieb.
- **D2 Bash, kompatibel mit macOS-Bash 3.2** (keine assoziativen Arrays, kein `mapfile`, kein `${x,,}`),
  `#!/usr/bin/env bash`, `set -euo pipefail`. Prüfung mit `shellcheck` und `bash -n`.
- **D3 MySQL-Client:** zuerst lokal `mariadb`/`mysql` und `mariadb-dump`/`mysqldump`; sonst Docker mit dem
  Image `mariadb:11` (liegt schon lokal, braucht kein Internet am Abend). Docker Desktop erreicht das
  Gerätenetz über NAT. `--selbsttest` prüft vorher zu Hause, dass ein Client da ist.
- **D4 Nur lesen, sanft:** jede Verbindung mit `--init-command="SET SESSION TRANSACTION READ ONLY"`, nur
  `SELECT`, `SHOW`, `EXPLAIN`. Der Dump mit `--single-transaction --skip-lock-tables --no-tablespaces`
  (kein `LOCK TABLES`, das unter MyISAM ShootMaster blockieren würde) und **nur vor oder nach dem
  Schießen**; das Skript fragt vor dem Dump nach, ob gerade jemand schießt.
- **D5 Zugangsdaten** (Standard-Zugang laut Handbuch) fragt das Skript ab (`read -s` für das Passwort) und
  schreibt sie nur in eine temporäre Datei mit Rechten `600`, die als `--defaults-extra-file` dient und
  beim Beenden (`trap … EXIT`) gelöscht wird. Nie auf der Kommandozeile, nie im Ausgabeordner. Host,
  Port und Datenbank mit Vorgaben `192.168.10.200`, `3306`, `SSMDB2`, per Option änderbar.
- **D6 Ausgabe** nach `~/ssmdb2-erkundung/<JJJJ-MM-TT_HHMM>/` (außerhalb des Repos):
  - `privat/ssmdb2.sql.gz` (vollständiger Dump, Namen enthalten; später lokale Entwicklungs-DB),
    `privat/protokoll-roh.tsv` (Mitschnitt mit Namen).
  - `bericht/` ohne Personendaten: `schema.sql` (`--no-data`), `antworten.md` (Checkliste mit Ergebnissen),
    `protokoll.tsv` (Mitschnitt, Namen ersetzt), `schritte.md` (Marker der geführten Schritte mit Zeit),
    `umgebung.md` (Client, Server-Version, Uhrabweichung, Netz).
  - **Ersetzt** werden die Spalten `Nachname`, `Vorname`, `SportpassID` (auch in Aggregaten: nur Zahlen,
    keine Werte). `--frei--` und leere Namen bleiben stehen, sie sind Platzhalter, keine Personen (SF-13).
    Das macht ein `awk`-Filter über die Kopfzeile, also auch bei unbekannten Spaltenreihenfolgen.
- **D7 Ablauf** in Phasen, jede einzeln aufrufbar (`erkunden.sh <phase>`), ohne Argument alle mit
  Rückfragen: `selbsttest` → `verbinden` (Version, Uhr, Zeitzonen, Zeichensatz) → `checkliste` (SQL-
  Checkliste, siehe D8) → `dump` → `protokoll` (geführtes Schießen mit Mitschnitt, D9) → `abschluss`
  (zweiter kurzer Checklisten-Lauf für die neuen Scheiben, Zusammenfassung, Hinweis welche Ordner
  weitergegeben werden dürfen).
- **D8 Checkliste** als nummerierte SQL-Dateien in `tools/ssmdb2-erkunden/abfragen/`, jede mit
  Kopfkommentar `-- Frage:` und `-- Belegt:` (SF-IDs bzw. offene Frage). Inhalt: die Liste aus
  `vault/meyton/meyton-ssmdb2.md` („Erkundung vor Ort“), aufgeteilt nach Thema, plus diese Ergänzungen:
  - Zeichensatz und Kollation (`SHOW VARIABLES LIKE 'character_set%'`, Tabellen-Charset) für die
    `utf8mb4`-Annahme der Brücke (Review SP-1.0a, N4).
  - **Skalen:** `Serien.Ring`/`Ring01` gegen die Summen aus `Treffer`, `Scheiben.TotalRing`/`TotalRing01`
    gegen die Summen, `Teiler01`/`Teiler001` gegen `SQRT(x*x+y*y)` (Verhältnis, Min/Max), Spanne von
    `Millisekunden`, `Innenzehner` gegen den Abstand.
  - **Grenzen des Vertrags** (`packages/ingest-contract/src/limits.ts`): Spalten je Tabelle, größte
    Treffer- und Serienzahl je Scheibe, längster Textwert je Spalte.
  - **Zeit:** Spaltentypen von `Zeitstempel`/`Startzeit` (`DATETIME` oder `TIMESTAMP`, SF-31), `NOW()` der
    Anlage gegen die Uhr des Macs (SF-29), älteste und jüngste Scheibe.
  - Alle Personenbezüge nur als Zahlen (z. B. „SportpassIDs mit mehreren Namen: 3“).
  - Abfragen, die ganze Tabellen lesen, nur in dieser Phase (nicht während des Protokolls).
- **D9 Geführtes Schießprotokoll** (allein schießbar, Schritte überspringbar mit `s`):
  1. Einen Probeschuss bewusst hoch rechts (Achsen; x, y positiv?).
  2. Drei Probe, zwei Wertung, zurück auf Probe (falls möglich), zwei Probe, zwei Wertung (SF-03, SF-04).
  3. Neue Scheibe nur mit Probe beenden (SF-01).
  4. Neue Scheibe: drei Wertung, dann beenden (Abbruch, SF-07).
  5. Ohne Starter schießen und ausdrucken (SF-13, „Landen Trainings ohne Starter in der SSMDB2?“).
  6. Nach fünf Schuss drucken, weiterschießen, nochmal drucken; das Skript fragt die ID aus dem Fuß jedes
     Ausdrucks ab (`ID: xxxxxxxx`), dekodiert sie als vorzeichenbehaftete 32-Bit-Zahl und sucht die
     Scheibe (SF-42, SF-43, SP-0.2).
  7. Optional, wenn die Anlage es erlaubt: Korrektur eines Schusses (SF-21, SF-22), lange Probe (15 Schuss,
     SF-02), falsche Disziplin (SF-16), verdeckte Wertung Modus 10 (SF-19), „LG/LP Training Spiegel“.
  Vor jedem Schritt zeigt das Skript die Anweisung, der User schießt und drückt Enter; das Skript setzt
  einen Marker mit Zeit in `schritte.md` und hält den Stand der betroffenen Scheiben fest.
- **D10 Mitschnitt** (läuft im Hintergrund, solange `protokoll` läuft):
  - Alle 1 s: `Scheiben` mit `Zeitstempel` ab Start minus 10 min (klein, vorher per `EXPLAIN` geprüft),
    dazu `Treffer` dieser Scheiben über den Primärschlüssel. Alle 10 s zusätzlich
    `SELECT DISTINCT ScheibenID FROM Treffer WHERE Zeitstempel >= <Start>` als Netz für den Fall, dass
    `Scheiben.Zeitstempel` bei Probe nicht steigt (SF-50).
  - Jeder Durchgang in einer Read-only-Transaktion (`START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY`,
    SF-51). Geschrieben wird nur bei Änderung: Zeitstempel des Macs in ms (`perl -MTime::HiRes`), `NOW()`
    der Anlage, Dauer der Abfrage, dann die Zeilen. So lassen sich Latenz (Schusszeit gegen erstes
    Erscheinen), verschwindende Probe und Zeitstempel-Verhalten hinterher ablesen.
  - Dauert ein Durchgang länger als 300 ms, verdoppelt das Skript den Takt und vermerkt es (SF-49, SF-52).
- **D11 Netz und Freigabe** (Phase `verbinden`, optional): Erreicht der Mac aus dem Gerätenetz das Internet
  (`curl --max-time 5 -sI https://example.com`, eine neutrale Adresse; SF-57)? Listet `smbutil view
  //<host>` die Freigaben, darunter `ERGEBNIS` und `xml_result`? Nur anzeigen, nichts mounten.
- **D12 Selbsttest gegen eine nachgebaute Anlage:** `tools/ssmdb2-erkunden/test/` startet `mariadb:11` als
  Server mit einem SSMDB2-ähnlichen Schema (Spalten wie in `packages/ingest-contract/examples/v1/`,
  Typen nach Handbuch) und ein paar Scheiben, dazu `simuliere-schiessen.sh`, das während des Protokolls
  Schüsse einträgt und nach dem ersten Wertungsschuss die Probe löscht. `erkunden.sh` läuft dagegen
  mit `--auto` (Schritte ohne Enter, feste Wartezeit). So ist das Skript vor dem Abend einmal ganz durchlaufen.
- **D13 Nicht im Umfang:** Auswertung der Ergebnisse und Eintragen in den Vault (nächste Session, via
  `/ingest` aus `bericht/`), Generator und MySQL-Fälle (SP-1.0b), irgendetwas, das in die Anlage schreibt.

## 3. Dateien

Neu:

- `tools/ssmdb2-erkunden/erkunden.sh` — Einstieg, Optionen (`--host`, `--port`, `--db`, `--user`,
  `--ausgabe`, `--auto`, `--docker`), Phasen aus D7
- `tools/ssmdb2-erkunden/lib/client.sh` — Client-Erkennung (D3), Zugangsdatei (D5), `sql_datei`,
  `sql_text` (Batch-Modus, Tab-getrennt, `NULL` wörtlich)
- `tools/ssmdb2-erkunden/lib/anonym.awk` — ersetzt `Nachname`, `Vorname`, `SportpassID` per Kopfzeile (D6)
- `tools/ssmdb2-erkunden/lib/mitschnitt.sh` — Hintergrund-Poller (D10)
- `tools/ssmdb2-erkunden/lib/protokoll.sh` — geführte Schritte (D9), ID-Dekodierung
- `tools/ssmdb2-erkunden/abfragen/NN-<thema>.sql` — Checkliste (D8), etwa 10 Dateien
- `tools/ssmdb2-erkunden/test/schema.sql`, `test/daten.sql`, `test/simuliere-schiessen.sh`,
  `test/selbsttest.sh` (D12)
- `tools/ssmdb2-erkunden/README.md` — Ablauf am Abend in kurzen Schritten (Deutsch)

Geändert:

- `vault/spiegel/spiegel-roadmap.md` (SP-0.1, SP-0.6: Werkzeug genannt), `vault/meyton/meyton-ssmdb2.md`
  (Abschnitt „Erkundung vor Ort“ verweist auf das Werkzeug), neue Note
  `vault/operations/ssmdb2-erkundung.md` (`type: operation`, Ablauf am Abend, was in `bericht/` steht, was
  nie weitergegeben wird)

## Required Docs

- `vault/meyton/meyton-ssmdb2.md` (Zugang, Tabellen, Stolperfallen, Erkundung vor Ort, Schießprotokoll)
- `vault/spiegel/spiegel-edge-cases.md` (SF-01 bis SF-07, SF-13 bis SF-22, SF-29 bis SF-32, SF-35, SF-42,
  SF-43, SF-49 bis SF-52, SF-57, SF-64)
- `vault/spiegel/spiegel-open-questions.md`, `vault/meyton/meyton-printout.md` (ID im Fuß)
- `vault/spiegel/spiegel-ingest-contract.md` (Grenzen, Zeichensatz), `vault/conventions.md`

## 4. Tasks (je ein Commit)

1. Plan committen (dieser Commit).
2. Testanlage (`test/schema.sql`, `test/daten.sql`, `test/selbsttest.sh` startet und stoppt den Container)
   und `lib/client.sh` mit `erkunden.sh selbsttest` und `verbinden`; Test: gegen die Testanlage
   verbinden, Version und Uhr erscheinen in `bericht/umgebung.md`, das Passwort steht in keiner Datei
   unter der Ausgabe (`grep -r`).
3. `lib/anonym.awk` + Checkliste `abfragen/*.sql` + Phase `checkliste`; Test: `antworten.md` enthält jede
   Frage mit Ergebnis, kein Name aus `test/daten.sql` taucht in `bericht/` auf.
4. Phase `dump` (privat + Schema); Test: Dump lässt sich in einen zweiten Container einspielen,
   Zeilenzahlen gleich.
5. `lib/mitschnitt.sh` + `lib/protokoll.sh` + `test/simuliere-schiessen.sh` + Phase `protokoll` mit
   `--auto`; Test: verschwindende Probe und neue Wertung erscheinen im Protokoll mit Zeit, Marker in
   `schritte.md`, ID-Dekodierung `ff914420` → `-7257056`.
6. Phase `abschluss`, `README.md`, Gesamtlauf `test/selbsttest.sh` (alle Phasen, `--auto`), `shellcheck`.
7. Vault: Operation-Note, Roadmap, SSMDB2-Note; `/sync-graph`.

## 5. Test steps

- `shellcheck tools/ssmdb2-erkunden/*.sh tools/ssmdb2-erkunden/lib/*.sh tools/ssmdb2-erkunden/test/*.sh` sauber.
- `bash tools/ssmdb2-erkunden/test/selbsttest.sh`: startet die Testanlage, läuft alle Phasen mit `--auto`,
  prüft die Ausgabe (Dateien vorhanden, keine Testnamen in `bericht/`, Protokoll zeigt die gelöschte
  Probe, Dump einspielbar), räumt den Container ab; Exit 0.
- Auch mit `/bin/bash` (3.2) einmal `bash -n` und `selbsttest` (Kompatibilität).
- `pnpm check` bleibt grün (das Werkzeug liegt außerhalb der Pakete).

## 6. Verification

- Selbsttest grün, Ausgabe einmal von Hand durchgesehen (`antworten.md` lesbar, `protokoll.tsv`
  verständlich).
- Am Abend im Schützenheim: Lauf des Users; danach `bericht/` lesen und mit `/ingest` in den Vault
  übernehmen (eigene Session).
