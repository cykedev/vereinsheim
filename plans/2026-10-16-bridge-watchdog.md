# Plan: Brücke im Dauerbetrieb — Watchdog, Neustart nach Absturz, ruhigeres Log, Doku

> PIV-Handoff-Artefakt. Läuft im aktuellen Worktree auf `feat/bridge-watchdog` (ADR-024: Worktree vorab gewählt).

## Context (warum)

Der Raspberry Pi der Brücke soll künftig **dauerhaft laufen**, die Meyton-Anlage wird weiter nach jedem Training hart
ausgeschaltet (User, 16. Oktober 2026). Analyse in dieser Session:

- Ein **geplanter Neustart des Dienstes** bringt nichts: Speicher begrenzt (`ForgetAfter` 24 h, Bereinigung der Merker,
  `MemoryMax=128M`), Verbindung zur SSMDB2 alle 10 min neu (`SetConnMaxLifetime`), alle Ein- und Ausgaben mit
  Zeitgrenze (DB 5/30 s, HTTP 60 s), kein Zustand. Er kostet nur (zwei gleiche Lesungen neu, Nachholen von vorn).
- **Lücke 1, Hänger ohne Exit:** systemd merkt ihn nicht, Spiegel zeigt die Brücke als „aus“, bis jemand vor Ort ist.
  → systemd-Watchdog.
- **Lücke 2, gefunden beim Prüfen (belegt mit einem Testprogramm in Go 1.27):** Ein `panic` endet mit **Exit 2**, ein
  `SIGABRT` (das Signal des Watchdogs) ebenfalls mit **Exit 2**. Die Unit hat `RestartPreventExitStatus=2 3` (2 =
  Konfiguration fehlt). Heute startet systemd die Brücke nach einem Absturz also **nie neu**, und ein Watchdog liefe
  ins Leere. Mit `GOTRACEBACK=crash` endet beides mit dem Signal ABRT (Status 134), und `Restart=on-failure` greift.
- **Log im Dauerbetrieb:** Ist die Anlage aus, schreibt die Brücke alle 10 s `round-failed code=connection`, gut 8.600
  Zeilen am Tag, eine Woche gut 60.000. → wiederholte Fehler nur noch alle 10 min mit Zähler.
- **Betriebssystem:** auf dem Pi schon eingerichtet (User, 16. Oktober 2026): `unattended-upgrades` mit
  `Automatic-Reboot "true"` um 04:00 in `/etc/apt/apt.conf.d/52unattended-upgrades-local`. Erlaubt sind nur die
  Debian-Quellen; Kernel und Firmware kommen aus `archive.raspberrypi.com` und werden bewusst vor Ort eingespielt.
- **Login-Benutzer:** Er heißt auf dem Pi `spiegel-bridge` (uid 1000, sudo mit Passwort). `install.sh` hat deshalb
  keinen eigenen Dienstbenutzer angelegt. Vom User so akzeptiert (sudo nur mit Passwort, Unit mit `NoNewPrivileges`,
  `ProtectHome`, `ProtectSystem=strict`). Wird nur dokumentiert.
- **ADR-027** sagt unter *Folgen*: „Meyton-Anlage und Brücke werden nach jedem Training ausgeschaltet.“ Der
  Dauerbetrieb der Brücke weicht davon ab (nur der Betrieb, keine Entscheidung). → Abschnitt „Änderung (16. Oktober
  2026)“ in ADR-027, **außerhalb des Autopiloten** (geschützter Pfad, siehe Task 7).

Geprüft am Code, **kein** Handlungsbedarf, auch für **mehrere Wochen ohne Anlage** (Sommer, User):

- **Brücke läuft durch:** Eine wartende Scheibe (etwa weil am Ende des Abends das Internet weg war) bleibt im Speicher.
  Vergessen wird nur in einer gelungenen Runde, und dort erst nach dem Aktualisieren von `seenAt`
  (`internal/watch/watch.go`, `Tick`). Ohne Anlage gelingt keine Runde, also wird nichts vergessen, und der Speicher
  wächst nicht. Sobald die Anlage wieder an ist, geht die Scheibe hinaus. → Test in Task 3b.
