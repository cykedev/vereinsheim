# spiegel-bridge — Claude Scope-Notiz

Die Brücke im Schützenhaus (SP-1.4, [ADR-027](../../vault/decisions/adr-027.md),
[`spiegel-bridge`](../../vault/spiegel/spiegel-bridge.md)): liest die Meyton-Ablage (SSMDB2) nur lesend und baut
Snapshots v1 für Spiegel. **Go**, ein statisches Binary ohne Laufzeit (SP-0.4, 13. Oktober 2026). Teil a
(`plans/2026-10-13-spiegel-bruecke-leser.md`): Leser, Änderungserkennung und Snapshots. Teil b
(`plans/2026-10-13-spiegel-bruecke-upload.md`): Kopplung, Upload, Heartbeat und die Filter aus SP-1.5 (Zustimmung,
verdeckt, gesperrt). Teil c (`plans/2026-10-13-spiegel-bruecke-betrieb.md`): Nachholen beim Start ab dem Wasserstand,
Dienst für systemd mit `deploy/install.sh`. Offen: Selbst-Update, Statusseite, Dienst unter Windows, Aufträge (SP-1.5).

## Befehle

| Befehl                                    | Zweck                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm --filter spiegel-bridge test`       | Go-Tests: Vertrag gegen die Vektoren aus Python, Erkennung mit einer Ablage im Speicher       |
| `pnpm --filter spiegel-bridge replay`     | Abnahme: alle Fälle aus `ssmdb2-cases` in `mariadb:10.6` (Docker), nicht im Gate (~5 s)       |
| `pnpm --filter spiegel-bridge build`      | Binaries nach `dist/` für linux/arm64, linux/amd64, windows/amd64                             |
| `go run ./cmd/spiegel-bridge watch`       | lokal lesen; je Snapshot eine Zeile ohne Personenfelder, `--json` volle Snapshots, `--once`   |
| `spiegel-bridge pair --url --code`        | koppeln (Code aus Admin → Anlage und Brücken), schreibt die Konfiguration (0600, atomar)      |
| `spiegel-bridge run`                      | Betrieb: Zustand, Runden, Filter, Upload, Heartbeat; Exit 3 bei widerrufenem Token            |
| `pnpm --filter spiegel bridge-e2e`        | Ende zu Ende gegen den eigenen Build von Spiegel (:3012), MariaDB und drei Fälle (`--keep`)   |

Den Zugang zur SSMDB2 über `SPIEGEL_BRIDGE_DSN` geben, nicht über `--dsn`: Ein Passwort in der Befehlszeile steht in `ps`
und im Verlauf der Shell. `REPLAY_DOCKER_IMAGE=mariadb:11` prüft gegen MariaDB 11,
`REPLAY_SERVER_ARGS=--transaction-isolation=READ-COMMITTED` mit anderer Einstellung der Anlage, `BRIDGE_TEST_DSN` gegen
einen laufenden Server (legt `SSMDB2` neu an). Go ist Pflicht im Dev-Setup wie Node (`brew install go`); das Gate ruft `go vet`, `gofmt`, `go test`, `go build`.

## Aufbau

| Paket                | Inhalt                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `internal/contract`  | Snapshot v1, kanonische Form (RFC 8785, eigene Serialisierung), Prüfsumme, Grenzen, `Validate`, `Summary` |
| `internal/watch`     | Änderungserkennung im Arbeitsspeicher: Wahl der Scheiben je Runde, zwei gleiche Lesungen, Hülle           |
| `internal/ssmdb2`    | Leser über `database/sql` und `go-sql-driver/mysql`; `Code` für Fehler ohne Inhalt                         |
| `internal/api`       | Client der API v1 (Kopplung, Zustand, Stapel, Heartbeat), `CheckURL` (HTTPS, `http` nur für localhost)    |
| `internal/config`    | die Konfiguration, das Einzige auf der Platte: `Save` atomar mit 0600, `Load`, `CheckWritable`             |
| `internal/filter`    | wer hinaus darf: Zustimmung (`SportpassHash`), verdeckt, gesperrt; Regeln wie in Spiegel                   |
| `internal/run`       | der Betrieb: `Step` je Runde, Upload ohne Warteschlange, Pausen, Heartbeat                                 |
| `cmd/spiegel-bridge` | `pair`, `run`, `watch` (Takt 1 s, wenn sich etwas bewegt, sonst 30 s), `version`                          |

## Regeln

- **Vertrag nur gegen die Dateien des TS-Pakets:** Vektoren (`test-vectors/`) und Beispiele (`examples/v1/`) liest der
  Go-Test aus `packages/ingest-contract`, die Fälle aus `packages/ssmdb2-cases`; nichts davon wird kopiert.
  `encoding/json` ist nicht kanonisch (escapet `<`, `>`, `&`, U+2028; sortiert nach Bytes), deshalb `Canonical`.
- **Nur lesen:** feste Abfragen ohne Platzhalter (Platzhalter schalten auf das Binärprotokoll, das Datumswerte umdeutet),
  eingesetzt werden nur ScheibenIDs als ganze Zahlen. Jede Runde eine Transaktion `WITH CONSISTENT SNAPSHOT, READ ONLY`,
  danach `ROLLBACK`. Zellen als `sql.RawBytes` → Text oder `nil`. Sitzung `time_zone '+00:00'`, `charset` über
  `mysql.Charset` (als Parameter setzt der Treiber v1.10 ihn als Systemvariable und scheitert).
- **Alle Spalten** mit Typ aus `information_schema`, jede Runde in ihrer Transaktion neu gelesen: Eine neue Spalte oder ein
  neuer Typ reist sofort mit (SF-25, Test `TestReplayColumnsChangeWhileRunning`). Passt das Ergebnis nicht zur Liste,
  zählt die Runde nicht.
- **Transaktion:** vor jeder `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`; `WITH CONSISTENT SNAPSHOT` gilt nur dort,
  und die Anlage könnte READ COMMITTED eingestellt haben. Der Treiber schreibt keine eigenen Meldungen
  (`mysql.SetLogger`), `columnsWithAlias` ist aus.
- **Erkennung** (`watch`): gelesen wird, was wartet (vorige Lesung neu, noch nicht bestätigt), was sich bewegt hat
  (neu oder Lebenszeichen anders, auch wenn das Budget von 50 Scheiben je Runde es verschob) und was aktiv ist
  (Lebenszeichen in den letzten 20 min, fängt Korrekturen ohne Lebenszeichen, SF-21, SF-22, SF-74). Beim Start gilt
  als neu, was bis 12 h vor dem jüngsten Lebenszeichen liegt; Lebenszeichen mehr als einen Tag nach der Uhr der Anlage
  (`NOW(3)`) verankern das Fenster nicht (ein vorgehender Stand, SF-73). `Busy` zählt nur Scheiben, die in der Runde in
  der Ablage standen. `observedAt` ist die echte Beobachtung, nur die Folgenummer zählt nach einem Rücksprung der Uhr
  weiter. Gesendet wird nach zwei gleichen Lesungen (SF-71), nur ein
  neuer Stand gegenüber dem zuletzt gemeldeten, nie ohne Treffer (SF-13). Eine gescheiterte Runde ändert nichts; Fehlen
  ist keine Löschung (SF-24). Jede Regel hat einen Fall, der ohne sie rot wird (Gegenproben im Bericht).
- **Nichts auf die Platte, keine Personenfelder in der Ausgabe** (SF-59): Meldungen nur mit Zahlen und Codes
  (`ssmdb2.Code`, nie `err.Error()` des Treibers), Snapshots als `Summary`; `--json` ist für die Prüfung vor Ort und
  gibt die vollen Daten aus. Der Replay-Test sucht die Namen der Fälle in der Ausgabe.
- **Erst bestätigt ist gesendet** (Teil b): `Watcher.Delivered` nach einem endgültigen Ergebnis von Spiegel (alle außer
  `future` und `epoch-unconfirmed`) oder wenn der Filter die Scheibe zurückhält. Bis dahin wartet sie und wird jede
  Runde neu gelesen; nach einem gescheiterten Upload geht hinaus, was dann in der Ablage steht (keine Warteschlange).
  Ein Stand, der sich vom bestätigten nur im Lebenszeichen unterscheidet, höchstens alle 30 s (`LifesignEvery`).
- **Filter wie Spiegel** (`internal/filter`): dieselben Regeln wie `ingest.ts` und `hasHeldShot` (Zustimmung über den
  Hash aus `GET /state`, `Wertung` 0, 5, 10 oder unlesbar hält die ganze Scheibe, Sperre derselben ID bis 30 Tage um den
  Beginn). Ändert sich eine Regel in Spiegel, hier mitziehen. Ohne Zustand lädt die Brücke nichts hoch (SF-38); eine neue
  Zustimmung oder bestätigte Epoche schickt, was noch im Speicher ist (`Resend`).
- **Antworten:** 429/503 `Retry-After` abwarten, 413 teilen, 401 beendet (`ErrUnauthorized`, Exit 3), 400 verwirft den
  Stapel (Fehler der Brücke), Netz und 5xx mit Pause 5 s bis 60 s. Je Stapel eine Zeile `batch` mit den Ergebnissen
  als Zahlen.
- **Nachholen beim Start** (SF-55): aus `state.watermark` (UTC) minus einem Tag in der Zone der Anlage
  (`catchUpFrom`, Zonen eingebaut über `time/tzdata`) wird ein Lebenszeichen; Scheiben davor im Startfenster liest die
  Erkennung einmal (`SetCatchUpFrom`, Rang 3), aber erst, wenn 20 Minuten nichts mehr läuft (SF-52), und hält den Takt
  bis dahin nicht hoch. Ohne Wasserstand (erste Brücke) nichts; die Historie ist SP-2.5.
- **Dienst** (`deploy/`): `install.sh` legt Binary, Benutzer, `/etc/spiegel-bridge` (0700) und die Unit an; die Unit
  läuft ohne Rechte, mit schreibgeschütztem System, 128 MB, kein Neustart bei Exit 2 und 3. `pair` fragt den Zugang
  zur SSMDB2 auf stdin ab, wenn weder `--dsn` noch die Umgebung ihn nennen. Geprüft in `debian:12` mit
  `systemd-analyze verify`.
- **Heartbeat** jede Minute, der erste nach der ersten Runde, nie mit Namen oder Nummern; `possible-reset` nur gemeldet
  (die Zahl der Scheiben fällt um mehr als die Hälfte), eine neue Epoche eröffnet die Brücke nicht (Plan D8).
- Nach Änderungen: `pnpm check` (vom Repo-Root), `pnpm --filter spiegel-bridge replay` und bei Upload oder Filter
  `pnpm --filter spiegel bridge-e2e` (nach `pnpm --filter spiegel build`).
