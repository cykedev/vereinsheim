# Brücke: Zustand jede Minute, kleines Budget für den Leerlauf, während geschossen wird

Branch `feat/bridge-latency` (Worktree `mirror-height-differences-b5d033`). Brücke: Update nötig (Binary).

## Context

Schützen sollen so viel wie möglich von ihren Meyton-Daten bekommen, schnell und ohne Aufwand. Die Abdeckung ist
nicht das Problem (Kopie vom 9. Oktober 2026: 1.511 von 1.526 Scheiben mit Schüssen tragen eine SportpassID). Die
Engpässe sind Wartezeiten:

1. Die Brücke holt `GET /state` nur alle 5 Minuten (`StateEvery`). Eine neue Zustimmung, ein Auftrag per ID
   (`state.requests`), ein Auftrag zum Nachladen und ein aufgehobenes „nicht meine“ erreichen sie bis zu 5 Minuten
   später.
2. Nachholen beim Start, Nachladen der Historie und der Abgleich der letzten 14 Tage warten, bis 20 Minuten nichts
   mehr läuft (SF-52, `plan` in `internal/watch/watch.go` verwirft jede `idle`-Wahl, solange `live`). Die Anlage wird
   nach dem Training hart ausgeschaltet. Wer während eines Trainingsabends bestätigt wird, bekommt seine Historie erst
   am Ende des Abends (wenn die Anlage 20 Minuten ruhig an bleibt) oder beim nächsten Einschalten.

## Messungen (26. Oktober 2026)

**Kosten einer Runde der Brücke** gegen die Kopie der Anlage vom 9. Oktober 2026 (1.532 Scheiben, 45.008 Treffer,
4.635 Serien; MariaDB 10.6 in Docker, InnoDB), mit dem echten Leser (`ssmdb2.Reader.Round`: Transaktion, Spalten aus
`information_schema`, Lebenszeichen aller Scheiben, dann Serien und Treffer der gewählten über `IN`). Zehn laufende
Scheiben (die jüngsten) wie an einem Abend, dazu N alte, je Runde andere; 40 Runden je N; gelesene Zeilen aus
`Innodb_rows_read`:

| N alte dazu | Zeilen je Runde | Median | p90 |
| ----------- | --------------- | ------ | --- |
| 0 | 1.983 | 5,3 ms | 6,0 ms |
| 5 | 2.148 (+8 %) | 5,8 ms | 7,7 ms |
| 10 | 2.335 (+18 %) | 5,7 ms | 7,0 ms |
| 20 | 2.636 (+33 %) | 6,6 ms | 8,4 ms |

Die Lebenszeichen aller Scheiben (rund 1.500 Zeilen) kosten jede Runde ohnehin am meisten; die laufenden Scheiben
liest sie, solange geschossen wird, jede Sekunde. **Fünf** alte Scheiben je Runde kosten rund 8 % mehr Zeilen und
eine halbe Millisekunde auf dem Mac. Die Hardware des Meyton-Servers ist langsamer, das Verhältnis bleibt. Daraus
`IdleWhileLive = 5`. Eine Scheibe braucht zwei gleiche Lesungen (SF-71), der Durchsatz ist also rund 2,5 Scheiben je
Runde: 100 ältere Scheiben eines Schützen in rund 40 Runden, solange geschossen wird (Takt 1 s) also unter einer
Minute.

