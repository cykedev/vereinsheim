// Package run ist der Betrieb der Brücke: Zustand aus Spiegel, Runden der Erkennung, Filter, Upload ohne Warteschlange,
// Heartbeat. Ein Schritt ist eine Runde; `Run` wiederholt ihn im Takt.
package run

import (
	"context"
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	// Zonen eingebaut: ein Pi mit schlankem System oder Windows hat keine Zonendatenbank
	_ "time/tzdata"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/api"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/filter"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/ssmdb2"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/watch"
)

// Takt und Grenzen
const (
	BusyEvery      = time.Second
	QuietEvery     = 30 * time.Second
	StateEvery     = 5 * time.Minute
	HeartbeatEvery = time.Minute
	// so oft meldet Run beim Warten, dass die Schleife lebt (Watchdog); der Watchdog wartet länger
	AliveEvery = time.Minute
	// ein Fehler, der sich wiederholt (Anlage aus), steht höchstens so oft im Log
	RepeatLogEvery = 10 * time.Minute
	// nach einem Fehler: erst kurz, dann länger, höchstens so lange
	RetryFirst = 5 * time.Second
	RetryMax   = 60 * time.Second
	// eine Folgenummer zu weit in der Zukunft: die Uhr der Brücke geht vor; so lange nicht mehr schicken
	FuturePause = time.Minute
	// Nachholen beim Start: ab einem Tag vor dem Wasserstand, damit der letzte Abend samt späten Korrekturen dabei ist
	CatchUpMargin = 24 * time.Hour
	// so alt darf der Zustand (Zustimmungen, Sperren) höchstens sein, sonst lädt die Brücke nichts hoch
	MaxStateAge = time.Hour
	// was das Schema des Heartbeats an Uhrabweichung annimmt (zehn Jahre); eine Uhr auf 2000 gälte sonst nie
	maxClockOffset = 10 * 365 * 24 * time.Hour
	// die eigene Uhr gegen `serverTime` (SF-79, `BRIDGE_CLOCK_TOLERANCE_MS` im Vertrag): weiter daneben, hält die Brücke
	// Stände und die Uhrabweichung der Anlage zurück
	ClockTolerance = 30 * time.Second
	// Stapel: Spiegel nimmt 50 Snapshots und 4 MiB
	BatchSnapshots = contract.MaxBatchSnapshots
	BatchBytes     = 3*1024*1024 + 512*1024
)

// Zustände im Heartbeat (`BRIDGE_STATUS` im Vertrag)
const (
	StatusOK            = "ok"
	StatusDelayed       = "delayed"
	StatusDBUnreachable = "db-unreachable"
	StatusDBError       = "db-error"
	StatusPossibleReset = "possible-reset"
	StatusClock         = "clock"
)

// Statuses sind alle Zustände, die `status` liefern kann.
var Statuses = []string{StatusOK, StatusDelayed, StatusDBUnreachable, StatusDBError, StatusPossibleReset, StatusClock}

// clockState: die eigene Uhr gegen Spiegel (SF-79). Ungeprüft beim Start und nachdem Spiegel `past` antwortet.
type clockState int

const (
	clockUnchecked clockState = iota
	clockOK
	clockWrong
)

// issueIndex findet den Snapshot in einem Fehlerpfad von Spiegel (`snapshots[3].data…`).
var issueIndex = regexp.MustCompile(`^snapshots\[(\d+)\]`)

// errStateWaiting: Der Zustand wird nach einem Fehler erst später wieder gefragt.
var errStateWaiting = errors.New("state-waiting")

// ErrUnauthorized: Spiegel kennt das Token nicht mehr (widerrufen). Die Brücke hört auf; neu koppeln.
var ErrUnauthorized = errors.New("unauthorized")

// Source ist die Ablage: Runden der Erkennung und der Fingerabdruck für den Heartbeat.
type Source interface {
	watch.Source
	Fingerprint(ctx context.Context) (ssmdb2.Fingerprint, error)
}

// Spiegel ist die API v1 (`api.Client`).
type Spiegel interface {
	State(ctx context.Context) (api.State, error)
	Snapshots(ctx context.Context, snapshots []contract.Snapshot) ([]api.Result, error)
	// die Antwort ist die Uhr von Spiegel (`serverTime`)
	Heartbeat(ctx context.Context, hb api.Heartbeat) (time.Time, error)
}

