# spiegel-bridge — Claude Scope-Notiz

Die Brücke im Schützenhaus ([ADR-027](../../vault/decisions/adr-027.md),
[`spiegel-bridge`](../../vault/spiegel/spiegel-bridge.md)): liest die Meyton-Ablage (SSMDB2) nur lesend und baut
Snapshots v1 für Spiegel. **Go**, ein statisches Binary ohne Laufzeit. Sie umfasst Leser, Änderungserkennung und
Snapshots; Kopplung, Upload, Heartbeat und die Filter (Zustimmung, verdeckt, gesperrt); das Nachholen beim Start ab dem
Wasserstand, das Nachladen der Historie, Aufträge per ID und den Dienst für systemd mit `deploy/install.sh`. Offen
([`spiegel-roadmap`](../../vault/spiegel/spiegel-roadmap.md)): Selbst-Update, Statusseite, Dienst unter Windows,
Aufträge mit Vorschau.

## Befehle

| Befehl                                    | Zweck                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm --filter spiegel-bridge test`       | Go-Tests: Vertrag gegen die Vektoren aus Python, Erkennung mit einer Ablage im Speicher       |
| `pnpm --filter spiegel-bridge replay`     | Abnahme: alle Fälle aus `ssmdb2-cases` in `mariadb:10.6` (Docker), nicht im Gate (~5 s)       |
| `pnpm --filter spiegel-bridge build`      | Binaries nach `dist/` für linux/arm64, linux/amd64, windows/amd64; Turbo cacht sie nie        |
| `go run ./cmd/spiegel-bridge watch`       | lokal lesen; je Snapshot eine Zeile ohne Personenfelder, `--json` volle Snapshots, `--once`   |
| `spiegel-bridge pair --url --code`        | koppeln (Code aus Admin → Anlage und Brücke, „Brücke verbinden“), schreibt die Konfiguration (0600, atomar)      |
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
| `internal/notify`    | sd_notify ohne Bibliothek: `Ready`, `Alive` an `$NOTIFY_SOCKET`, ohne Variable nichts                     |
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
  (Lebenszeichen in den letzten 20 min, fängt Korrekturen ohne Lebenszeichen, SF-21, SF-22, SF-74). Neu gelesen wird
  auch eine Scheibe mit anderer SportpassID als in der letzten Runde (in Meyton umgebucht oder die Nummer in der
  Schützenliste korrigiert, SF-80; ob sich beim Umbuchen das Lebenszeichen bewegt, ist offen). Aktiv wird sie dadurch
  nicht: Eine korrigierte Nummer ändert alle alten Scheiben des Schützen auf einmal, und jede würde sonst 20 min lang
  jede Runde gelesen. Die zweite Lesung zählt trotzdem nicht zum Budget des Leerlaufs (`card.reassigned`, endet mit dem
  wartenden Stand, `setWaiting`). Log `card-reassigned` mit ScheibenID und `lifesign` `moved` oder `same`, auch in
  `watch`. Der **Abgleich** liest jede in diesem Lauf gelesene
  Scheibe der letzten 14 Tage (ab dem jüngsten Lebenszeichen) eine Stunde nach ihrer letzten Lesung neu, Rang 3 wie
  das Nachholen: späte Korrekturen nach den 20 min. Nach einem Neustart gilt für Älteres der Wasserstand. **Arbeit des
  Leerlaufs** (Nachholen, Nachladen, Abgleich, und was davon auf Spiegel wartet): Solange geschossen wird (`live`),
  liest eine Runde nach allen anderen höchstens `IdleWhileLive` (5) davon, die wartenden zuerst, innerhalb der 50
  (SF-52; gemessen am 26. Oktober 2026 an der Kopie vom 9. Oktober: rund 8 % mehr gelesene Zeilen je Runde). Im
  Leerlauf gilt nur die Grenze von 50. Beim Start gilt
  als neu, was bis 12 h vor dem jüngsten Lebenszeichen liegt; Lebenszeichen mehr als einen Tag nach der Uhr der Anlage
  (`NOW(3)`) verankern das Fenster nicht (ein vorgehender Stand, SF-73). `Busy` zählt nur Scheiben, die in der Runde in
  der Ablage standen. `observedAt` ist die echte Beobachtung, nur die Folgenummer zählt nach einem Rücksprung der Uhr
  weiter. Gesendet wird nach zwei gleichen Lesungen (SF-71), nur ein
  neuer Stand gegenüber dem zuletzt gemeldeten, nie ohne Treffer (SF-13). Eine gescheiterte Runde ändert nichts; Fehlen
  ist keine Löschung (SF-24). Jede Regel hat einen Fall, der ohne sie rot wird.
- **Nichts auf die Platte, keine Personenfelder in der Ausgabe** (SF-59): Meldungen nur mit Zahlen und Codes
  (`ssmdb2.Code`, nie `err.Error()` des Treibers), Snapshots als `Summary`; eine gescheiterte Runde (`round-failed`)
  beim ersten Mal, mit neuem Code und danach alle `RepeatLogEvery` (10 min) mit `rounds`, die nächste gelungene einmal
  als `round-ok` (Anlage wochenlang aus: sonst 8.600 Zeilen am Tag); `--json` ist für die Prüfung vor Ort und
  gibt die vollen Daten aus. Der Replay-Test sucht die Namen der Fälle in der Ausgabe.
- **Erst bestätigt ist gesendet:** `Watcher.Delivered` nach einem endgültigen Ergebnis von Spiegel (alle außer
  `api.RetryOutcomes`: `future`, `epoch-unconfirmed`, `past`) oder wenn der Filter die Scheibe zurückhält. Bis dahin
  wartet sie und wird jede Runde neu gelesen; nach einem gescheiterten Upload geht hinaus, was dann in der Ablage steht
  (keine Warteschlange).
  Ein Stand, der sich vom bestätigten nur im Lebenszeichen unterscheidet, höchstens alle 30 s (`LifesignEvery`).
- **Filter wie Spiegel** (`internal/filter`): dieselben Regeln wie `ingest.ts` und `hasHeldShot` (Zustimmung über den
  Hash aus `GET /state`, `Wertung` 0, 5, 10 oder unlesbar hält die ganze Scheibe, Sperre derselben ID bis 30 Tage um den
  Beginn). Ändert sich eine Regel in Spiegel, hier mitziehen. Ohne Zustand lädt die Brücke nichts hoch (SF-38); eine neue
  Zustimmung oder bestätigte Epoche schickt, was noch im Speicher ist (`Resend`).
- **Antworten:** `future` und `past` pausieren 1 min, `past` macht die eigene Uhr ungeprüft. 429/503 `Retry-After`
  abwarten (höchstens 10 min; danach liest die Brücke neu, kein alter Stand, Spiegel nimmt bis 15 min Verzug), 413
  teilen (nach einer Pause nicht weiter), 401 beendet (`ErrUnauthorized`, Exit 3), 400 verwirft nur die in `issues`
  genannten Snapshots (`snapshots[i]`), Netz und 5xx mit Pause 5 s bis 60 s. Vor dem Stapel prüft `contract.Validate`
  jeden Snapshot. Keine Weiterleitungen (das Token bliebe im Kopf). Je Stapel eine Zeile `batch` mit den Ergebnissen als
  Zahlen.
- **Zustand:** jede Minute (`StateEvery`; Spiegel nimmt sechs je Minute, `GET /state` kostet dort rund 5 ms), nach
  einem Fehler erst nach Pause (5 s bis 60 s oder `Retry-After`) neu fragen; älter als eine Stunde, lädt die Brücke
  nichts hoch (Zustimmungen könnten widerrufen sein). Sperren gelten nur in ihrer Epoche (`blocked[].epoch`).
- **Uhr der Anlage** gemessen neben `NOW(3)` (Mitte der Runde); über zehn Jahre daneben (Uhr auf 2000) wird nicht
  gemeldet, sonst lehnte Spiegel jeden Heartbeat ab.
- **Eigene Uhr** (SF-79): Jeder Heartbeat
  misst sie an `serverTime` aus der Antwort (Mitte zwischen Senden und Antwort, `sentAt` ist der Zeitpunkt des Sendens).
  Unsicher um die halbe Umlaufzeit: Sie stimmt, wenn auch der ungünstigste Fall in `ClockTolerance` liegt (30 s, gleich
  `BRIDGE_CLOCK_TOLERANCE_MS` und dem Vektor `test-vectors/api-v1.json`), geht falsch, wenn auch der günstigste daneben
  liegt, sonst `clock-unmeasured` und der Zustand bleibt. Ungeprüft (beim Start, nach `past`, nach einem mit 400
  abgelehnten Heartbeat bei falscher Uhr: ein älterer Spiegel kennt `clock` nicht) oder falsch: `Watcher.SetHold` (liest
  weiter, gibt nichts heraus, Folgenummer unberührt), kein Upload, `sourceClockOffsetMs` null, Takt mindestens
  `QuietEvery` (sonst hielten die Wartenden ihn im Sekundentakt). Falsch gemessen ist Status `clock` (nach `db-*`, vor
  `delayed`), Log `clock-wrong seconds` (negativ: nach) und `clock-ok`. Wechselt der Zustand, verfällt die Uhrabweichung
  der Anlage (gegen die alte Uhr gemessen). Abstände im Betrieb misst Go monoton; die Tests haben keine monotone Uhr und
  setzen bei Rücksprüngen `lastHeartbeat` (Kommentar in `TestClockAheadHolds`). TLS: Uhr vor dem Beginn des Zertifikats
  `tls-time`, nach seinem Ende `tls-expired`. Offen: `runStartedAt` bleibt nach einer falschen Uhr beim Start zurück
  ([[spiegel-roadmap]], „Offene Einzelpunkte“).
- **Geheimnisse:** `--dsn` hat keine Vorgabe aus der Umgebung (die stünde sonst in der Hilfe); die Umgebung gilt erst
  nach dem Lesen der Optionen. `pair` unter Windows gesperrt, bis die Konfiguration dort eine ACL bekommt (0600 gilt
  nicht).
- **Nachholen beim Start** (SF-55): aus `state.watermark` (UTC) minus einem Tag in der Zone der Anlage
  (`catchUpFrom`, Zonen eingebaut über `time/tzdata`) wird ein Lebenszeichen; Scheiben davor im Startfenster liest die
  Erkennung einmal (`SetCatchUpFrom`, Rang 3), solange geschossen wird mit dem Budget des Leerlaufs (SF-52); den Takt
  hält es nur im Leerlauf hoch. Ohne Wasserstand (erste Brücke) nichts.
- **Nachladen der Historie:** Jede Runde liest die SportpassID mit dem Lebenszeichen (`Lifesign.Sportpass`, NULL als
  nil). `state.history` nennt offene Aufträge (Id, Hash); `run` gibt der Erkennung ein Prädikat (`SetHistory`, Hash je
  Nummer einmal gerechnet). Passende Scheiben der ganzen Ablage bekommen Rang 3 wie das Nachholen: im Leerlauf höchstens
  50 je Runde, solange geschossen wird höchstens 5. Erledigt ist ein Auftrag, wenn keine seiner Scheiben aus der letzten
  Runde mehr ungelesen ist oder auf Spiegel wartet (`HistoryOpen`, `handled`); zurückgehaltene zählen als erledigt. Der
  Heartbeat meldet sie mit `since` (`historyDone`), bis Spiegel sie nicht mehr nennt. Ein neues `since` derselben Id
  (Meldungen aufgehoben) öffnet die passenden Scheiben wieder (`Reopen`), auch was der Lauf schon gemeldet hat. Wartet
  eine Scheibe, die sich im Lauf nie bewegt hat (Nachholen, Nachladen), zählt sie zum Budget des Leerlaufs, solange
  geschossen wird. Ohne Speicher: Ein Neustart beginnt von vorn, Spiegel antwortet „unverändert“.
- **Aufträge per ID:** `state.requests` nennt ScheibenIDs, die ein Schütze mit der ID vom Ausdruck angefragt hat. `run`
  gibt der Erkennung ein Prädikat (`SetRequested`); eine angefragte Scheibe hat Rang 1 (vor dem Budget des Leerlaufs,
  auch wartend), und hält den Takt hoch, bis sie `handled` ist. Der Filter lässt sie ohne Zustimmung hinaus, wenn ihr
  Beginn auf den Abend des Auftrags fällt (`day`, `filter.Evening`: vor 4 Uhr der Vortag), sonst `WrongDay`; verdeckt
  und gesperrt nie. Ein neu genannter Auftrag liest die Scheibe noch einmal (`Resend`), auch wenn dieser Lauf sie schon
  ohne Zustimmung zurückhielt. Der Heartbeat meldet je Auftrag `missing` (nicht in der letzten Runde oder ohne Treffer,
  SF-13), `mismatch` (anderer Abend), `held` (vom Filter gehalten, übersprungen oder ungültig) oder `sent`
  (`RequestState`), bis Spiegel ihn nicht mehr nennt (höchstens 100, `sent` zuletzt). Spiegel prüft den Abend noch
  einmal. `missing` ist für Spiegel endgültig, solange noch keine Scheibe am Auftrag hängt: Ein Auftrag nennt eine
  Scheibe, die es schon gibt (Ausdruck). Spiegel nennt den Auftrag weiter, bis die Scheibe endgültig ist.
- **Dienst** (`deploy/`): `install.sh` legt Binary, Benutzer, `/etc/spiegel-bridge` (0700) und die Unit an; die Unit
  läuft ohne Rechte, mit schreibgeschütztem System, 128 MB, kein Neustart bei Exit 2 und 3. `pair` fragt den Zugang
  zur SSMDB2 auf stdin ab, wenn weder `--dsn` noch die Umgebung ihn nennen. Geprüft in `debian:12` mit
  `systemd-analyze verify`, am 15. Oktober 2026 auch in `debian:trixie` (arm64). Auf dem Raspberry Pi
  ([`spiegel-bridge-pi`](../../vault/spiegel/spiegel-bridge-pi.md)): Ohne `systemd-time-wait-sync.service` ist
  `time-sync.target` sofort erreicht, und die Brücke startet mit der Uhr vom letzten Abend (kein RTC); sie hält dann
  zurück, bis NTP antwortet (Regel „Eigene Uhr“, SF-79). Mit dem Dienst startet sie erst nach der Synchronisierung. Ein
  zweiter Lauf von `install.sh` ersetzt das Binary, startet den Dienst aber nicht neu. `Type=notify` mit
  `WatchdogSec=10min`: `run` meldet `READY` nach dem Laden der Konfiguration, `Run` danach `WATCHDOG` nach jedem `Step`
  und beim Warten alle `AliveEvery` (1 min); ein Schritt, der hängt, meldet nichts. Ein Schritt darf mit allen
  Zeitgrenzen rund fünf Minuten dauern (Zustand 60 s, Runde 5 s + 30 s, ein Stapel 60 s, Fingerabdruck 35 s, Heartbeat
  60 s); darum nie `WatchdogSec` unter fünf Minuten. `Environment=GOTRACEBACK=crash`: Go beendet `panic` und `SIGABRT` sonst mit Exit 2, und den schließt
  `RestartPreventExitStatus` als „Konfiguration fehlt“ vom Neustart aus; mit `crash` endet beides mit dem Signal.
  `LimitCORE=0`, ein Core-Abbild enthielte Snapshots mit Namen (SF-59). Eine ältere Brücke unter der neuen Unit sendet
  kein `READY` und gilt nach 90 s als nicht gestartet: beim Zurückgehen die alte Unit mitnehmen. Geprüft mit systemd in
  `debian:trixie` (arm64), [[spiegel-bridge-pi]] „Dauerbetrieb“.
- **Heartbeat** jede Minute, der erste nach der ersten Runde, nie mit Namen oder Nummern; `possible-reset` nur gemeldet
  (die Zahl der Scheiben fällt um mehr als die Hälfte; zurückgenommen, wenn sie wiederkommen; `delayed` geht vor), eine
  neue Epoche eröffnet die Brücke nicht. Zurückgehaltene zählen nur Scheiben, die die Erkennung noch kennt.
- Nach Änderungen: `pnpm check` (vom Repo-Root), `pnpm --filter spiegel-bridge replay` und bei Upload oder Filter
  `pnpm --filter spiegel bridge-e2e` (nach `pnpm --filter spiegel build`).