- **Reboot während der Pause (04:00, nur bei `reboot-required`):** Der Speicher ist weg. Startfenster und Nachholen
  ab dem Wasserstand (SF-55) hängen an der **ersten gelungenen Runde** (`w.started` wird erst dort gesetzt,
  `SetCatchUpFrom` wirkt bis dahin), nicht am Start des Dienstes. Auch Wochen später gilt also: Was im Startfenster
  (12 h vor dem jüngsten Lebenszeichen der Ablage) und ab dem Wasserstand liegt, liest die Brücke einmal und schickt
  es. Spiegel antwortet „unverändert“, was schon oben ist. Das ist derselbe Weg wie heute nach dem Einschalten.
- **Leerlauf** für Nachholen und Nachladen misst die Erkennung an den Lebenszeichen der Ablage (`movedAt`,
  `ActiveFor`), nicht an der Laufzeit der Brücke. Aufträge zum Nachladen aus den Wochen (QR von zu Hause, neue
  Zustimmungen) laufen zu Beginn des nächsten Abends, bevor geschossen wird.
- **Zustände in Spiegel:** `advanceCardStates` schaltet mit jedem Heartbeat weiter, endgültig nach 12 h ohne
  Lebenszeichen oder ab dem Start eines neuen Laufs (`runStartedAt`). Mit durchlaufender Brücke werden die Scheiben
  eines Abends 12 h später endgültig statt beim nächsten Einschalten. Nach einem Reboot um 04:00 sofort. Beides ist
  harmlos: Die Anlage ist dann aus.
- **Kopplung:** Das Geräte-Token läuft nicht ab (nur Kopplungscodes, 15 min). Heartbeat jede Minute über Wochen ist
  für Spiegel kein Problem.
- **Uhr:** Nach jedem Reboot wartet die Brücke auf NTP (`systemd-time-wait-sync`), im Lauf misst sie ihre Uhr mit
  jedem Heartbeat.
- **Watchdog über Wochen ohne Anlage:** Jeder `Step` scheitert schnell (Verbindungsaufbau höchstens 5 s), meldet
  danach `Alive`. Kein falscher Neustart.

Nicht in diesem Plan: In Spiegel steht außerhalb der Abende dauerhaft „erreicht die Meyton-Anlage nicht“ (Zustand,
keine Aufgabe). Ob der Text für den Dauerbetrieb anders heißen soll, ist eine Frage für das Textbuch.

## Approach

1. **`internal/notify`** (neu, ohne Bibliothek): `Ready()` und `Alive()` schicken `READY=1` bzw. `WATCHDOG=1` als
   Datagramm an `$NOTIFY_SOCKET` (abstrakter Name `@…` → `\x00…`). Ohne Variable nichts (Windows, `watch`, Tests).
2. **`run.Runner`** bekommt ein Feld `Alive func()`. `Run` ruft es nach jedem `Step` und während des Wartens alle
   `AliveEvery` (1 min). Ein Hänger **in** `Step` bleibt so ohne Meldung, und genau der soll auffallen. Ein langes
   `Retry-After` (bis 10 min) ist kein Hänger und meldet weiter.
3. **`runRun`** (main): nach dem Laden der Konfiguration `notify.Ready()`, dann `runner.Alive = …` und `Run`. Scheitert
   eine Meldung, einmal `notify-failed code=…` ins Log.
4. **Unit:** `Type=notify`, `NotifyAccess=main`, `WatchdogSec=10min`, `Environment=GOTRACEBACK=crash`, `LimitCORE=0`
   (ein Core-Abbild enthielte Snapshots mit Namen, SF-59; auch `systemd-coredump` hält sich an das Limit).
   `WatchdogSec=10min`: ein `Step` im schlechtesten erlaubten Fall (Zustand 60 s, Runde, Stapel je 60 s, Heartbeat
   60 s) bleibt deutlich darunter; ein echter Hänger fällt nach höchstens 10 min auf statt nie.
