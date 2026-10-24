# Brücke: späte Änderungen ohne Lebenszeichen erkennen

## Context

Der User (24. Oktober 2026): „wenn man in meyton eine scheibe nachträglich einem anderen schützen zuweist, dass sie
dann trotzdem nicht in spiegel landet“. Auf Produktion gibt es keinen Stand in Quarantäne („SportpassID oder Besitzer
gewechselt“), keinen Grabstein und keine Löschsperre. Spiegel hat also nichts verworfen: Die Brücke hat den neuen Stand
nie geschickt.

Ursache in der Erkennung (`internal/watch`): Eine Scheibe wird nur ganz gelesen, wenn sich ihr Lebenszeichen
`Scheiben.Zeitstempel` bewegt (`dirty`) oder wenn sie sich in den letzten 20 Minuten bewegt hat (`ActiveFor`). Die
Scheibe wurde beim Schießen unter dem ersten Namen gelesen, ohne Zustimmung zurückgehalten und damit als erledigt
vermerkt (`Delivered`). Das Umbuchen ändert Name und SportpassID in `Scheiben`, offenbar nicht den Zeitstempel. Danach
liest die Brücke sie erst nach ihrem eigenen Neustart wieder. `TestCorrectionWithoutLifesignWhileActive` hält dieses
Verhalten fest („den Abgleich bringt das Nachholen beim Start“). Im Dauerbetrieb ([[spiegel-bridge-pi]]) gibt es diesen
Neustart nicht mehr regelmäßig. Dieselbe Lücke betrifft späte Korrekturen der Standaufsicht (SF-21, SF-22) und eine
nachträglich geänderte Disziplin.

Die Brücke liest die SportpassID schon in jeder Runde mit dem Lebenszeichen (`reader.go`, `readLifesigns`), vergleicht
sie aber nicht mit der zuletzt gesehenen.

Nicht Teil dieses Plans (Spiegel, eigener Plan, ins Roadmap-Backlog): Stand die Scheibe schon bei einem Konto mit
Zustimmung, stellt Spiegel den umgebuchten Stand in Quarantäne, ohne Oberfläche für den Admin; nach „Nicht meine“ sperrt
der Grabstein die ganze ScheibenID, auch für den richtigen Schützen. Beides ist beim User nicht passiert.

## Approach

- **D1 Ein Wechsel der SportpassID ist eine Änderung.** `dirty` vergleicht neben dem Lebenszeichen die SportpassID aus
  `Lifesign.Sportpass` mit der zuletzt gesehenen (`card.sportpass`, als Text, `nil` gleich `nil`). Ein Wechsel zählt wie
  ein bewegtes Lebenszeichen (`movedAt`): Die Scheibe ist 20 Minuten aktiv, der Takt läuft eine Minute schnell, die
  zweite gleiche Lesung (SF-71) kommt sofort. Das wirkt auch während geschossen wird und für alte Scheiben, denn die
  Abfrage der Lebenszeichen liest die ganze Tabelle `Scheiben`. Kosten: keine, die Spalte kommt schon mit.
- **D2 Abgleich im Leerlauf.** Wenn niemand schießt (`live` falsch, wie Nachholen und Nachladen, SF-52), liest die
  Erkennung jede Scheibe neu, die sie **in diesem Lauf schon gelesen hat**, deren Lebenszeichen höchstens 14 Tage vor
  dem jüngsten liegt und die seit mindestens einer Stunde nicht gelesen wurde. Rang 3, Budget von 50 je Runde wie
  bisher. Unverändertes geht nicht hinaus (Prüfsumme gleich der gesendeten), Geändertes nach zwei gleichen Lesungen.
  - Nur schon gelesene Scheiben: Nach einem Neustart gilt weiter der Wasserstand (SF-55). Was davor liegt, hat Spiegel,
    und `TestCatchUpOnlyWhenNobodyShoots` (Scheibe vor dem Wasserstand wird nicht gesendet) bleibt gültig.
  - Fenster ab dem jüngsten Lebenszeichen, mit derselben Regel wie das Startfenster: Ein vorgehender Stand verankert es
    nicht (SF-73). Dafür wird `startFrom` zu `windowFrom(lifesigns, sourceNow, d)` verallgemeinert.
  - 14 Tage decken die nächsten zwei Trainings; das sind rund 30 Scheiben (etwa 750 im Jahr), eine Runde. Eine Stunde
    Abstand: Im Dauerbetrieb läuft der Abgleich spätestens in der ersten Runde, nachdem die Anlage am nächsten Abend
    eingeschaltet ist, bevor jemand schießt.
  - `Busy` ändert sich nicht: Was über 50 hinausgeht, liest die nächste ruhige Runde (30 s).