**Kosten von `GET /state`** (`bridgeState`, `apps/spiegel/src/lib/ingest/bridges.ts`) gegen die Dev-Datenbank (Kopie
von Produktion), in einer Transaktion mit Rollback (`expireRequests` schreibt sonst): Median 4,9 ms, p90 5,1 ms für die
Anlage (25 Läufe). Rund zehn kleine Abfragen über Indizes, zwei davon `updateMany` ohne Treffer; die Zahl der
Zustimmungen und Sperren ist an einem Verein klein. Jede Minute statt alle fünf: 1.440 statt 288 Anfragen am Tag,
rund 7 s Datenbankzeit am Tag; der Heartbeat läuft schon jede Minute und schreibt mehr. Spiegel nimmt 6 je Minute
(`createLimits` in `apps/spiegel/src/lib/ingest/http.ts`, je Brücke). Nach Fehlern fragt die Brücke höchstens nach
5, 10, 20, 40 s (4 in der ersten Minute) oder nach `Retry-After`, bleibt also darunter. Die Brücke fragt auch jede
Minute, wenn die Anlage wochenlang aus ist; dafür gibt es keinen Grund zu sparen (der Heartbeat tut dasselbe).

## Approach

### 1. `StateEvery` = 1 min (`internal/run/run.go`)

Nur die Konstante und ihr Kommentar. `MaxStateAge` (1 h), die Pausen nach Fehlern und der Rest bleiben. Spiegel bleibt
unverändert. Ein neuer Test pinnt den Takt von beiden Seiten: mindestens einmal je Minute (Wartezeit), höchstens so
oft, wie Spiegel nimmt.

### 2. Budget `IdleWhileLive` für die Arbeit des Leerlaufs (`internal/watch/watch.go`)

Neues Feld in `Config`, Vorgabe 5:

```go
	// solange geschossen wird, liest eine Runde nach allen anderen höchstens so viele Scheiben aus Nachholen, Nachladen
	// und Abgleich (SF-52); im Leerlauf gilt nur `MaxCards`
	IdleWhileLive int
```

```go
	// fünf mehr kosten eine Runde rund 8 % mehr gelesene Zeilen (Kopie vom 9. Oktober 2026, zehn laufende Scheiben)
	IdleWhileLive: 5,
```

In `plan` ersetzt eine Aufteilung das Verwerfen:

```go
	w.live = live
	if live {
		// was der Lauf ohnehin liest, zuerst; danach höchstens `IdleWhileLive` aus dem Leerlauf, auch die wartenden davon
		// (Rang 0 vor Rang 3: erst die zweite Lesung, dann neue)
		var first, idle []pick
		for _, p := range picks {
			switch {
			case !p.idle:
				first = append(first, p)
			case len(idle) < w.cfg.IdleWhileLive:
				idle = append(idle, p)
			}
		}
		picks = append(first, idle...)
	}
	if len(picks) > w.cfg.MaxCards {
		picks = picks[:w.cfg.MaxCards]
	}
```

Die Sortierung bleibt; innerhalb der Leerlauf-Gruppe kommen die wartenden (Rang 0) vor neuen (Rang 3), darunter die
jüngsten zuerst. So bleiben höchstens fünf Scheiben „in Arbeit“, und keine liest einmal und verhungert dann. Was
`MaxCards` sprengen würde, fällt wie heute hinten weg: die laufenden zuerst.

**Unverändert:** wer `live` ist; Rang und Reihenfolge; `Busy` (`(c.backfill || history) && !w.live`). Der Takt bleibt
trotzdem schnell: Eine neu gelesene Scheibe wartet auf die zweite Lesung und hält damit `Busy`, die nächste Runde
liest sie und die nächsten fünf. Der Abgleich liest unveränderte Scheiben, die nicht warten, und hält den Takt nicht
hoch. Scheitert der Upload länger, belegen höchstens fünf wartende das Budget (heute: keine, solange geschossen wird).

Kommentare, die „nur im Leerlauf“ oder „wenn niemand schießt“ sagen, ziehen mit (Paketkopf, `card.backfill`,
`SetHistory`, `Reopen`, `SetCatchUpFrom`, `plan`, `pick.idle`, die Fälle im `switch`; in `run.go` `setHistory`).

### 3. Texte in Spiegel (Entscheidung, siehe unten)

Vier Texte versprechen „wenn/sobald niemand schießt“. Nach diesem Branch stimmt das nicht mehr (es geht früher).
Vorschlag „sobald die Anlage an ist“, das stimmt in beiden Fällen.