5. **Log:** `round-failed` beim ersten Fehler und bei neuem Code sofort, danach höchstens alle 10 min
   (`RepeatLogEvery`) mit `rounds=<n>`. Gelingt die nächste Runde, einmal `round-ok after=<n>`.
6. **Doku:** Pi-Note (Dauerbetrieb, Betriebssystem, Log-Tabelle, Login-Benutzer), Note der Brücke (Abschnitt
   „Betrieb“), `apps/spiegel-bridge/CLAUDE.md` und `README.md` (Dienst), ADR-027 (Änderung).

Verworfen: Exit-Code für „Konfiguration fehlt“ von 2 auf 78 ändern. Sauberer, weil 2 der Code von Go für `panic` ist,
aber er ändert einen dokumentierten Code an vielen Stellen (`watch`, `pair`, Vault, README, Tests). `GOTRACEBACK=crash`
löst dasselbe in der Unit.

## Dateien

| Datei | Änderung |
|---|---|
| `apps/spiegel-bridge/internal/notify/notify.go` (neu) | `Ready`, `Alive`, `send` |
| `apps/spiegel-bridge/internal/notify/notify_test.go` (neu) | Datagramm kommt an, ohne Variable kein Fehler, abstrakter Name (nur Linux) |
| `apps/spiegel-bridge/internal/run/run.go` | `Alive`, `AliveEvery`, `RepeatLogEvery`, `Run` mit Meldung im Warten, gedrosseltes `round-failed`, `round-ok` |
| `apps/spiegel-bridge/internal/run/run_test.go` | Tests für `Run` mit `Alive` und für das Drosseln |
| `apps/spiegel-bridge/cmd/spiegel-bridge/main.go` | `notify.Ready()`, `runner.Alive`, `notify-failed` einmal |
| `apps/spiegel-bridge/deploy/spiegel-bridge.service` | `Type=notify`, `NotifyAccess=main`, `WatchdogSec=10min`, `Environment=GOTRACEBACK=crash`, `LimitCORE=0`, Kommentare |
| `apps/spiegel-bridge/CLAUDE.md`, `apps/spiegel-bridge/README.md` | Dienst: Watchdog, Neustart nach Absturz, Log |
| `vault/spiegel/spiegel-bridge-pi.md` | Dauerbetrieb, Betriebssystem, Log-Tabelle, Login-Benutzer |
| `vault/spiegel/spiegel-bridge.md` | Abschnitt „Betrieb: aus nach dem Training“ → Anlage aus, Brücke darf laufen |
| `vault/decisions/adr-027.md` | Abschnitt „Änderung (16. Oktober 2026)“ (Task 7, nicht im Autopiloten) |

## Required Docs

- `apps/spiegel-bridge/CLAUDE.md` (Regeln: nichts auf die Platte, Logs nur Codes und Zahlen, SF-59)
- `vault/spiegel/spiegel-bridge.md` (Betrieb, Technik), `vault/spiegel/spiegel-bridge-pi.md`
- `vault/decisions/adr-027.md`, `vault/SCHEMA.md` (Frontmatter beim Editieren)
- `vault/conventions.md` §8 (Gate), Hard Rule 8 der Root-`CLAUDE.md` (Kommentare ohne Geschichte)

## Tasks

### Task 1 — Paket `internal/notify`

`apps/spiegel-bridge/internal/notify/notify.go`:

```go
// Package notify meldet systemd Bereitschaft und Lebenszeichen (sd_notify), ohne Bibliothek. Ohne NOTIFY_SOCKET
// (kein Dienst mit Type=notify, Windows, Tests) tut es nichts.
package notify

import (
	"net"
	"os"
)

// Ready: die Brücke läuft (READY=1); vorher gilt der Dienst als startend.
func Ready() error { return send("READY=1") }

// Alive: die Schleife lebt (WATCHDOG=1); bleibt die Meldung länger als WatchdogSec aus, beendet systemd die Brücke.
func Alive() error { return send("WATCHDOG=1") }

func send(state string) error {
	name := os.Getenv("NOTIFY_SOCKET")
	if name == "" {
		return nil
	}
	// abstrakter Socket unter Linux: „@“ steht für das Nullbyte
	if name[0] == '@' {
		name = "\x00" + name[1:]
	}
	conn, err := net.DialUnix("unixgram", nil, &net.UnixAddr{Name: name, Net: "unixgram"})
	if err != nil {
		return err
	}
	defer conn.Close()
	_, err = conn.Write([]byte(state))
	return err
}
```