- **D3 Kein Vertrag, kein Heartbeat-Feld.** Neu ist eine Zeile im Log, `card-reassigned scheibe=<ScheibenID>` (nur die
  Zahl, SF-59), damit sich vor Ort mit `journalctl` prüfen lässt, ob Meyton beim Umbuchen die SportpassID in der
  SSMDB2 ändert. `watch.Result.Reassigned` trägt die IDs.
- **D4 Verworfen:** die ganze Zeile `Scheiben` in jeder Runde lesen und vergleichen (wächst mit der Ablage und sieht
  Korrekturen in `Treffer` nur, wenn Meyton auch die Summen in `Scheiben` nachzieht); einen eigenen Auslöser „Anlage
  wieder erreichbar“ (mehr Zustand, D2 deckt das ab).
- **Braucht eine neue Brücke auf dem Pi** (Binary). Spiegel bleibt unverändert, kein Release des VPS nötig.

## Files

- `apps/spiegel-bridge/internal/watch/watch.go`: `Config` (`ReconcileWindow`, `ReconcileEvery`), `Defaults`,
  `Result.Reassigned`, `sameText`, `windowFrom` (statt `startFrom`), `dirty`, `reconcileDue`, `plan`, `Tick`,
  Paketkommentar
- `apps/spiegel-bridge/internal/watch/watch_test.go`: SportpassID in `memory.Round`, Helfer `withSportpass`, neue Tests,
  Kommentar in `TestCorrectionWithoutLifesignWhileActive`
- `apps/spiegel-bridge/internal/run/run.go`: Log `card-reassigned` in `Step`
- `apps/spiegel-bridge/internal/run/run_test.go`: Helfer `setSportpass`, neuer Test
- `apps/spiegel-bridge/CLAUDE.md`: Regel „Erkennung“
- `vault/spiegel/spiegel-bridge.md` („Arbeitsweise“, `keywords:`), `vault/spiegel/spiegel-edge-cases.md` (SF-80,
  SF-21), `vault/meyton/meyton-ssmdb2.md` („Stolperfallen“, „Schießprotokoll“), `vault/spiegel/spiegel-assignment.md`
  („Regeln“), `vault/spiegel/spiegel-roadmap.md` („Offene Einzelpunkte“)

## Required Docs

- `apps/spiegel-bridge/CLAUDE.md` (Erkennung, „Erst bestätigt ist gesendet“, Nachholen, Nachladen, Logs ohne Inhalte)
- `vault/spiegel/spiegel-bridge.md` („Arbeitsweise“, „Betrieb: Anlage aus nach dem Training“), `vault/decisions/adr-027.md`
- `vault/meyton/meyton-ssmdb2.md` („Stolperfallen“), `vault/spiegel/spiegel-edge-cases.md` (SF-21, SF-52, SF-55, SF-71,
  SF-73), `vault/SCHEMA.md` (Frontmatter der Notes)

## Tasks

1. **Wechsel der SportpassID, Test zuerst** (`watch`):
   - `watch_test.go`: `memory.Round` setzt `Lifesign.Sportpass` aus `m.data[id].Scheiben.Rows[0]["SportpassID"]`, wenn
     die Zeile die Spalte hat (wie `ablage.Round` in `run_test.go`). Helfer
     `withSportpass(d contract.Data, value string) contract.Data`: ergänzt `Scheiben.Columns["SportpassID"] =
     "bigint(20)"` und den Wert in der Zeile (neue Map, nicht die alte ändern).
   - Neuer Test `TestSportpassChangeWithoutLifesignIsRead`: Scheibe 7 mit `withSportpass(cardData(7, 20, "100"),
     "87654321")`, Lebenszeichen fest. Zwei Runden (gesendet und bestätigt), dann 30 Minuten vorstellen, eine Runde:
     nichts gelesen (`m.reads` zuletzt leer). Dann dieselben Schüsse mit `"12345678"`, Lebenszeichen gleich: die Runde
     liest 7, `Result.Reassigned` ist `[7]`, `Busy` ist wahr, noch kein Snapshot (erste Lesung). Eine Sekunde später:
     Snapshot von 7 mit der SportpassID `12345678` in `Scheiben`. Danach, eine Sekunde später: kein Snapshot.
   - Neuer Test `TestReassignedCardLeavesWhileShooting` (der Wechsel zählt als Bewegung): Scheibe 1 vom Vorabend kommt
     über das Nachholen (`SetCatchUpFrom`, wie in `TestCatchUpOnlyWhenNobodyShoots`), also ohne `movedAt`, und wird
     gesendet. Dann schießt Scheibe 9 (Lebenszeichen jede Runde neu), und Scheibe 1 bekommt eine andere SportpassID:
     innerhalb von drei Runden geht ein Snapshot von 1 hinaus. Ohne `movedAt` wartete der zweite Lesedurchgang auf den
     Leerlauf.
   - `watch.go`: `func sameText(a, b *string) bool` (beide `nil` oder gleicher Text). In `dirty`, Zweig `default`:
     `c.dirty || c.stamp != l.Stamp || !sameText(c.sportpass, l.Sportpass)`. In `Tick`, in der Schleife über
     `round.Lifesigns` vor dem Überschreiben von `c.sportpass`: `reassigned := known && !sameText(c.sportpass,
     l.Sportpass)`; `movedAt = now` auch bei `reassigned`; bei `reassigned` die ID an `result.Reassigned` anhängen.
     `Result.Reassigned []int32` mit Kommentar („Scheiben, deren SportpassID sich seit der letzten Runde geändert hat:
     in Meyton umgebucht, SF-80“). Kommentar an `Lifesign.Sportpass` und Paketkommentar um den Wechsel ergänzen.
   - `pnpm --filter spiegel-bridge test`.