// Logger schreibt eine Meldung mit festem Code und Zahlen, nie Inhalte (SF-59).
type Logger func(code string, pairs ...any)

// Runner hält, was ein Lauf im Arbeitsspeicher braucht; nichts davon kommt auf die Platte.
type Runner struct {
	// Alive meldet, dass die Schleife lebt (systemd-Watchdog); nil ohne Dienst
	Alive func()

	version string
	src     Source
	spiegel Spiegel
	log     Logger
	now     func() time.Time
	watcher *watch.Watcher

	started time.Time
	state   *api.State
	stateAt time.Time
	rules   *filter.Rules
	epoch   int

	// was der Filter zurückhält: Anzeigeart je Scheibe (Heartbeat), ohne Zustimmung (neu schicken, wenn sie kommt),
	// Epoche unbestätigt (neu schicken, wenn der Admin bestätigt)
	held        map[int32]int
	noConsent   map[int32]bool
	unconfirmed map[int32]bool

	pauseUntil    time.Time
	failures      int
	uploadFailing bool
	dbStatus      string
	lastDB        *time.Time
	queryMs       *int
	clockOffset   *int64
	clock         clockState
	backlog       int
	lastHeartbeat time.Time
	lastScheiben  int
	possibleReset bool
	resetFrom     int
	catchUpSet    bool
	// Zustand: nach einem Fehler erst wieder ab hier fragen (Spiegel nimmt sechs Anfragen je Minute)
	stateRetryAt  time.Time
	stateFailures int
	staleLogged   bool
	// gescheiterte Runden in Folge: Code und Zeit der letzten Zeile im Log
	failCode     string
	failRounds   int
	failLoggedAt time.Time

	// offene Aufträge zum Nachladen aus dem Zustand, die davon erledigten (Heartbeat) und die Hashes der
	// SportpassIDs, einmal gerechnet je Zustand
	history     []api.HistoryRequest
	historyDone []api.HistoryDone
	hashOf      map[string]string

	// offene Aufträge per ID aus dem Zustand, ihr Ausgang (Heartbeat) und welche der Filter zurückhielt (verdeckt,
	// gesperrt)
	requests      []api.CardRequest
	requestsDone  []api.RequestDone
	requestedHeld map[int32]bool
}

// MaxRequestsDone: so viele Ausgänge von Aufträgen per ID nimmt der Heartbeat
const MaxRequestsDone = 100

// MaxHistoryDone: so viele erledigte Aufträge nimmt der Heartbeat
const MaxHistoryDone = 100

// catchUpFrom rechnet den Wasserstand in Spiegel (Beobachtung, UTC) in ein Lebenszeichen der Anlage um: Meyton schreibt
// Ortszeit. Ohne Wasserstand (die erste Brücke einer Anlage) wird nichts nachgeholt; ältere Scheiben holt nur ein Auftrag zum Nachladen.
func catchUpFrom(state api.State) string {
	if state.Watermark == nil {
		return ""
	}
	loc, err := time.LoadLocation(state.Site.TimeZone)
	if err != nil {
		loc = time.UTC
	}
	return state.Watermark.Add(-CatchUpMargin).In(loc).Format("2006-01-02 15:04:05")
}

// New legt einen Lauf an; `now` nil heißt Systemuhr.
func New(version string, src Source, spiegel Spiegel, log Logger, cfg watch.Config, now func() time.Time) *Runner {
	if now == nil {
		now = time.Now
	}
	return &Runner{
		version:       version,
		src:           src,
		spiegel:       spiegel,
		log:           log,
		now:           now,
		watcher:       watch.New(cfg, now),
		started:       now(),
		epoch:         cfg.Epoch,
		held:          map[int32]int{},
		noConsent:     map[int32]bool{},
		unconfirmed:   map[int32]bool{},
		requestedHeld: map[int32]bool{},
	}
}

func unauthorized(err error) bool {
	var apiErr *api.Error
	return errors.As(err, &apiErr) && apiErr.Status == 401
}

func code(err error) string {
	var apiErr *api.Error
	if errors.As(err, &apiErr) {
		return apiErr.Error()
	}
	return ssmdb2.Code(err)
}