## Entscheidungen für den User

1. **N = 5** (Messung oben). Kleiner hieße bei 100 Scheiben mehr Runden; größer kostet je fünf rund 8 % mehr Zeilen.
2. **Texte in Spiegel in diesem Branch mitziehen** (Task 7, Empfehlung) oder als eigene Aufgabe danach. Wortlaut zur
   Freigabe (Textbuch Spiegel):

   | Datei | heute | neu |
   | ----- | ----- | --- |
   | `apps/spiegel/src/lib/consent/queries.ts:74` (Profil) | „ältere Scheiben werden geholt, sobald im Schützenhaus niemand schießt“ | „ältere Scheiben werden geholt, sobald die Meyton-Anlage an ist“ |
   | `apps/spiegel/src/lib/admin/overview.ts:209` (Admin, Übersicht) | „… holt Spiegel noch ältere Scheiben. Das passiert, wenn im Schützenhaus niemand schießt.“ | „… holt Spiegel noch ältere Scheiben. Das passiert, sobald die Meyton-Anlage an ist.“ |
   | `apps/spiegel/src/lib/admin/consequences.ts:67` (Zustimmung bestätigen) | „… soweit die Meyton-Anlage sie noch hat. Das passiert, wenn dort niemand schießt.“ | „… soweit die Meyton-Anlage sie noch hat. Das passiert, sobald die Anlage an ist.“ |
   | `apps/spiegel/src/lib/admin/consequences.ts:555` (wieder zulassen) | „… noch einmal aus der Meyton-Anlage. Das passiert, sobald dort niemand schießt.“ | „… noch einmal aus der Meyton-Anlage. Das passiert, sobald die Anlage an ist.“ |

   Die Session auf `feat/spiegel-remove-card-requests` ändert `consequences.ts` (Hunk ab Zeile 529) und
   `spiegel-assignment.md` (ab Zeile 63); meine Stellen liegen daneben. Wer zweit merged, rebased.

**ADR-Prüfung:** Keine ADR legt SF-52 oder den Takt von `GET /state` fest (ADR-027 nennt nur 1 s/30 s für die
Runden). SF-52 ist ein Sonderfall in [[spiegel-edge-cases]] und wird dort geändert.

## Required Docs

- `apps/spiegel-bridge/CLAUDE.md` (Regeln „Erkennung“, „Nachholen beim Start“, „Nachladen der Historie“, „Zustand“)
- `vault/spiegel/spiegel-bridge.md` (Arbeitsweise, Stand des Codes)
- `vault/spiegel/spiegel-edge-cases.md` (Grundsatz 9, SF-52)
- `vault/conventions.md` §9 („Eigenschaftstests per Mutation gegenprüfen“, Mutation mit `cp`-Backup zurücksetzen)

## Tasks

Jeder Task test-first: Test schreiben, rot sehen, Code, grün, Mutation (Datei vorher mit `cp` sichern, danach aus der
Sicherung zurück), dann `pnpm --filter spiegel-bridge test`. Gate (`pnpm check`) als eigener Aufruf mit Log in einer
Datei vor jedem Commit, nie gepiped.

### Task 0: Worktree vorbereiten

`apps/ringwerk/.env`, `apps/treffsicher/.env` auf die des Haupt-Checkouts verlinken (`apps/spiegel/.env` ist schon ein
Link). Node 26 im Pfad (`unfunction pnpm node npm npx corepack; export PATH="$HOME/.nvm/versions/node/v26.12.1/bin:$PATH"`).

### Task 1: Zustand jede Minute