2. **Log und Weg bis zum Upload** (`run`):
   - `run_test.go`: Helfer `func (a *ablage) setSportpass(id int32, sportpass string)` ersetzt die Zeile von
     `Scheiben` durch eine Kopie mit neuer `SportpassID`, Lebenszeichen unverändert.
   - Neuer Test `TestReassignedCardLeavesWithConsent`: `setup(t, "12345678")`, `put(1, "87654321", "1", 3)`,
     `runFor(30 * time.Minute)`: `sent()` ist `[]`. `setSportpass(1, "12345678")`, `runFor(time.Minute)`: `sent()` ist
     `[1]`, `f.logs` enthält genau eine Zeile mit `card-reassigned` und `scheibe=1` (Form der Zeile wie bei
     `card-skipped` in den bestehenden Tests prüfen), keine Zeile enthält `Muster` oder `12345678`.
   - `run.go`, `Step`, vor der Schleife über `result.Skipped`: je ID in `result.Reassigned`
     `r.log("card-reassigned", "scheibe", id)`.
3. **Abgleich im Leerlauf, Test zuerst** (`watch`):
   - Neue Tests in `watch_test.go`:
     - `TestReconcileReadsRestingCardsWhenIdle`: Scheibe 7 (`cardData(7, 20, "100")`) gesendet. 25 Minuten später
       Korrektur auf `"95"`, Lebenszeichen gleich: die Runde liest 7 nicht. Auf eine Stunde nach der letzten Lesung von 7
       vorstellen: die Runde liest 7, eine Sekunde später geht ein Snapshot mit `"95"` hinaus. Danach liest die nächste
       Runde 7 erst wieder nach einer weiteren Stunde.
     - `TestReconcileWaitsWhileShooting`: Scheibe 7 gesendet und seit über einer Stunde gelesen, Korrektur ohne
       Lebenszeichen; Scheibe 9 schießt (Lebenszeichen jede Runde neu, wie in `TestCatchUpOnlyWhenNobodyShoots`): in
       drei Runden liest die Erkennung nur 9. 25 Minuten nach dem letzten Schuss auf 9: Sie liest 7, eine Sekunde
       später geht die Korrektur hinaus.
     - `TestReconcileOnlyWithinTheWindow`: Scheibe 7 mit Lebenszeichen `2026-10-13 18:00:00` gelesen und gesendet. Dann
       Scheibe 9 mit Lebenszeichen 15 Tage später, die Uhr der Brücke ebenso; 9 gelesen und gesendet, Korrektur an 7
       ohne Lebenszeichen, 9 ruht 25 Minuten, dann über eine Stunde: Keine Runde liest 7.
     - `TestReconcileSkipsCardsNeverReadInThisRun`: Scheibe 3 mit Lebenszeichen 3 Tage vor dem jüngsten (außerhalb des
       Startfensters, ohne Wasserstand), Scheibe 9 im Startfenster. Zwei Stunden ohne Bewegung: Keine Runde liest 3.
   - `watch.go`:
     - `Config`: `ReconcileWindow time.Duration` („so weit vor dem jüngsten Lebenszeichen liest der Abgleich im Leerlauf
       schon gelesene Scheiben neu: späte Korrekturen und Umbuchen ohne neues Lebenszeichen, SF-21, SF-80“) und
       `ReconcileEvery time.Duration` („so lange nach der letzten Lesung ist eine Scheibe für den Abgleich wieder dran“);
       `Defaults`: `ReconcileWindow: 14 * 24 * time.Hour`, `ReconcileEvery: time.Hour`.
     - `startFrom` wird `windowFrom(lifesigns []Lifesign, sourceNow *string, d time.Duration) string`, Rumpf gleich bis
       auf `t.Add(-d)`; Kommentar entsprechend. `Tick` ruft `windowFrom(…, w.cfg.StartWindow)` für `from` wie bisher
       nur in der ersten Runde und in jeder Runde `reconcileFrom := w.windowFrom(…, w.cfg.ReconcileWindow)`, beides im
       Callback von `src.Round`.
     - `plan(now, lifesigns, from, reconcileFrom string)`; neuer Zweig im `switch` nach `w.backfill(l, from)`:
       `case w.reconcileDue(c, l, now, reconcileFrom): p.rank, p.idle = 3, true`.
     - `func (w *Watcher) reconcileDue(c *card, l Lifesign, now time.Time, from string) bool`: `c != nil &&
       !c.readAt.IsZero() && from != "" && l.Stamp >= from && now.Sub(c.readAt) >= w.cfg.ReconcileEvery`, mit Kommentar
       (nur in diesem Lauf gelesene: davor gilt der Wasserstand, SF-55).
     - Kommentar von `plan` um den Abgleich ergänzen; in `TestCorrectionWithoutLifesignWhileActive` den Kommentar „den
       Abgleich bringt das Nachholen beim Start“ ersetzen durch „den Abgleich im Leerlauf bringt sie nach
       `ReconcileEvery` (`TestReconcileReadsRestingCardsWhenIdle`)“.
   - `pnpm --filter spiegel-bridge test`. Schlägt ein bestehender Test fehl, weil eine schon gelesene Scheibe nach
     einer Stunde Leerlauf noch einmal gelesen wird, ist das gewollt; anpassen nur, wenn der Test genau das verbietet,
     und im Ledger nennen. Wird dadurch etwas **gesendet**, das unverändert ist, ist das ein Fehler.
