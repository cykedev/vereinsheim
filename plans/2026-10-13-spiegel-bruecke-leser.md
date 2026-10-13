# Spiegel-Brücke: Leser, Änderungserkennung und Snapshots (SP-1.4 a)

## Kontext

Auftrag des Users (13. Oktober 2026, autonom): weitere offene Themen umsetzen. Nach SP-1.6 b nimmt Spiegel Snapshots an;
es fehlt die Brücke, die sie liefert ([[spiegel-bridge]], [[adr-027]]). SP-1.4 ist in drei Teile geschnitten; dieser
Plan ist **Teil a: Leser, Änderungserkennung und Snapshots, nur lokal**. Teil b (Kopplung, Upload, Heartbeat) und c
(Nachholen beim Start, Updates, Statusseite) folgen; Opt-in, Verdeckung und Aufträge sind SP-1.5.

Grundlage: [[spiegel-bridge]] (Arbeitsweise), [[spiegel-ingest-contract]] (Spezifikation für andere Sprachen),
`packages/ingest-contract` (Testvektoren aus Python, Beispiele), `packages/ssmdb2-cases` (31 Fälle mit SQL je Schritt
und Vorgabe, was die Brücke schickt).

## Entscheidungen

- **D1 Go** (SP-0.4, Empfehlung aus [[adr-027]] und [[spiegel-bridge]]): ein statisches Binary ohne Laufzeit
  (`CGO_ENABLED=0`) für linux/arm64 (Raspberry Pi), linux/amd64 (Mini-PC, Meyton-Rechner unter SUSE) und
  windows/amd64; wenig Speicher, Dienst über systemd. Der Ort (eigenes Gerät oder Meyton-Rechner) bleibt offen, das
  Binary läuft auf beiden. Entschieden ohne Rückfrage (autonom, nach der Empfehlung); als Änderung in [[adr-027]]
  vermerkt, der User bestätigt beim Merge.
- **D2 Ort und Einbindung:** `apps/spiegel-bridge` als Go-Modul `github.com/cykedev/vereinsheim/apps/spiegel-bridge`
  mit `package.json`, damit Turborepo es im Gate führt: `lint` (`go vet`), `format:check` (`gofmt -l`), `test`
  (`go test`), `check-types` (`go build`), `build` (Binaries für die drei Ziele nach `dist/`). Go ist damit Pflicht im
  Dev-Setup (wie Node); fehlt es, scheitern die Skripte mit klarer Meldung. Die Tests lesen Vektoren und Fälle direkt
  aus `packages/ingest-contract` und `packages/ssmdb2-cases` (devDependencies, damit Turborepo bei Änderungen dort
  neu testet).
- **D3 Vertrag in Go** (`internal/contract`): kanonische Form nach RFC 8785 für Strings, `null`, Objekte und Arrays
  (eigene Serialisierung, Schlüssel und Zeilen nach UTF-16-Codeeinheiten), Prüfsumme, Hülle als Struktur mit den
  Feldnamen des Schemas, Grenzen in UTF-16-Codeeinheiten, wohlgeformtes UTF-8. Ein Snapshot, der die Grenzen
  verletzt oder ungültige Bytes trägt, wird nicht gebaut (Fehlercode, keine Inhalte). Tests: alle Vektoren aus
  `checksum-v1.json` (kanonische Form und Prüfsumme), die Beispiele aus `examples/v1` (Prüfsumme und Rundreise der
  Hülle), die Fälle aus `invalid-v1.json`, die die Brücke selbst verhindern muss (Grenzen, Unicode).
- **D4 Leser** (`internal/ssmdb2`): `github.com/go-sql-driver/mysql`, `charset=utf8mb4`, Abfragen ohne Platzhalter
  (Textprotokoll; eingesetzt werden nur ScheibenIDs als ganze Zahlen), Zellen als `sql.RawBytes` → Text oder `null`.
  Sitzung fest auf `time_zone = '+00:00'` (SF-31), gemeldet als `sessionTimeZone`. Jede Runde ist **eine** kurze
  Transaktion `START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY` (SF-51): erst `ScheibenID, Zeitstempel` aller
  Scheiben (`Scheiben` hat nur den Primärschlüssel als Index, 1.532 Zeilen in 5 ms), dann `SELECT *` der drei Tabellen
  für die gewählten Scheiben über `ScheibenID IN (…)`. Spalten und Typen aus `information_schema.COLUMNS`; weicht die
  Spaltenliste des Ergebnisses davon ab (Meyton-Update während des Laufs), liest die Brücke die Spalten neu und
  verwirft die Runde. Unbekannte Spalten reisen mit (SF-25). `Version` als Text, `null`, wenn nicht lesbar.