`notify_test.go`:
- `TestWithoutSocketNothing`: `t.Setenv("NOTIFY_SOCKET", "")`, `Ready()` und `Alive()` ohne Fehler.
- `TestSendsDatagram`: `net.ListenUnixgram` auf einem Pfad unter `t.TempDir()` (kurz halten, macOS erlaubt 104 Byte:
  bei Bedarf `os.MkdirTemp("", "n")`), `t.Setenv`, `Alive()`, Lesen mit `SetReadDeadline` 2 s ergibt `WATCHDOG=1`;
  ebenso `Ready()` → `READY=1`.
- `TestAbstractSocket`: nur `runtime.GOOS == "linux"` (sonst `t.Skip`), Listener auf `"\x00spiegel-bridge-test-<pid>"`,
  `NOTIFY_SOCKET=@spiegel-bridge-test-<pid>`, Datagramm kommt an.
- `TestUnreachableSocketFails`: `NOTIFY_SOCKET` auf einen nicht vorhandenen Pfad → Fehler (main loggt ihn).

Kontrolle: `cd apps/spiegel-bridge && go test ./internal/notify/`.

### Task 2 — `Run` meldet das Lebenszeichen

In `internal/run/run.go`:

```go
	// AliveEvery: so oft meldet Run beim Warten, dass die Schleife lebt (Watchdog); der Watchdog wartet länger
	AliveEvery = time.Minute
```

(in den `const`-Block neben `HeartbeatEvery`). Im `Runner`:

```go
	// Alive meldet, dass die Schleife lebt (systemd-Watchdog); nil ohne Dienst
	Alive func()
```

`Run`:

```go
// Run wiederholt `Step` bis zum Ende des Kontexts oder einem widerrufenen Token. Nach jedem Schritt und beim Warten
// alle `AliveEvery` meldet es `Alive`: Ein Schritt, der hängt, meldet nichts, und der Watchdog beendet die Brücke.
func (r *Runner) Run(ctx context.Context) error {
	for {
		wait, err := r.Step(ctx)
		if err != nil {
			return err
		}
		r.alive()
		next := time.After(wait)
		tick := time.NewTicker(AliveEvery)
		for waiting := true; waiting; {
			select {
			case <-ctx.Done():
				tick.Stop()
				return nil
			case <-next:
				waiting = false
			case <-tick.C:
				r.alive()
			}
		}
		tick.Stop()
	}
}

func (r *Runner) alive() {
	if r.Alive != nil {
		r.Alive()
	}
}
```

Test in `run_test.go` (`TestRunReportsAlive`): `setup(t)`, `f.runner.Alive` zählt in einem `atomic.Int32`, Kontext mit
`context.WithCancel`; `Run` in einer Goroutine, warten bis der Zähler ≥ 1 (Poll bis 2 s), `cancel()`, `Run` liefert
`nil`. Die erste Meldung kommt direkt nach dem ersten `Step`, die Wartezeit danach spielt keine Rolle. Kein Test
für den Ticker im Warten (eine Minute echte Zeit); der Takt ist eine Zeile und wird in Task 6 im echten systemd geprüft.

Kontrolle: `go test ./internal/run/`.

### Task 3 — `round-failed` gedrosselt, `round-ok`

In `internal/run/run.go`:

```go
	// RepeatLogEvery: ein Fehler, der sich wiederholt (Anlage aus), steht höchstens so oft im Log
	RepeatLogEvery = 10 * time.Minute
```

Felder im `Runner`: `failCode string`, `failRounds int`, `failLoggedAt time.Time`.

Im Fehlerzweig von `Step` statt `r.log("round-failed", "code", c)`:

```go
		// nie als Löschung werten: die Runde zählt nicht (SF-24). Ist die Anlage aus, wiederholt sich der Fehler alle
		// 10 s; ins Log kommt er beim ersten Mal, mit neuem Code und danach alle `RepeatLogEvery`.
		r.failRounds++
		if c != r.failCode || now.Sub(r.failLoggedAt) >= RepeatLogEvery {
			r.log("round-failed", "code", c, "rounds", r.failRounds)
			r.failCode, r.failLoggedAt = c, now
		}
```

Nach `r.dbStatus = ""` im Erfolgszweig:

```go
	if r.failRounds > 0 {
		r.log("round-ok", "after", r.failRounds)
		r.failCode, r.failRounds = "", 0
	}
```

Test `TestRepeatedRoundFailureLogsRarely` (die `ablage` im Test hat schon `fail error`):
- `f.ablage.fail = mysql.ErrInvalidConn` (`ssmdb2.Code` liefert dafür `connection`; ein fehlgeschlagener Schritt wartet
  `QuietEvery/3` = 10 s).
- 61 Schritte (`f.step()` rückt die Uhr um 10 s): genau zwei Zeilen `round-failed` (bei Runde 1 und nach 10 min),
  die zweite mit `rounds` 61.
- Fehler weg, ein Schritt: eine Zeile `round-ok` mit `after` 61; danach wieder ein Fehler → sofort `round-failed`
  mit `rounds` 1.
- Gegenprobe (Mutation, `cp`-Backup laut Memory): Bedingung durch `true` ersetzen → Test rot; zurückspielen.

Kontrolle: `go test ./internal/run/`.

### Task 3b — Test: Wochen ohne Anlage

`TestWaitingCardSurvivesWeeksWithoutSource` in `run_test.go`, nur Test, kein Produktivcode:
1. `setup(t, "12345678")`, eine Scheibe mit Zustimmung per `f.ablage.put(…)` (wie in
   `TestFailedUploadIsReadAndSentAgain`), Upload scheitern lassen wie dort (5xx), zwei Schritte → die Scheibe wartet,
   nichts ist bei `f.sp` angekommen.
2. `f.ablage.fail = mysql.ErrInvalidConn`, Upload wieder erlaubt, ein Schritt; dann `f.clock = f.clock.Add(21 * 24 *
   time.Hour)`, weitere drei Schritte (scheitern).
3. `f.ablage.fail = nil`, Schritte bis zur Zustimmung des Uploads (höchstens fünf) → `f.sp.sent()` enthält die
   ScheibenID; im Log `round-ok`.
4. Zweiter Fall im selben Test (Reboot in der Pause): nach Schritt 2 statt weiterzumachen einen **neuen** Runner auf
   derselben `ablage` und demselben `spiegel` bauen (`New(…)` wie in `setup`; `f.sp.state.Watermark` wie in
   `TestCatchUpFromWatermarkInLocalTime`), drei scheiternde Schritte, dann `fail = nil` → die Scheibe kommt über das
   Startfenster an.
5. Gegenprobe: Der Ausgang ist doppelt geschützt (Speicher, und eine unbekannte Scheibe gilt als neu), eine Mutation an
   einer Stelle bleibt grün. Geprüft wird deshalb, dass die Behauptung greift: Upload in Schritt 3 weiter scheitern
   lassen → Test rot; zurück.

Kontrolle: `go test ./internal/run/`.

### Task 4 — main: Ready und Alive

In `cmd/spiegel-bridge/main.go`, `runRun`, nach `log.log("start", …)` und `run.New(…)`:

```go
	// unter systemd (Type=notify): bereit, dann ein Lebenszeichen je Schritt und Minute für den Watchdog
	notifyFailed := false
	report := func(err error) {
		if err != nil && !notifyFailed {
			notifyFailed = true
			log.log("notify-failed", "code", "socket")
		}
	}
	report(notify.Ready())
	runner.Alive = func() { report(notify.Alive()) }
```

(Fehlertext nicht ins Log: er nennt nur den Pfad, aber die Regel sagt feste Codes.) Import
`…/internal/notify`. `go vet`, `go build` für alle drei Ziele (`pnpm --filter spiegel-bridge build`), damit Windows
mit `net.DialUnix` baut.

### Task 5 — Unit