1. Test in `internal/run/run_test.go`:

   ```go
   // Neue Zustimmungen, Aufträge und aufgehobene Meldungen erreichen die Brücke binnen einer Minute; öfter, als Spiegel
   // nimmt (sechs je Minute), fragt sie nicht.
   func TestStateEveryMinute(t *testing.T) {
   	f := setup(t)
   	calls := 0
   	f.runner.spiegel = &countingSpiegel{spiegel: f.sp, calls: &calls}
   	f.ablage.put(1, "12345678", "1", 3)
   	begin := f.clock
   	// ein belegter Stand: Runden jede Sekunde
   	for i := 0; f.clock.Sub(begin) < 10*time.Minute; i++ {
   		f.ablage.stamps[1] = fmt.Sprintf("2026-10-13 21:%02d:%02d", i/60%60, i%60)
   		f.step()
   	}
   	if calls < 10 || calls > 11 {
   		t.Fatalf("%d Abfragen des Zustands in 10 min", calls)
   	}
   	// eine Zustimmung kommt dazu: Was ohne sie zurückblieb, geht binnen einer Minute hinaus
   	f.sp.state.Sportpass.Hashes = []string{filter.SportpassHash(salt, "12345678")}
   	f.runFor(time.Minute + 5*time.Second)
   	if got := fmt.Sprint(f.sp.sent()); !strings.Contains(got, "1") {
   		t.Fatalf("nach der Zustimmung %s", got)
   	}
   }
   ```

   Rot mit `StateEvery = 5 * time.Minute` (2 bis 3 Abfragen).
2. `StateEvery = time.Minute`; Kommentar von `refreshState`: „holt den Zustand beim Start und jede Minute (Spiegel nimmt
   sechs je Minute). Ohne Zustand lädt die Brücke nichts hoch (SF-38).“
3. Mutation: `StateEvery = time.Second` → der Test fällt (zu viele Abfragen). Zurück aus der Sicherung.
4. Alle Run-Tests mit `StateEvery` grün (`TestEpochUnconfirmedResentWhenConfirmed`, `TestNewConsentSendsWhatIsInMemory`,
   `TestStateFailureWaits`, `TestHistoryRequestMidRunTakesEffect`, `TestHistoryReopenedRequestReadsHandledCardsAgain`,
   `TestRequestAfterTheCardWasHeldWithoutConsent`); sie rechnen mit der Konstante, nicht mit fünf Minuten.
5. Commit `feat(spiegel-bridge): fetch the state every minute`.

### Task 2: Neue Tests für das Budget (Erkennung), rot

In `internal/watch/watch_test.go`:

```go
// history legt `n` alte Scheiben eines Schützen an (vor dem Startfenster, nie gelesen) und einen Auftrag zum
// Nachladen für ihn.
func history(w *Watcher, m *memory, first int32, n int) {
	for i := range int32(n) {
		id := first + i
		m.stamps[id] = fmt.Sprintf("2025-05-%02d 19:00:00", 1+i%28)
		m.data[id] = withSportpass(cardData(id, 40, "100"), "12345678")
	}
	w.SetHistory(func(sportpass string) bool { return sportpass == "12345678" })
}

// Solange geschossen wird, liest jede Runde erst die laufenden Scheiben, dann höchstens `IdleWhileLive` aus dem
// Leerlauf (SF-52): Die Historie kommt noch am Abend, in kleinen Portionen.
func TestHistoryWhileShootingAfterTheLiveStand(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	history(w, m, 100, 12)
	sent := map[int32]bool{}
	for range 10 {
		m.stamps[9] = c.t.Add(2 * time.Hour).Format(stampLayout)
		for _, id := range ids(tick(t, w, m)) {
			sent[id] = true
		}
		c.advance(time.Second)
	}
	for _, read := range m.reads {
		if len(read) == 0 || read[0] != 9 || len(read)-1 > Defaults.IdleWhileLive {
			t.Fatalf("je Runde erst 9, dann höchstens %d: %v", Defaults.IdleWhileLive, m.reads)
		}
	}
	for id := int32(100); id < 112; id++ {
		if !sent[id] {
			t.Fatalf("Scheibe %d nicht während des Schießens: %v", id, m.reads)
		}
	}
}

// Das Budget liegt innerhalb von `MaxCards`: Belegen die laufenden Scheiben alle Plätze, liest die Runde nichts aus dem
// Leerlauf, auch keine wartende.
func TestIdleBudgetInsideMaxCards(t *testing.T) {
	m, c := newMemory(), start()
	cfg := Defaults
	cfg.MaxCards = 3
	w := New(cfg, c.now)
	m.put(8, "2026-10-13 20:00:00", 3, "100")
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	history(w, m, 100, 4)
	for range 4 {
		m.stamps[8] = c.t.Add(2 * time.Hour).Format(stampLayout)
		m.stamps[9] = c.t.Add(2 * time.Hour).Format(stampLayout)
		tick(t, w, m)
		c.advance(time.Second)
	}
	// zwei laufende, ein Platz für den Leerlauf
	for _, read := range m.reads {
		if len(read) != 3 || read[2] < 100 {
			t.Fatalf("zwei laufende, dann einer aus dem Leerlauf: %v", m.reads)
		}
	}
	m.put(7, "2026-10-13 20:00:00", 3, "100")
	from := len(m.reads)
	for range 3 {
		for _, id := range []int32{7, 8, 9} {
			m.stamps[id] = c.t.Add(2 * time.Hour).Format(stampLayout)
		}
		tick(t, w, m)
		c.advance(time.Second)
	}
	for _, read := range m.reads[from:] {
		for _, id := range read {
			if id >= 100 {
				t.Fatalf("drei laufende, kein Platz: %v", m.reads[from:])
			}
		}
	}
}
```