4. **Mutationen** (aus einer Kopie wiederherstellen, nicht mit `git checkout`):
   - In `dirty` den Vergleich der SportpassID entfernen → `TestSportpassChangeWithoutLifesignIsRead` fällt (die Runde
     des Wechsels liest 7 nicht).
   - In `Tick` `reassigned` aus der Bedingung für `movedAt` nehmen → `TestReassignedCardLeavesWhileShooting` fällt.
   - `ReconcileEvery` in `Defaults` auf `1000 * time.Hour` → `TestReconcileReadsRestingCardsWhenIdle` fällt.
   - In `reconcileDue` `!c.readAt.IsZero()` entfernen → `TestReconcileSkipsCardsNeverReadInThisRun` oder
     `TestCatchUpOnlyWhenNobodyShoots` fällt.
   - In `reconcileDue` `l.Stamp >= from` entfernen → `TestReconcileOnlyWithinTheWindow` fällt.
   - Den Zweig `reconcileDue` im `switch` ohne `p.idle = true` → `TestReconcileWaitsWhileShooting` fällt.
5. **Doku:**
   - `apps/spiegel-bridge/CLAUDE.md`, Regel „Erkennung“: gelesen wird auch, was eine andere SportpassID trägt als in
     der letzten Runde (Umbuchen in Meyton, SF-80, Log `card-reassigned`); im Leerlauf liest der Abgleich jede in diesem
     Lauf gelesene Scheibe der letzten 14 Tage (ab dem jüngsten Lebenszeichen) nach einer Stunde neu (späte
     Korrekturen, SF-21); nach einem Neustart gilt der Wasserstand.
   - `vault/spiegel/spiegel-bridge.md`, „Arbeitsweise“, Punkt „Änderungen erkennen, zweistufig“: dieselben zwei Sätze;
     `keywords:` um `umbuchen abgleich sportpass-wechsel` ergänzen.
   - `vault/spiegel/spiegel-edge-cases.md`, Abschnitt „Korrekturen, Löschungen, Schema“, neue Zeile:
     `| SF-80 | Scheibe in Meyton nachträglich einem anderen Schützen zugewiesen (Oktober 2026: kam nicht an) | Ändert sich nur die Zeile in Scheiben und nicht das Lebenszeichen, liest die Brücke die ruhende Scheibe nie neu; sie bleibt als „ohne Zustimmung“ liegen | Die Brücke vergleicht die SportpassID aus der Abfrage der Lebenszeichen mit der zuletzt gesehenen und liest bei einem Wechsel neu (Log card-reassigned). Offen in Spiegel: Umbuchen zwischen zwei Konten (Quarantäne) und der Grabstein, der die ganze ScheibenID sperrt | Test, vor Ort |`;
     bei SF-21 in „Absicherung“ ergänzen: „nach dem Lebenszeichen liest der Abgleich im Leerlauf sie neu“.
   - `vault/meyton/meyton-ssmdb2.md`: Zeile „Korrekturen und Löschungen ändern Zeilen nachträglich“, Umgang ergänzen um
     „die Brücke liest im Leerlauf stündlich die Scheiben der letzten 14 Tage neu ([[spiegel-bridge]])“. Neue Zeile:
     „Eine Scheibe lässt sich nachträglich einem anderen Schützen zuweisen; ob dabei `Zeitstempel` mitläuft, ist offen
     (eine umgebuchte Scheibe kam im Oktober 2026 nicht an) | die Brücke vergleicht die SportpassID jeder Runde (SF-80)“.
     „Schießprotokoll“: Schritt 12 „**Umbuchen:** eine fertige Scheibe nach 25 Minuten einem anderen Schützen zuweisen.
     Ändern sich `Zeitstempel`, `SportpassID`, Name, ScheibenID?“
   - `vault/spiegel/spiegel-assignment.md`, „Regeln“: „Bucht die Aufsicht eine Scheibe in Meyton auf einen anderen
     Schützen um, liest die Brücke sie neu (SF-80). Mit Zustimmung der neuen Nummer kommt sie an. Stand sie schon bei
     einem anderen Konto, hält Spiegel den neuen Stand zurück. Nach „Nicht meine“ sperrt der Grabstein die ganze
     ScheibenID. Beides ist offen ([[spiegel-roadmap]]).“
   - `vault/spiegel/spiegel-roadmap.md`, „Offene Einzelpunkte“, Abschnitt „Daten und Datenschutz“: „**Umbuchen zwischen
     zwei Konten** (SF-80): Stand eine Scheibe schon bei einem Konto und bucht die Aufsicht sie auf eine andere Nummer
     mit Zustimmung um, stellt Spiegel den neuen Stand in Quarantäne („SportpassID oder Besitzer gewechselt“), ohne
     Oberfläche für den Admin. Nach „Nicht meine“ sperrt der Grabstein die ganze ScheibenID, auch für den richtigen
     Schützen, und „Scheibe per ID holen“ nimmt den Abend nicht an. Vorschlag: Grabstein je Nummer, Umhängen zwischen
     bestätigten Nummern. Berührt SF-28, SF-37 und [[spiegel-assignment]].“