`apps/spiegel-bridge/deploy/spiegel-bridge.service`, Abschnitt `[Service]`:

```ini
# bereit nach dem Laden der Konfiguration; danach meldet die Brücke jede Minute, dass ihre Schleife lebt. Bleibt das
# 10 min aus (ein Hänger), beendet systemd sie mit SIGABRT und startet sie neu.
Type=notify
NotifyAccess=main
WatchdogSec=10min
ExecStart=/usr/local/bin/spiegel-bridge run --config /etc/spiegel-bridge/config.json
# Anlage aus, Netz weg: neu starten. Exit 2 (Konfiguration fehlt) und 3 (Token widerrufen) brauchen einen Menschen.
Restart=on-failure
RestartSec=10
RestartPreventExitStatus=2 3
# Go beendet ein panic und SIGABRT sonst mit Exit 2, und der hieße „Konfiguration fehlt“: kein Neustart. Mit crash endet
# beides mit dem Signal, systemd startet neu. Kein Core-Abbild: Es enthielte Snapshots mit Namen (SF-59).
Environment=GOTRACEBACK=crash
LimitCORE=0
```

(`Type=simple` entfällt.) Prüfen: `RestrictAddressFamilies` enthält `AF_UNIX` (ja), `ProtectSystem=strict` sperrt das
Verbinden zum Socket nicht (Sockets sind von schreibgeschützten Mounts ausgenommen) — wird in Task 6 belegt.

### Task 6 — Prüfung in systemd (Docker, `debian:trixie`)

Skript im Scratchpad (nicht ins Repo), ein Container mit systemd als PID 1:

```bash
docker run -d --name bridge-systemd --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  --platform linux/arm64 debian:trixie bash -c 'apt-get update -qq && apt-get install -y -qq systemd >/dev/null && exec /lib/systemd/systemd'
```

Dann `install.sh` mit dem arm64-Binary hineinkopieren und ausführen, eine Konfiguration anlegen (`pair` braucht
Spiegel; stattdessen `config.json` von Hand mit erfundenem Token, URL `https://127.0.0.1:9` und DSN auf
`127.0.0.1:3306`: die Brücke läuft, Zustand und Runden scheitern, sie meldet trotzdem), `systemctl start
spiegel-bridge`:
1. `systemctl show -p Type,WatchdogUSec,NotifyAccess spiegel-bridge` → `notify`, `10min`, `main`; Status `active
   (running)`, nicht „activating“ (Ready kam an, `ProtectSystem=strict` erlaubt den Socket).
2. `systemd-analyze verify /etc/systemd/system/spiegel-bridge.service` ohne Meldung.
3. Watchdog greift: `systemctl set-property --runtime spiegel-bridge WatchdogSec=…` geht nicht für Services; stattdessen
   ein Drop-in `WatchdogSec=5s` und die Brücke per `kill -STOP <pid>` anhalten → nach 5 s
   `Watchdog timeout`, `status=6/ABRT`, Neustart nach 10 s (`journalctl -u spiegel-bridge`, `NRestarts` ≥ 1).
4. Ohne Drop-in, 3 min laufen lassen: kein Neustart (`NRestarts` bleibt), weil `Alive` beim Warten meldet. Für den
   Ticker im Warten zusätzlich ein Drop-in `WatchdogSec=90s` mit 3 min Laufzeit: kein Neustart.
5. `panic` → Neustart: nicht direkt auslösbar; belegt durch Punkt 3 (gleicher Pfad über `GOTRACEBACK=crash`) und das
   Testprogramm aus der Analyse.
6. Exit 2 ohne Konfiguration: `config.json` weg, Neustart → `status=2`, **kein** weiterer Neustart.

Ergebnis in den Validierungsbericht (`reports/`). Läuft systemd im Container auf dem Mac nicht, steht das dort als
„nicht belegt“, und die Punkte 1, 3, 4 werden auf dem echten Pi nachgeholt (Anleitung in der Pi-Note, Task 8).

### Task 7 — ADR-027 (manuell, außerhalb des Autopiloten)

`vault/decisions/adr-027.md`, neuer Abschnitt am Ende der Änderungen:

```markdown
## Änderung (16. Oktober 2026)

Die Brücke darf dauerhaft laufen, die Meyton-Anlage wird weiter nach jedem Training ausgeschaltet (User). Das ändert
den Betrieb unter *Folgen* („Meyton-Anlage und Brücke werden nach jedem Training ausgeschaltet“), nicht die
Entscheidung: Die Brücke bleibt ohne Zustand und hält auch ein hartes Ausschalten aus. Läuft sie weiter, merkt sie sich
im Arbeitsspeicher, was noch wartet, und schickt es, sobald die Anlage wieder an ist; Nachholen ab dem Wasserstand gibt
es nur nach einem Neustart der Brücke. Einen geplanten Neustart braucht sie nicht; einen Hänger fängt der Watchdog von
systemd ([[spiegel-bridge-pi]]).
```

Die Zeile unter *Folgen* bleibt (Historie der ADR), der neue Abschnitt verweist auf sie. Kein neues ADR: kein neuer
Beschluss. `decisions.md` und `index.md` listen keine Änderungen je ADR und bleiben.

### Task 8 — Vault und Doku der Brücke

**`vault/spiegel/spiegel-bridge-pi.md`:**
- TL;DR: ein Satz „Der Pi darf dauerhaft laufen; systemd startet die Brücke nach einem Absturz oder Hänger neu.“
- Schritt 2.3: „Im Schützenhaus wird hart ausgeschaltet“ → „Die Meyton-Anlage wird nach dem Training hart
  ausgeschaltet, oft auch der Pi“ (der Grund für das Upgrade zu Hause bleibt).
- Neuer Abschnitt **„Dauerbetrieb“** (vor „Updates“): kein geplanter Neustart (die Gründe aus *Context* in drei
  Punkten), Watchdog 10 min, Neustart nach Absturz (`GOTRACEBACK=crash`, kein Core-Abbild), außerhalb der Abende steht
  in Spiegel „erreicht die Meyton-Anlage nicht“ (normal), im Log alle 10 min `round-failed … rounds=`. Dazu, was über
  **Wochen ohne Anlage** gilt (aus *Context*): Wartendes bleibt im Speicher; ein Reboot in der Pause holt es über
  Startfenster und Wasserstand nach; Aufträge zum Nachladen laufen zu Beginn des nächsten Abends; Scheiben werden in
  Spiegel 12 h nach dem Abend endgültig (nach einem Reboot sofort).
- Abschnitt **„Betriebssystem“** neu: Datei `52unattended-upgrades-local` mit den drei Zeilen; Reboot nur, wenn ein
  Paket `/var/run/reboot-required` anlegt, zur nächsten 04:00; erlaubt sind nur die Debian-Quellen, Kernel und Firmware
  aus `archive.raspberrypi.com` bewusst vor Ort (`sudo apt full-upgrade && sudo reboot`, Entscheidung vom 16. Oktober
  2026, Grund: ein schiefes Kernel-Update braucht einen Besuch); Prüfbefehle `apt-config dump | grep -i
  Automatic-Reboot`, `sudo unattended-upgrade --dry-run --debug 2>&1 | grep -i 'allowed origins'`,
  `apt-cache policy $(dpkg -l 'linux-image-*' | awk '/^ii/{print $2}' | head -1)`; welcher Kernel läuft: `uname -r`
  (`rpi-v8` auf dem 3 B+; `rpi-2712` ist für den Pi 5 mitinstalliert).
- Log-Tabelle: `round-failed` jetzt „beim ersten Mal, mit neuem Code, danach alle 10 min mit `rounds`“; neu
  `round-ok after=…` (Anlage wieder erreichbar), `notify-failed` (systemd nimmt die Meldung nicht an; der Dienst
  startet dann nach 90 s neu), `Watchdog timeout` / `status=6/ABRT` (Zeilen von systemd: Hänger, Neustart folgt).