// backoff: 5 s, 10 s, 20 s, … bis 60 s
func (r *Runner) backoff() time.Duration {
	wait := RetryFirst
	for i := 1; i < r.failures && wait < RetryMax; i++ {
		wait *= 2
	}
	return min(wait, RetryMax)
}

// refreshState holt den Zustand beim Start und alle fünf Minuten. Ohne Zustand lädt die Brücke nichts hoch (SF-38).
func (r *Runner) refreshState(ctx context.Context, now time.Time) error {
	if r.state != nil && now.Sub(r.stateAt) < StateEvery {
		return nil
	}
	if now.Before(r.stateRetryAt) {
		return errStateWaiting
	}
	state, err := r.spiegel.State(ctx)
	if err != nil {
		if unauthorized(err) {
			return ErrUnauthorized
		}
		r.stateFailures++
		wait := RetryFirst
		for i := 1; i < r.stateFailures && wait < RetryMax; i++ {
			wait *= 2
		}
		var apiErr *api.Error
		if errors.As(err, &apiErr) {
			wait = max(wait, apiErr.RetryAfter)
		}
		r.stateRetryAt = now.Add(min(wait, api.MaxRetryAfter))
		r.log("state-failed", "code", code(err), "failures", r.stateFailures)
		return err
	}
	r.stateFailures, r.stateRetryAt, r.staleLogged = 0, time.Time{}, false
	previous := r.state
	r.state, r.stateAt, r.rules = &state, now, filter.NewRules(state)
	r.setHistory(state)
	r.setRequests(state)
	epoch := 1
	if state.Epoch != nil {
		epoch = *state.Epoch
	}
	if epoch != r.epoch {
		r.log("epoch", "epoch", epoch)
		r.epoch = epoch
		r.watcher.SetEpoch(epoch)
		r.watcher.Resend(keys(r.unconfirmed))
		r.unconfirmed = map[int32]bool{}
	}
	// eine neue Zustimmung: was ohne sie zurückblieb und noch im Speicher ist, geht jetzt hinaus
	if previous != nil && strings.Join(previous.Sportpass.Hashes, ",") != strings.Join(state.Sportpass.Hashes, ",") {
		r.watcher.Resend(keys(r.noConsent))
		r.noConsent = map[int32]bool{}
	}
	return nil
}

// setHistory übernimmt die offenen Aufträge zum Nachladen: Die Erkennung liest ihre Scheiben, wenn niemand schießt.
func (r *Runner) setHistory(state api.State) {
	if len(state.History) != len(r.history) {
		r.log("history-requests", "open", len(state.History))
	}
	known := map[api.HistoryRequest]bool{}
	for _, h := range r.history {
		known[h] = true
	}
	r.history, r.hashOf = state.History, map[string]string{}
	salt := state.Sportpass.Salt
	// neu eröffnet (Id und `Since` neu): auch Scheiben, die dieser Lauf schon gemeldet oder zurückgehalten hat, noch
	// einmal lesen; sonst gälte ein Auftrag nach dem Aufheben von „nicht meine“ sofort als erledigt
	reopened := map[string]bool{}
	for _, h := range state.History {
		if !known[h] {
			reopened[h.SportpassHash] = true
		}
	}
	if len(reopened) > 0 {
		r.watcher.Reopen(func(sportpass string) bool { return reopened[r.hash(salt, sportpass)] })
	}
	// erledigt bleibt nur, was der Zustand noch genau so nennt
	current := map[api.HistoryDone]bool{}
	for _, h := range state.History {
		current[api.HistoryDone{ID: h.ID, Since: h.Since}] = true
	}
	kept := r.historyDone[:0]
	for _, d := range r.historyDone {
		if current[d] {
			kept = append(kept, d)
		}
	}
	r.historyDone = kept
	if len(state.History) == 0 {
		r.watcher.SetHistory(nil)
		return
	}
	wanted := map[string]bool{}
	for _, h := range state.History {
		wanted[h.SportpassHash] = true
	}
	r.watcher.SetHistory(func(sportpass string) bool { return wanted[r.hash(salt, sportpass)] })
}