6. **Gate:** `pnpm check` vom Root, `pnpm --filter spiegel-bridge replay`. `bridge-e2e` ist nicht nötig (Upload und
   Filter unverändert).

## Verification

- `pnpm check` grün (mit `go vet`, `gofmt`, `go test`, `go build`), `pnpm --filter spiegel-bridge replay` grün,
  `vault-lint` ohne Befund.
- Mutationen aus Task 4 jeweils rot, danach wieder grün.
- **Vor Ort** (nach der Installation der neuen Brücke auf dem Pi, `deploy/install.sh` und Neustart des Dienstes):
  1. Eine kurze Scheibe unter einem Namen ohne Zustimmung schießen (etwa ein Gastname), 25 Minuten ruhen lassen.
  2. In Meyton die Scheibe dem eigenen Namen (mit bestätigter Sportpassnummer in Spiegel) zuweisen.
  3. `journalctl -u spiegel-bridge --since "-10 min" | grep card-reassigned` zeigt die ScheibenID, und die Scheibe
     steht in Spiegel unter „Scheiben“.
  4. Fehlt die Zeile: Meyton ändert beim Umbuchen die SportpassID in der SSMDB2 nicht. Das in
     `vault/meyton/meyton-ssmdb2.md` eintragen; die Scheibe dann über „Scheibe per ID holen“ holen.
  5. Den Befund (Zeitstempel bewegt oder nicht) als Antwort auf Schritt 12 des Schießprotokolls eintragen.
- Die Scheibe, die der User gemeldet hat: Der Neustart bei der Installation liest ab dem Wasserstand minus einen Tag
  nach (SF-55) und schickt sie, wenn sie in diesem Zeitraum liegt. Sonst „Scheibe per ID holen“ mit der ID vom
  Ausdruck.