Beide rot gegen den heutigen Code (die Historie kommt nicht, solange geschossen wird). Kein Commit (der Gate-Hook
blockt einen roten Stand); weiter mit Task 3.

### Task 3: Budget umsetzen und die Tests von SF-52 bewusst ändern

1. `Config.IdleWhileLive`, `Defaults.IdleWhileLive = 5`, `plan` wie unter Approach.
2. Bewusst geänderte Tests in `internal/watch/watch_test.go`:
   - `TestCatchUpOnlyWhenNobodyShoots` → `TestCatchUpWhileShootingAfterTheLiveStand`: erste Runde liest `[9 2 1]` (erst
     der laufende Stand, dann das Nachholen, die jüngste zuerst), Scheibe 3 (vor dem Wasserstand) nie; 1 und 2 gehen
     hinaus, während 9 schießt (drei Runden mit bewegtem Lebenszeichen); nach dem Schießen und dem Nachholen ruhig
     (`!r.Busy` nach 25 min, wie heute).
   - `TestReconcileWaitsWhileShooting` → `TestReconcileWhileShootingAfterTheLiveStand`: Die erste Runde, in der 9
     schießt, liest `[9 7]` (der Abgleich hinter dem laufenden Stand); die Korrektur an 7 geht in den drei Runden
     hinaus. Die zweite Lesung von 7 hat danach Rang 0 vor 9, wie heute jede wartende Scheibe, die sich im Lauf bewegt
     hat.
   - `TestReassignedOnlyForItsOwnStand`: Schluss neu. Der spätere wartende Stand von 1 wird gelesen, während 9 schießt,
     aber in jeder Lesung **hinter** 9 (Leerlauf-Budget, nicht Rang 0 vor allen). Die Mutation „`setWaiting` löscht
     `reassigned` nicht“ stellt 1 vor 9 und muss rot werden.