- **D5 Änderungserkennung** (`internal/watch`, reine Logik ohne Datenbank): Im Arbeitsspeicher je Scheibe der zuletzt
  gesehene `Zeitstempel` (als Text, nie als Zahl, SF-32), wann er sich zuletzt bewegt hat (Uhr der Brücke), die
  vorige Lesung und der zuletzt gesendete Stand. Ganz gelesen wird eine Scheibe, deren Zeitstempel neu ist oder sich
  bewegt hat, deren vorige Lesung noch auf Bestätigung wartet, oder die **aktiv** ist: Lebenszeichen innerhalb der
  letzten 20 Minuten. Die aktiven fangen Korrekturen und Löschungen ohne neues Lebenszeichen (SF-21, SF-22). Beim Start
  gelten die Scheiben mit Zeitstempel bis 12 Stunden vor dem jüngsten als neu (nicht gegen die eigene Uhr: die Uhr der
  Stände kann falsch gehen, SF-73); den Abgleich ab dem Wasserstand in Spiegel bringt Teil c. Höchstens 50 Scheiben je
  Runde, die ältesten zuletzt (SF-52); der Rest folgt in der nächsten.
- **D6 Stabil und neu:** Ein Snapshot entsteht, wenn zwei Lesungen hintereinander dieselbe Prüfsumme haben (SF-71) und
  sie sich vom zuletzt gesendeten Stand unterscheidet. Ohne Treffer nie (SF-13, „auslassen“). Fehlt eine Scheibe in
  der Ablage, ist das keine Löschung (SF-24); ihr Speicher wird nach 24 Stunden ohne Kontakt freigegeben. Scheitert eine
  Abfrage, zählt die ganze Runde nicht: keine Lesung, keine Bestätigung. In Teil a wird auch ein Stand gemeldet, der
  sich nur im Lebenszeichen unterscheidet (die Vorgabe der Fälle, SF-10); die Drossel auf 30 s gehört zum Upload (b).
- **D7 Hülle:** `sequence` = Beobachtungszeit in ms, in einem Lauf streng steigend (SF-26), `observedAt` dieselbe Zeit
  in UTC mit ms, `epoch` aus der Konfiguration (Vorgabe 1; aus `GET /state` in Teil b), `source` `meyton-ssmdb2`.
- **D8 Lokal bedienbar:** `spiegel-bridge watch --dsn …` liest im Takt (1 s, solange sich etwas bewegt, sonst 30 s;
  dauert eine Runde länger als ihr Budget, streckt sich der Takt) und schreibt je Snapshot eine Zeile ohne
  Personenfelder (ScheibenID, Zahl der Zeilen, Prüfsumme); `--json` schreibt die vollen Snapshots als JSON-Zeilen für
  die Prüfung vor Ort, `--once` liest eine Runde. DSN auch aus `SPIEGEL_BRIDGE_DSN`. Nichts auf die Platte.
- **D9 Logs ohne Inhalt** (SF-59): Meldungen nur mit ScheibenID, Zahlen und festen Codes; Fehler des Treibers nur mit
  ihrer Art (sie können Werte enthalten). Ein Test lässt einen Fall mit Namen durchlaufen und sucht ihn in der Ausgabe.
- **D10 Abnahme gegen die Fälle** (`pnpm --filter spiegel-bridge replay`, Go-Test mit Build-Tag `replay`, nicht im
  Gate wie `ssmdb2-cases replay`): MariaDB 10.6 in Docker mit dem echten Schema (oder `BRIDGE_TEST_DSN`), je Fall die
  Schritte einspielen, nach jedem Schritt eine Runde lesen, bei nicht flüchtigen Lesungen zwei. Geprüft:
  - jeder gemeldete Snapshot ist bit-gleich mit dem eingefrorenen dieser Lesung (Daten und Prüfsumme);
  - für „senden“ und „auslassen“ sind die gemeldeten Lesungen genau `sentReadings`;
  - für „zurueckhalten“ und „nur-qr“ (Filter mit SP-1.5) nur Lesungen, die nicht flüchtig sind;
  - die Ausgabe enthält keinen Namen aus den Fällen.
  Dazu Unit-Tests der Erkennung mit einer Quelle im Speicher: Datenbank weg, Abfrage scheitert mitten in der Runde,
  Fehlen ist keine Löschung, Budget, Startfenster, aktive Scheiben.

## Aufgaben

1. Gerüst: `apps/spiegel-bridge` mit `go.mod`, `package.json` (Skripte, devDependencies auf die beiden Pakete),
   `.gitignore` (`dist/`), `CLAUDE.md`; Turborepo-Ausgaben für `build`.
2. `internal/contract` mit Tests gegen Vektoren und Beispiele.
3. `internal/watch` (Erkennung, Stabilität, Hülle) mit Unit-Tests.
4. `internal/ssmdb2` (Leser über `database/sql`).
5. `cmd/spiegel-bridge` (`watch`, `--once`, `--json`, `version`).
6. Abnahme `replay` gegen alle 31 Fälle, in `mariadb:10.6` und `mariadb:11`.
7. Doku: [[spiegel-bridge]] (Technik entschieden, Arbeitsweise wie gebaut), [[adr-027]] (Änderung: Go), Roadmap
   (SP-0.4 erledigt, SP-1.4 a erledigt), Architektur-Karte, Root-`CLAUDE.md`.

## Nicht in diesem Plan

Kopplung, Upload, Heartbeat, Drossel des Lebenszeichens, `Retry-After` (b); Nachholen ab dem Wasserstand, Abgleich der
letzten Tage, Selbst-Update, Statusseite (c); Opt-in-Filter, Verdeckung, Grabsteine, Aufträge (SP-1.5); Epoche und
Fingerabdruck der Quelle (b mit dem Heartbeat); Releases als Dateien (SP-1.9).