- Abschnitt „Updates → Brücke“: Nach dem Update auf diese Version einmal `systemctl show -p Type,WatchdogUSec
  spiegel-bridge` → `notify`, `10min` (die neue Unit kommt mit `install.sh`; `daemon-reload` macht das Skript).
  Zurück auf eine ältere Version: deren Unit mitinstallieren (`install.sh` aus dem alten Stand), sonst wartet systemd
  auf ein `READY`, das nie kommt.
- Abschnitt „Login-Benutzer“ (kurz, unter „1. Karte vorbereiten“ oder eigener Punkt): Heißt der Login-Benutzer
  `spiegel-bridge`, legt `install.sh` keinen eigenen Dienstbenutzer an, der Dienst läuft als dieser. So eingerichtet
  am Vereins-Pi, akzeptiert (sudo mit Passwort, `NoNewPrivileges`, `ProtectHome`, `ProtectSystem=strict`); für einen
  neuen Pi einen anderen Namen wählen.
- `keywords:` ergänzen: `dauerbetrieb, watchdog, sd_notify, type=notify, gotraceback, automatic-reboot, neustart,
  reboot, absturz, hänger`.

**`vault/spiegel/spiegel-bridge.md`**, Abschnitt „Betrieb: aus nach dem Training“: Überschrift → „Betrieb: Anlage aus
nach dem Training“; erster Satz um „Die Brücke darf dauerhaft laufen (User, 16. Oktober 2026), [[spiegel-bridge-pi]]“
ergänzen; Punkt „Online nur am Abend“: „Die Anlage ist nur am Abend erreichbar“; Punkt „Nachholen beim Start“: ein Satz,
dass eine laufende Brücke Wartendes im Speicher behält und Nachholen nur nach ihrem Neustart läuft. Im Abschnitt
„Technik“ nach „Dienst über systemd“: „mit Watchdog“. `keywords:` + `dauerbetrieb, watchdog`.

**`apps/spiegel-bridge/CLAUDE.md`**, Regel „Dienst“: `Type=notify` mit `WatchdogSec=10min` (`internal/notify`, `Run`
meldet nach jedem `Step` und beim Warten jede Minute), `GOTRACEBACK=crash` und `LimitCORE=0` mit Grund; Tabelle
„Aufbau“ um `internal/notify` ergänzen. Regel „Erkennung“ oder eigene Zeile: `round-failed` gedrosselt
(`RepeatLogEvery`), `round-ok`.

**`apps/spiegel-bridge/README.md`**, „Betrieb“: eine Zeile „Hängt die Brücke, startet systemd sie nach 10 min neu;
nach einem Absturz ebenso.“

Danach `/sync-graph` (vault-lint grün).

## Test steps

1. `cd apps/spiegel-bridge && go test ./...` (neu: `internal/notify`, `TestRunReportsAlive`,
   `TestRepeatedRoundFailureLogsRarely`, `TestWaitingCardSurvivesWeeksWithoutSource`).
2. Mutation zu Task 3 (Bedingung → `true`) muss rot werden; zurück aus dem `cp`-Backup.
3. `pnpm --filter spiegel-bridge build` (linux/arm64, linux/amd64, windows/amd64 bauen).
4. `pnpm --filter spiegel-bridge replay` (Erkennung unverändert, ~5 s).
5. `pnpm check` vom Worktree-Root (Memory: Stop-Gate prüft den Haupt-Checkout; selbst im Worktree laufen lassen).
6. Task 6 (systemd im Container).

## Verification

- Alle Gates grün, Replay grün, Build für drei Ziele.
- systemd im Container: `active (running)` mit `Type=notify`; angehaltene Brücke → `Watchdog timeout`, `6/ABRT`,
  Neustart; ohne Hänger 3 min kein Neustart; Exit 2 ohne Neustart. Was nicht belegt werden kann, steht im Bericht als
  „nicht belegt“ mit dem Schritt auf dem Pi.
- Vault-Lint grün; ADR-027 mit Änderungsabschnitt.
- Auf dem Pi (User, nach dem Merge und dem Update): `systemctl show -p Type,WatchdogUSec spiegel-bridge`, in Spiegel
  „läuft“ bzw. „erreicht die Meyton-Anlage nicht“, im Log keine `round-failed`-Zeile öfter als alle 10 min.