3. Bewusst geänderte Tests in `internal/run/run_test.go`:
   - `TestHistoryLoadsOlderCardsOnlyWhenIdle` → `TestHistoryLoadsOlderCardsWhileShooting`: nach 2 min gesendet 1, 2, 3,
     nicht 4; nach zwei Heartbeats erledigt `[7]`.
   - `TestHistoryWaitingCardsYieldWhileShooting` → `TestHistoryWaitingCardsStayInTheBudgetWhileShooting`: acht Scheiben
     zum Nachladen, Spiegel nimmt nichts an, Stand 1 schießt 20 Runden: Jede Runde liest Scheibe 1 einmal und höchstens
     fünf der acht (Differenz von `ablage.reads` je `step`).
   - `TestCatchUpAfterStart` → `TestCatchUpAfterStartWhileShooting`: Nach einer Minute sind 1 und 2 gesendet; Kommentar
     „erst der laufende Stand, das Nachholen danach in derselben Runde (SF-52)“.
   - `TestHistoryHeldBackCardsCountAsDone`: `runFor(23 * time.Minute)` → `runFor(2 * time.Minute)`, Kommentar „auch
     während der Stand aktiv ist“.
   - `TestHistoryDoneOnlyAfterSpiegelAnswered`: `runFor(23 * time.Minute)` → `runFor(3 * time.Minute)` (die Pausen nach
     den zehn Netzfehlern dauern zusammen über 7 min; in 3 min sind noch welche übrig, erledigt ist nichts).
   - `TestHistoryRequestMidRunTakesEffect`: `runFor(StateEvery + 20*time.Minute)` → `runFor(StateEvery + time.Minute)`,
     Kommentar „auch während der Stand aktiv ist“.
4. Kommentare in `watch.go` und `run.go` wie unter Approach.
5. Mutationen (je mit `cp`-Sicherung):
   - `case len(idle) < w.cfg.IdleWhileLive:` → `default:` (kein Deckel): `TestHistoryWhileShootingAfterTheLiveStand`
     rot.
   - `picks = append(first, idle...)` → die Leerlauf-Wahl an Ort und Stelle lassen (Filter wie bisher, nur ohne
     Verwerfen der ersten fünf): `TestHistoryWhileShootingAfterTheLiveStand` (9 nicht vorn) und
     `TestIdleBudgetInsideMaxCards` rot.
   - `IdleWhileLive: 0` in `Defaults`: die neuen Tests und die umbenannten rot.
6. `pnpm --filter spiegel-bridge test`, dann `pnpm check` (eigener Aufruf, Log in Datei), Commit
   `feat(spiegel-bridge): read a few idle-only cards per round while someone shoots`.

### Task 4: `apps/spiegel-bridge/CLAUDE.md`

- „Erkennung“: „Im Leerlauf liest der **Abgleich** …“ → „Der **Abgleich** liest … ; solange geschossen wird, mit dem
  Budget des Leerlaufs (unten).“ Neuer Satz: „Solange geschossen wird (`live`), liest eine Runde nach allen anderen
  höchstens `IdleWhileLive` (5) Scheiben aus Nachholen, Nachladen und Abgleich, die wartenden davon zuerst, innerhalb
  der 50 (SF-52; gemessen: rund 8 % mehr Zeilen je Runde).“
- „Nachholen beim Start“: „aber erst, wenn 20 Minuten nichts mehr läuft (SF-52), und hält den Takt bis dahin nicht
  hoch“ → „solange geschossen wird, mit dem Budget des Leerlaufs (SF-52); den Takt hält es nur im Leerlauf hoch“.
- „Nachladen der Historie“: „nur im Leerlauf, höchstens 50 je Runde“ → „im Leerlauf höchstens 50 je Runde, solange
  geschossen wird höchstens 5“; „Wartet eine Scheibe, die sich im Lauf nie bewegt hat …, bleibt sie liegen, solange
  geschossen wird“ → „… zählt sie zum Budget des Leerlaufs“.
- „Aufträge per ID“: „(nicht nur im Leerlauf, auch wartend nicht)“ → „(vor dem Budget des Leerlaufs, auch wartend)“.
- „Zustand“: „jede Minute (`StateEvery`; Spiegel nimmt sechs je Minute)“ vorn ergänzen.

### Task 5: Vault