// setRequests übernimmt die offenen Aufträge per ID: Die Erkennung liest ihre Scheiben gleich. Ein neuer Auftrag liest
// auch eine Scheibe noch einmal, die dieser Lauf schon gelesen und ohne Zustimmung zurückgehalten hat.
func (r *Runner) setRequests(state api.State) {
	if len(state.Requests) != len(r.requests) {
		r.log("card-requests", "open", len(state.Requests))
	}
	known := map[api.CardRequest]bool{}
	for _, q := range r.requests {
		known[q] = true
	}
	wanted := map[int32]bool{}
	current := map[int]bool{}
	var fresh []int32
	for _, q := range state.Requests {
		wanted[q.ScheibenID] = true
		current[q.ID] = true
		if !known[q] {
			fresh = append(fresh, q.ScheibenID)
		}
	}
	r.requests = state.Requests
	if len(fresh) > 0 {
		r.watcher.Resend(fresh)
	}
	// gemeldet bleibt nur, was der Zustand noch nennt
	kept := r.requestsDone[:0]
	for _, d := range r.requestsDone {
		if current[d.ID] {
			kept = append(kept, d)
		}
	}
	r.requestsDone = kept
	if len(wanted) == 0 {
		r.watcher.SetRequested(nil)
		return
	}
	r.watcher.SetRequested(func(id int32) bool { return wanted[id] })
}

// updateRequestsDone: Ein Auftrag per ID ist ausgegangen, wenn seine Scheibe nicht in der Ablage steht (`missing`), der
// Filter sie hält (`held`) oder Spiegel ihren Stand endgültig beantwortet hat (`sent`). Gemeldet wird er in jedem
// Heartbeat, bis Spiegel ihn nicht mehr nennt.
func (r *Runner) updateRequestsDone() {
	var done []api.RequestDone
	for _, q := range r.requests {
		if len(done) >= MaxRequestsDone {
			break
		}
		seen, open := r.watcher.RequestState(q.ScheibenID)
		switch {
		case !seen:
			done = append(done, api.RequestDone{ID: q.ID, Outcome: api.RequestMissing})
		case open:
		case r.requestedHeld[q.ScheibenID]:
			done = append(done, api.RequestDone{ID: q.ID, Outcome: api.RequestHeld})
		default:
			done = append(done, api.RequestDone{ID: q.ID, Outcome: api.RequestSent})
		}
	}
	if len(done) != len(r.requestsDone) {
		r.log("card-requests-done", "done", len(done), "open", len(r.requests)-len(done))
	}
	r.requestsDone = done
}

func (r *Runner) hash(salt, sportpass string) string {
	h, ok := r.hashOf[sportpass]
	if !ok {
		h = filter.SportpassHash(salt, sportpass)
		r.hashOf[sportpass] = h
	}
	return h
}

// updateHistoryDone: Ein Auftrag ist erledigt, wenn keine seiner Scheiben in der Ablage mehr ungelesen ist oder auf
// Spiegel wartet. Gemeldet wird er in jedem Heartbeat, bis Spiegel ihn nicht mehr nennt.
func (r *Runner) updateHistoryDone() {
	if len(r.history) == 0 || r.state == nil {
		return
	}
	open := map[string]bool{}
	for _, sportpass := range r.watcher.HistoryOpen() {
		open[r.hash(r.state.Sportpass.Salt, sportpass)] = true
	}
	var done []api.HistoryDone
	for _, h := range r.history {
		if !open[h.SportpassHash] && len(done) < MaxHistoryDone {
			done = append(done, api.HistoryDone{ID: h.ID, Since: h.Since})
		}
	}
	if len(done) != len(r.historyDone) {
		r.log("history-done", "done", len(done), "open", len(r.history)-len(done))
	}
	r.historyDone = done
}

