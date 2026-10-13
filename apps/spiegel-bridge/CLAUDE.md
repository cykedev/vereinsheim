# spiegel-bridge — Claude Scope-Notiz

Die Brücke im Schützenhaus (SP-1.4, [ADR-027](../../vault/decisions/adr-027.md),
[`spiegel-bridge`](../../vault/spiegel/spiegel-bridge.md)): liest die Meyton-Ablage (SSMDB2) nur lesend und baut
Snapshots v1 für Spiegel. **Go**, ein statisches Binary ohne Laufzeit (SP-0.4, 13. Oktober 2026). Seit Teil a
(`plans/2026-10-13-spiegel-bruecke-leser.md`): Leser, Änderungserkennung und Snapshots, nur lokal. Kopplung, Upload und
Heartbeat folgen in Teil b, Nachholen und Updates in c, Opt-in und Verdeckung in SP-1.5.

## Befehle

| Befehl                                    | Zweck                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm --filter spiegel-bridge test`       | Go-Tests: Vertrag gegen die Vektoren aus Python, Erkennung mit einer Ablage im Speicher       |
| `pnpm --filter spiegel-bridge replay`     | Abnahme: alle Fälle aus `ssmdb2-cases` in `mariadb:10.6` (Docker), nicht im Gate (~5 s)       |
| `pnpm --filter spiegel-bridge build`      | Binaries nach `dist/` für linux/arm64, linux/amd64, windows/amd64                             |
| `go run ./cmd/spiegel-bridge watch --dsn` | lokal lesen; je Snapshot eine Zeile ohne Personenfelder, `--json` volle Snapshots, `--once`   |

`REPLAY_DOCKER_IMAGE=mariadb:11` prüft gegen MariaDB 11, `BRIDGE_TEST_DSN` gegen einen laufenden Server (legt `SSMDB2`
neu an). Go ist Pflicht im Dev-Setup wie Node (`brew install go`); das Gate ruft `go vet`, `gofmt`, `go test`, `go build`.

## Aufbau

| Paket                | Inhalt                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `internal/contract`  | Snapshot v1, kanonische Form (RFC 8785, eigene Serialisierung), Prüfsumme, Grenzen, `Validate`, `Summary` |
| `internal/watch`     | Änderungserkennung im Arbeitsspeicher: Wahl der Scheiben je Runde, zwei gleiche Lesungen, Hülle           |
| `internal/ssmdb2`    | Leser über `database/sql` und `go-sql-driver/mysql`; `Code` für Fehler ohne Inhalt                         |
| `cmd/spiegel-bridge` | `watch` (Takt 1 s, wenn sich etwas bewegt, sonst 30 s), `version`                                         |

## Regeln

- **Vertrag nur gegen die Dateien des TS-Pakets:** Vektoren (`test-vectors/`) und Beispiele (`examples/v1/`) liest der
  Go-Test aus `packages/ingest-contract`, die Fälle aus `packages/ssmdb2-cases`; nichts davon wird kopiert.
  `encoding/json` ist nicht kanonisch (escapet `<`, `>`, `&`, U+2028; sortiert nach Bytes), deshalb `Canonical`.
- **Nur lesen:** feste Abfragen ohne Platzhalter (Platzhalter schalten auf das Binärprotokoll, das Datumswerte umdeutet),
  eingesetzt werden nur ScheibenIDs als ganze Zahlen. Jede Runde eine Transaktion `WITH CONSISTENT SNAPSHOT, READ ONLY`,
  danach `ROLLBACK`. Zellen als `sql.RawBytes` → Text oder `nil`. Sitzung `time_zone '+00:00'`, `charset` über
  `mysql.Charset` (als Parameter setzt der Treiber v1.10 ihn als Systemvariable und scheitert).
- **Alle Spalten** mit Typ aus `information_schema`; passt das Ergebnis nicht mehr, zählt die Runde nicht, die nächste
  liest die Spalten neu (SF-25, Test `TestReplayColumnAddedWhileRunning`).
- **Erkennung** (`watch`): gelesen wird, was wartet (vorige Lesung neu, noch nicht bestätigt), was sich bewegt hat
  (neu oder Lebenszeichen anders, auch wenn das Budget von 50 Scheiben je Runde es verschob) und was aktiv ist
  (Lebenszeichen in den letzten 20 min, fängt Korrekturen ohne Lebenszeichen, SF-21, SF-22, SF-74). Beim Start gilt
  als neu, was bis 12 h vor dem jüngsten Lebenszeichen liegt. Gesendet wird nach zwei gleichen Lesungen (SF-71), nur ein
  neuer Stand gegenüber dem zuletzt gemeldeten, nie ohne Treffer (SF-13). Eine gescheiterte Runde ändert nichts; Fehlen
  ist keine Löschung (SF-24). Jede Regel hat einen Fall, der ohne sie rot wird (Gegenproben im Bericht).
- **Nichts auf die Platte, keine Personenfelder in der Ausgabe** (SF-59): Meldungen nur mit Zahlen und Codes
  (`ssmdb2.Code`, nie `err.Error()` des Treibers), Snapshots als `Summary`; `--json` ist für die Prüfung vor Ort und
  gibt die vollen Daten aus. Der Replay-Test sucht die Namen der Fälle in der Ausgabe.
- Nach Änderungen: `pnpm check` (vom Repo-Root) und `pnpm --filter spiegel-bridge replay`.