- `vault/spiegel/spiegel-edge-cases.md`: Grundsatz 9 „Nachladen nur, wenn niemand schießt.“ → „Was nicht live ist,
  liest die Brücke, während geschossen wird, nur in kleinen Portionen.“ SF-52: Absicherung „Solange geschossen wird,
  je Runde höchstens 5 Scheiben aus Nachholen, Nachladen und Abgleich, nach den laufenden und innerhalb der 50;
  gemessen am 26. Oktober 2026: rund 8 % mehr gelesene Zeilen je Runde (Kopie vom 9. Oktober 2026)“.
- `vault/spiegel/spiegel-bridge.md`: „Abgleich im Leerlauf“ und „Takt“ (letzter Satz) auf das Budget; „Zustand beim
  Start … danach alle paar Minuten neu“ → „danach jede Minute neu“; „Aufträge … (alle fünf Minuten neuer Zustand)“ →
  „(jede Minute neuer Zustand)“; „Nachholen beim Start … gelesen wird das erst, wenn 20 Minuten nichts läuft (SF-52)“
  → „solange geschossen wird, in kleinen Portionen nach den laufenden Scheiben (SF-52)“. Die Messung (Tabelle oben,
  kurz) unter „Stand des Codes“.
- `vault/spiegel/spiegel-bridge-pi.md:172-173`: „dann warten die Aufträge, bis 20 min nichts mehr läuft (SF-52)“ →
  „dann laufen die Aufträge in kleinen Portionen nach den laufenden Scheiben (SF-52)“.
- `vault/spiegel/spiegel-assignment.md:32` und `:109`: „nur wenn niemand schießt“ → „während geschossen wird in kleinen
  Portionen“.
- `vault/spiegel/spiegel-roadmap.md` SP-2.5: Status „nur im Leerlauf (höchstens 50 je Runde)“ → „im Leerlauf höchstens
  50 je Runde, solange geschossen wird 5“; Umfang bleibt (historische Beschreibung). Am Ende unter „Offene
  Einzelpunkte“ nichts Neues.
- `/sync-graph` (`vault-lint`).
- Commit `docs: idle-only reads while shooting and the state every minute`.

### Task 6: Abnahme

- `pnpm --filter spiegel-bridge replay` (Docker, MariaDB 10.6).
- `pnpm --filter spiegel build` und `pnpm --filter spiegel bridge-e2e`.
- `/validate` (Bericht `reports/2026-10-26-bridge-latency.md`), `/review`.

### Task 7 (bei Freigabe des Wortlauts): Texte in Spiegel

Die vier Stellen aus der Tabelle oben und ihre Tests: `apps/spiegel/src/lib/consent/queries.test.ts:59`,
`apps/spiegel/src/lib/admin/overview.test.ts:170,173`, `apps/spiegel/src/lib/admin/consequences.test.ts:80,161`, die
Fixture in `apps/spiegel/src/components/profile/SportpassConsents.test.tsx:87,91`. Test zuerst (neuer Wortlaut, rot),
dann der Code. `OLD_WORDS` lässt „Meyton-Anlage“ und „Anlage“ zu. Commit `fix(spiegel): say when older cards arrive`.

## Verification

- Neue Tests: `TestStateEveryMinute`, `TestHistoryWhileShootingAfterTheLiveStand`, `TestIdleBudgetInsideMaxCards`;
  bewusst geändert: die neun aus Task 3; jede neue Regel mit einer Mutation, die sie rot macht.
- `pnpm check` grün (Log in Datei, Exit 0), `replay` grün, `bridge-e2e` grün.
- Doku: SF-52 in `spiegel-edge-cases.md`, `spiegel-bridge.md`, `apps/spiegel-bridge/CLAUDE.md`; `vault-lint` grün.
- Vor Ort (nicht in diesem Branch): Nach dem Update auf dem Pi zeigt der Heartbeat `queryMs`; an einem Abend mit
  offenem Auftrag zum Nachladen sollte er um weniger als eine Millisekunde steigen.
- Abschluss: ff-only-Merge nach `main` nur mit OK des Users. **Brücke: Update nötig (Binary).**