func keys(m map[int32]bool) []int32 {
	out := make([]int32, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// Step ist eine Runde; die Antwort sagt, wann die nächste dran ist. ErrUnauthorized beendet den Lauf.
func (r *Runner) Step(ctx context.Context) (time.Duration, error) {
	now := r.now()
	if err := r.refreshState(ctx, now); err != nil {
		if errors.Is(err, ErrUnauthorized) {
			return 0, err
		}
		if r.state == nil {
			return max(r.stateRetryAt.Sub(now), time.Second), nil
		}
	}

	if !r.catchUpSet {
		r.catchUpSet = true
		if from := catchUpFrom(*r.state); from != "" {
			r.watcher.SetCatchUpFrom(from)
			r.log("catch-up", "from", strings.ReplaceAll(from, " ", "T"))
		}
	}
	// ohne geprüfte Uhr gibt die Erkennung nichts heraus; sie liest weiter, Wartendes geht nach der Freigabe (SF-79)
	r.watcher.SetHold(r.clock != clockOK)
	// gemessen neben `NOW(3)`: nicht am Beginn des Schritts, vor einem womöglich langsamen Zustand
	roundAt := r.now()
	began := time.Now()
	result, err := r.watcher.Tick(ctx, r.src)
	took := time.Since(began)
	if err != nil {
		c := ssmdb2.Code(err)
		r.dbStatus = StatusDBError
		if c == "connection" || c == "timeout" {
			r.dbStatus = StatusDBUnreachable
		}
		// nie als Löschung werten: die Runde zählt nicht (SF-24). Ist die Anlage aus, wiederholt sich der Fehler alle
		// 10 s; ins Log kommt er beim ersten Mal, mit neuem Code und danach alle `RepeatLogEvery`.
		r.failRounds++
		if c != r.failCode || now.Sub(r.failLoggedAt) >= RepeatLogEvery {
			r.log("round-failed", "code", c, "rounds", r.failRounds)
			r.failCode, r.failLoggedAt = c, now
		}
		if err := r.heartbeat(ctx, now, false); err != nil {
			return 0, err
		}
		return QuietEvery / 3, nil
	}
	r.dbStatus = ""
	r.lastDB = &now
	if r.failRounds > 0 {
		r.log("round-ok", "after", r.failRounds)
		r.failCode, r.failRounds = "", 0
	}
	ms := int(took.Milliseconds())
	r.queryMs = &ms
	if result.SourceNow != nil {
		if source, err := time.Parse("2006-01-02 15:04:05.000", *result.SourceNow); err == nil {
			d := source.Sub(roundAt.Add(took / 2))
			if d > maxClockOffset || d < -maxClockOffset {
				// eine Uhr der Anlage auf 2000 o. ä.: nicht melden, sonst lehnte Spiegel jeden Heartbeat ab
				r.clockOffset = nil
				r.log("clock-offset-out-of-range")
			} else {
				offset := d.Milliseconds()
				r.clockOffset = &offset
			}
		}
	}
	for _, skip := range result.Skipped {
		r.log("card-skipped", "scheibe", skip.ID, "code", skip.Code)
	}

	var outgoing []contract.Snapshot
	for _, s := range result.Snapshots {
		decision := r.rules.Decide(s)
		delete(r.held, s.ScheibenID)
		delete(r.noConsent, s.ScheibenID)
		delete(r.requestedHeld, s.ScheibenID)
		if decision.Send {
			// was gegen den Vertrag verstößt, nimmt Spiegel ohnehin nicht; nicht den ganzen Stapel daran scheitern lassen
			if err := contract.Validate(s); err != nil {
				r.log("snapshot-invalid", "scheibe", s.ScheibenID, "code", code(err))
				r.watcher.Delivered(s)
				continue
			}
			outgoing = append(outgoing, s)
			continue
		}
		// zurückgehalten gilt als erledigt, bis sich die Scheibe oder der Zustand ändert
		r.watcher.Delivered(s)
		if decision.Reason != filter.NoConsent {
			r.requestedHeld[s.ScheibenID] = true
		}
		switch decision.Reason {
		case filter.Hidden:
			r.held[s.ScheibenID] = decision.Mode
		case filter.NoConsent:
			r.noConsent[s.ScheibenID] = true
		}
	}
	// ein zu alter Zustand (Zustimmungen könnten widerrufen sein): nichts hochladen, bis er wieder gelingt
	stale := now.Sub(r.stateAt) > MaxStateAge
	if stale && !r.staleLogged {
		r.staleLogged = true
		r.log("state-stale")
	}
	// die Uhr: doppelt zu `SetHold` (gehalten kommt nichts heraus), als Schutz, falls ein Stand doch hierher gelangt
	if len(outgoing) > 0 && !stale && !now.Before(r.pauseUntil) && r.clock == clockOK {
		if err := r.upload(ctx, outgoing); err != nil {
			return 0, err
		}
	}
	r.backlog = result.Backlog
	r.updateHistoryDone()
	r.updateRequestsDone()

	if err := r.heartbeat(ctx, now, true); err != nil {
		return 0, err
	}

	wait := QuietEvery
	if result.Busy {
		wait = BusyEvery
	}
	// ungeprüfte oder falsche Uhr: Was wartet, bliebe wartend und hielte den Takt im Sekundentakt; die Brücke läse bis
	// zu 50 ganze Scheiben je Sekunde, solange die Uhr falsch geht Die Freigabe kommt mit dem Heartbeat.
	if r.clock != clockOK {
		wait = max(wait, QuietEvery)
	}
	if pause := r.pauseUntil.Sub(now); pause > wait {
		wait = pause
	}
	// eine langsame Abfrage streckt den Takt, statt die Anlage zu bremsen
	return max(wait, 2*took), nil
}

// batches teilt nach Zahl und Größe (Spiegel nimmt 50 Snapshots und 4 MiB).
func batches(snapshots []contract.Snapshot) [][]contract.Snapshot {
	var out [][]contract.Snapshot
	var current []contract.Snapshot
	size := 0
	for _, s := range snapshots {
		n := api.Size(s)
		if len(current) > 0 && (len(current) == BatchSnapshots || size+n > BatchBytes) {
			out = append(out, current)
			current, size = nil, 0
		}
		current = append(current, s)
		size += n
	}
	if len(current) > 0 {
		out = append(out, current)
	}
	return out
}

func (r *Runner) upload(ctx context.Context, snapshots []contract.Snapshot) error {
	for _, batch := range batches(snapshots) {
		if err := r.send(ctx, batch); err != nil {
			return err
		}
		if r.now().Before(r.pauseUntil) {
			// was nicht hinausging, wartet und kommt mit der nächsten Lesung (ohne Warteschlange, ADR-027)
			return nil
		}
	}
	return nil
}

func (r *Runner) send(ctx context.Context, batch []contract.Snapshot) error {
	results, err := r.spiegel.Snapshots(ctx, batch)
	now := r.now()
	if err == nil {
		r.failures, r.uploadFailing = 0, false
		// je Stapel eine Zeile mit den Ergebnissen als Zahlen
		outcomes := map[string]int{}
		for _, res := range results {
			key := res.Outcome
			if res.Reason != "" {
				key += "/" + res.Reason
			}
			outcomes[key]++
		}
		pairs := []any{"snapshots", len(batch)}
		names := make([]string, 0, len(outcomes))
		for k := range outcomes {
			names = append(names, k)
		}
		sort.Strings(names)
		for _, k := range names {
			pairs = append(pairs, k, outcomes[k])
		}
		r.log("batch", pairs...)
		for _, res := range results {
			if res.Index < 0 || res.Index >= len(batch) || batch[res.Index].ScheibenID != res.ScheibenID {
				continue
			}
			s := batch[res.Index]
			switch {
			case res.Final():
				r.watcher.Delivered(s)
				delete(r.unconfirmed, s.ScheibenID)
				// Spiegel kannte keine Zustimmung (die Liste der Brücke war alt): kommt sie, geht die Scheibe erneut
				if res.Outcome == "discarded" && res.Reason == "no-consent" {
					r.noConsent[s.ScheibenID] = true
				}
			case res.Outcome == "epoch-unconfirmed":
				// eine Epoche, die Spiegel nicht kennt (kommt nicht vor: die Brücke nimmt die aus `GET /state`); wird sie je
				// bestätigt, schickt `refreshState` sie neu (SF-23)
				r.watcher.Delivered(s)
				r.unconfirmed[s.ScheibenID] = true
			default:
				// `future` oder `past`: die Uhr der Brücke widerspricht Spiegel; kurz warten, `past` heißt auch neu messen
				r.pauseUntil = now.Add(FuturePause)
				r.log(res.Outcome, "scheibe", s.ScheibenID)
				if res.Outcome == "past" {
					r.setClock(clockUnchecked)
				}
			}
		}
		return nil
	}
	var apiErr *api.Error
	if !errors.As(err, &apiErr) {
		apiErr = &api.Error{Code: "error"}
	}
	switch {
	case apiErr.Status == 401:
		return ErrUnauthorized
	case apiErr.Status == 413:
		if len(batch) > 1 {
			half := len(batch) / 2
			if err := r.send(ctx, batch[:half]); err != nil {
				return err
			}
			if r.now().Before(r.pauseUntil) {
				return nil
			}
			return r.send(ctx, batch[half:])
		}
		r.log("card-too-large", "scheibe", batch[0].ScheibenID)
		r.watcher.Delivered(batch[0])
	case apiErr.Status == 429 || apiErr.Status == 503:
		// Spiegel bremst: so lange warten, wie es sagt (SF-58)
		wait := max(apiErr.RetryAfter, time.Second)
		r.pauseUntil = now.Add(wait)
		r.log("throttled", "status", apiErr.Status, "seconds", int(wait.Seconds()))
	case apiErr.Status == 400:
		// ein Fehler der Brücke selbst; neu schicken hülfe nicht
		r.log("batch-rejected", "snapshots", len(batch), "issues", len(apiErr.Issues))
		// nur die genannten Snapshots verwerfen; die übrigen kommen mit der nächsten Lesung wieder
		named := map[int]bool{}
		for _, issue := range apiErr.Issues {
			if m := issueIndex.FindStringSubmatch(issue.Path); m != nil {
				i, _ := strconv.Atoi(m[1])
				named[i] = true
			}
		}
		for i, s := range batch {
			if len(named) == 0 || named[i] {
				r.watcher.Delivered(s)
			}
		}
	default:
		r.failures++
		r.uploadFailing = true
		r.pauseUntil = now.Add(r.backoff())
		r.log("upload-failed", "code", apiErr.Error(), "failures", r.failures)
	}
	return nil
}

func (r *Runner) status() string {
	switch {
	case r.dbStatus != "":
		return r.dbStatus
	case r.clock == clockWrong:
		return StatusClock
	case r.uploadFailing:
		return StatusDelayed
	case r.possibleReset:
		return StatusPossibleReset
	}
	return StatusOK
}

// setClock wechselt den Zustand der eigenen Uhr. Eine Uhrabweichung der Anlage aus der Zeit davor gilt nicht mehr: Sie
// ist gegen die alte Uhr gemessen.
func (r *Runner) setClock(state clockState) {
	if state != r.clock {
		r.clockOffset = nil
	}
	r.clock = state
}

// measureClock vergleicht die eigene Uhr mit `serverTime` aus der Antwort auf den Heartbeat (SF-79): Mitte zwischen
// Senden und Antwort minus Uhr von Spiegel, unsicher um die halbe Umlaufzeit. Sie stimmt, wenn sie auch im ungünstigsten
// Fall in der Schwelle liegt, und geht falsch, wenn sie auch im günstigsten daneben liegt; sonst bleibt der Zustand
// (eine harte Grenze der Umlaufzeit hielte die Brücke auf einer langsamen Leitung für immer).
func (r *Runner) measureClock(sent, back, server time.Time) {
	roundTrip := back.Sub(sent)
	if roundTrip < 0 {
		r.log("clock-unmeasured", "ms", roundTrip.Milliseconds())
		return
	}
	offset := sent.Add(roundTrip / 2).Sub(server)
	distance := max(offset, -offset)
	switch {
	case distance+roundTrip/2 <= ClockTolerance:
		if r.clock == clockWrong {
			r.log("clock-ok")
		}
		r.setClock(clockOK)
	case distance-roundTrip/2 > ClockTolerance:
		if r.clock != clockWrong {
			// negativ: die Brücke geht nach
			r.log("clock-wrong", "seconds", int64(offset.Round(time.Second)/time.Second))
		}
		r.setClock(clockWrong)
	default:
		r.log("clock-unmeasured", "ms", roundTrip.Milliseconds())
	}
}

func iso(t time.Time) string { return contract.ObservedAt(t.UnixMilli()) }

// heartbeat jede Minute, der erste gleich nach der ersten Runde.
func (r *Runner) heartbeat(ctx context.Context, now time.Time, dbReachable bool) error {
	if !r.lastHeartbeat.IsZero() && now.Sub(r.lastHeartbeat) < HeartbeatEvery {
		return nil
	}
	r.lastHeartbeat = now
	var fingerprint *api.SourceFingerprint
	if dbReachable {
		if f, err := r.src.Fingerprint(ctx); err == nil {
			fingerprint = &api.SourceFingerprint{Version: f.Version, Scheiben: f.Scheiben, Treffer: f.Treffer, OldestStamp: f.OldestStamp}
			// viele Scheiben auf einmal weg: Ablage geleert oder ein neuer Server (SF-23); nur melden
			if r.lastScheiben >= 10 && f.Scheiben*2 < r.lastScheiben && !r.possibleReset {
				r.possibleReset, r.resetFrom = true, r.lastScheiben
				r.log("possible-reset", "before", r.lastScheiben, "now", f.Scheiben)
			}
			// die Scheiben sind wieder da (ein falscher Alarm): nicht mehr melden
			if r.possibleReset && f.Scheiben*2 >= r.resetFrom {
				r.possibleReset = false
			}
			r.lastScheiben = f.Scheiben
		}
	}
	// was die Erkennung vergessen hat (einen Tag nicht in der Ablage), zählt nicht mehr
	known := map[int32]bool{}
	for _, id := range r.watcher.Known() {
		known[id] = true
	}
	for _, m := range []map[int32]bool{r.noConsent, r.unconfirmed} {
		for id := range m {
			if !known[id] {
				delete(m, id)
			}
		}
	}
	for id := range r.held {
		if !known[id] {
			delete(r.held, id)
		}
	}
	held := map[int]int{}
	for _, mode := range r.held {
		held[mode]++
	}
	heldBack := []api.Held{}
	for mode, n := range held {
		heldBack = append(heldBack, api.Held{DisplayMode: mode, Cards: n})
	}
	sort.Slice(heldBack, func(i, j int) bool { return heldBack[i].DisplayMode < heldBack[j].DisplayMode })
	hb := api.Heartbeat{
		ContractVersion:     contract.ContractVersion,
		BridgeVersion:       r.version,
		RunStartedAt:        iso(r.started),
		Status:              r.status(),
		Backlog:             r.backlog,
		QueryMs:             r.queryMs,
		SourceClockOffsetMs: nil,
		HeldBack:            heldBack,
		SourceFingerprint:   fingerprint,
		HistoryDone:         r.historyDone,
		RequestsDone:        r.requestsDone,
	}
	// gegen eine falsche oder ungeprüfte eigene Uhr gemessen, sagt die Abweichung nichts über die Anlage (SF-79)
	if r.clock == clockOK {
		hb.SourceClockOffsetMs = r.clockOffset
	}
	if r.lastDB != nil {
		at := iso(*r.lastDB)
		hb.LastDBContactAt = &at
	}
	// der Zeitpunkt des Sendens, nicht der Beginn der Runde: Spiegel prüft daran die Uhr der Brücke
	sent := r.now()
	hb.SentAt = iso(sent)
	server, err := r.spiegel.Heartbeat(ctx, hb)
	if err != nil {
		if unauthorized(err) {
			return ErrUnauthorized
		}
		// ein älterer Spiegel kennt `clock` nicht und lehnt ab: ungeprüft melden, beim nächsten Mal messen; sonst hielte
		// die Brücke für immer
		var apiErr *api.Error
		if r.clock == clockWrong && errors.As(err, &apiErr) && apiErr.Status == 400 {
			r.setClock(clockUnchecked)
		}
		r.log("heartbeat-failed", "code", code(err))
		return nil
	}
	r.measureClock(sent, r.now(), server)
	return nil
}

// Run wiederholt `Step` bis zum Ende des Kontexts oder einem widerrufenen Token. Nach jedem Schritt und beim Warten
// alle `AliveEvery` meldet es `Alive`: Ein Schritt, der hängt, meldet nichts, und der Watchdog beendet die Brücke.
func (r *Runner) Run(ctx context.Context) error {
	for {
		wait, err := r.Step(ctx)
		if err != nil {
			return err
		}
		r.alive()
		if !r.wait(ctx, wait) {
			return nil
		}
	}
}

// wait wartet `d` und meldet dabei weiter, dass die Schleife lebt; false, wenn der Kontext endet.
func (r *Runner) wait(ctx context.Context, d time.Duration) bool {
	next := time.NewTimer(d)
	defer next.Stop()
	tick := time.NewTicker(AliveEvery)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return false
		case <-next.C:
			return true
		case <-tick.C:
			r.alive()
		}
	}
}

func (r *Runner) alive() {
	if r.Alive != nil {
		r.Alive()
	}
}
