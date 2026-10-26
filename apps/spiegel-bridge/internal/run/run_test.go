package run

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/api"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/filter"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/ssmdb2"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/watch"
)

const salt = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"

func text(s string) *string { return &s }

// ablage ist die SSMDB2 im Speicher.
type ablage struct {
	now    *string // Uhr der Anlage
	stamps map[int32]string
	data   map[int32]contract.Data
	fail   error
	reads  map[int32]int // wie oft eine Scheibe ganz gelesen wurde
}

func (a *ablage) Round(_ context.Context, choose func([]watch.Lifesign, *string) []int32) (watch.Round, error) {
	if a.fail != nil {
		return watch.Round{}, a.fail
	}
	var lifesigns []watch.Lifesign
	for id, stamp := range a.stamps {
		l := watch.Lifesign{ID: id, Stamp: stamp}
		// die SportpassID der Zeile wie `readLifesigns`
		if rows := a.data[id].Scheiben.Rows; len(rows) == 1 {
			l.Sportpass = rows[0]["SportpassID"]
		}
		lifesigns = append(lifesigns, l)
	}
	cards := map[int32]contract.Data{}
	for _, id := range choose(lifesigns, nil) {
		cards[id] = a.data[id]
		if a.reads != nil {
			a.reads[id]++
		}
	}
	return watch.Round{Lifesigns: lifesigns, Cards: cards, SessionTimeZone: "+00:00", SourceVersion: text("9"), SourceNow: a.now}, nil
}

func (a *ablage) Fingerprint(context.Context) (ssmdb2.Fingerprint, error) {
	return ssmdb2.Fingerprint{Version: text("9"), Scheiben: len(a.stamps), Treffer: 0}, nil
}

// put legt eine Scheibe an: Sportpass, Anzeigeart je Schuss, Zahl der Schüsse.
func (a *ablage) put(id int32, sportpass string, mode string, shots int) {
	sid := fmt.Sprint(id)
	treffer := contract.Table{Columns: map[string]string{"ScheibenID": "int(11)", "Treffer": "smallint(6)", "Wertung": "int(11)", "Zeitstempel": "datetime"}, Rows: []contract.Row{}}
	for i := 1; i <= shots; i++ {
		treffer.Rows = append(treffer.Rows, contract.Row{"ScheibenID": text(sid), "Treffer": text(fmt.Sprint(i)), "Wertung": text(mode), "Zeitstempel": text("2026-10-13 20:00:00")})
	}
	a.stamps[id] = fmt.Sprintf("2026-10-13 20:%02d:00", shots)
	a.data[id] = contract.Data{
		Scheiben: contract.Table{
			Columns: map[string]string{"ScheibenID": "int(11)", "Nachname": "varchar(36)", "SportpassID": "bigint(20)"},
			Rows:    []contract.Row{{"ScheibenID": text(sid), "Nachname": text("Muster"), "SportpassID": text(sportpass)}},
		},
		Serien:  contract.Table{Columns: map[string]string{"ScheibenID": "int(11)"}, Rows: []contract.Row{}},
		Treffer: treffer,
	}
}

// setSportpass bucht eine Scheibe um wie Meyton: neue SportpassID in `Scheiben`, das Lebenszeichen bleibt.
func (a *ablage) setSportpass(id int32, sportpass string) {
	d := a.data[id]
	row := contract.Row{}
	for k, v := range d.Scheiben.Rows[0] {
		row[k] = v
	}
	row["SportpassID"] = text(sportpass)
	d.Scheiben = contract.Table{Columns: d.Scheiben.Columns, Rows: []contract.Row{row}}
	a.data[id] = d
}

// spiegel ist Spiegel im Speicher: Antworten der Reihe nach, sonst Erfolg.
type spiegel struct {
	state      api.State
	stateErr   error
	errs       []error // nächste Antworten auf Stapel
	outcome    func(contract.Snapshot) string
	batches    [][]contract.Snapshot
	heartbeats []api.Heartbeat
	// die Uhr von Spiegel (`serverTime`); ein Heartbeat dauert `hbTakes`, die Uhr der Brücke läuft dabei (`advance`)
	serverTime func() time.Time
	hbTakes    time.Duration
	advance    func(time.Duration)
	hbErr      error
	// lehnt einen Heartbeat ab (etwa ein älterer Spiegel, der einen Status nicht kennt)
	hbCheck func(api.Heartbeat) error
	// so lange dauert ein Stapel
	snapTakes time.Duration
}

func (s *spiegel) State(context.Context) (api.State, error) {
	if s.stateErr != nil {
		return api.State{}, s.stateErr
	}
	return s.state, nil
}

func (s *spiegel) Snapshots(_ context.Context, batch []contract.Snapshot) ([]api.Result, error) {
	if len(s.errs) > 0 {
		err := s.errs[0]
		s.errs = s.errs[1:]
		if err != nil {
			return nil, err
		}
	}
	s.batches = append(s.batches, batch)
	s.advance(s.snapTakes)
	var out []api.Result
	for i, snap := range batch {
		outcome := "stored"
		if s.outcome != nil {
			outcome = s.outcome(snap)
		}
		out = append(out, api.Result{Index: i, ScheibenID: snap.ScheibenID, Outcome: outcome})
	}
	return out, nil
}

func (s *spiegel) Heartbeat(_ context.Context, hb api.Heartbeat) (time.Time, error) {
	s.heartbeats = append(s.heartbeats, hb)
	if s.hbErr != nil {
		return time.Time{}, s.hbErr
	}
	if s.hbCheck != nil {
		if err := s.hbCheck(hb); err != nil {
			return time.Time{}, err
		}
	}
	s.advance(s.hbTakes / 2)
	at := s.serverTime()
	s.advance(s.hbTakes / 2)
	return at, nil
}

func (s *spiegel) sent() []int32 {
	var ids []int32
	for _, b := range s.batches {
		for _, snap := range b {
			ids = append(ids, snap.ScheibenID)
		}
	}
	return ids
}

type fixture struct {
	t     *testing.T
	clock time.Time
	// so weit geht Spiegel der Brücke voraus (eine Brücke, die 45 h nachgeht: +45 h)
	serverAhead time.Duration
	ablage      *ablage
	sp          *spiegel
	runner      *Runner
	logs        []string
}

func setup(t *testing.T, consent ...string) *fixture {
	f := &fixture{t: t, clock: time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)}
	f.ablage = &ablage{stamps: map[int32]string{}, data: map[int32]contract.Data{}}
	f.sp = &spiegel{}
	f.sp.serverTime = func() time.Time { return f.clock.Add(f.serverAhead) }
	f.sp.advance = func(d time.Duration) { f.clock = f.clock.Add(d) }
	f.sp.state.Sportpass.Salt = salt
	for _, c := range consent {
		f.sp.state.Sportpass.Hashes = append(f.sp.state.Sportpass.Hashes, filter.SportpassHash(salt, c))
	}
	log := func(code string, pairs ...any) { f.logs = append(f.logs, fmt.Sprint(append([]any{code}, pairs...)...)) }
	f.runner = New("test", f.ablage, f.sp, log, watch.Defaults, func() time.Time { return f.clock })
	return f
}

// step ist eine Runde; danach geht die Uhr um die Wartezeit weiter
func (f *fixture) step() time.Duration {
	f.t.Helper()
	wait, err := f.runner.Step(context.Background())
	if err != nil {
		f.t.Fatal(err)
	}
	f.clock = f.clock.Add(wait)
	return wait
}

func TestOnlyConsentingVisibleUnblockedCardsLeave(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3) // Zustimmung
	f.ablage.put(2, "87654321", "1", 3) // ohne Zustimmung
	f.ablage.put(3, "0", "1", 3)        // ohne Sportpass (SF-13)
	f.ablage.put(4, "12345678", "5", 3) // verdeckt (SF-19)
	f.ablage.put(5, "12345678", "0", 3) // Modus 0 (SF-20)
	f.ablage.put(6, "12345678", "1", 3) // gesperrt (SF-28)
	f.sp.state.Blocked = []api.Blocked{{ScheibenID: 6, StartedAt: time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)}}
	for range 4 {
		f.step()
	}
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("gesendet %s", got)
	}
	// der nächste Heartbeat nach einer Minute
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]
	raw, _ := json.Marshal(hb)
	if strings.Contains(string(raw), "Muster") || strings.Contains(string(raw), "12345678") {
		t.Fatal("Heartbeat mit Personenfeld (SF-59)")
	}
	if fmt.Sprint(hb.HeldBack) != "[{0 1} {5 1}]" || hb.Status != "ok" || hb.Backlog != 0 || hb.SourceFingerprint.Scheiben != 6 {
		t.Fatalf("Heartbeat %+v", hb)
	}
	if strings.Join(f.logs, "\n") != "" && strings.Contains(strings.Join(f.logs, "\n"), "Muster") {
		t.Fatal("Log mit Personenfeld")
	}
}

// In Meyton auf einen Schützen mit Zustimmung umgebucht (SF-80): Die ruhende Scheibe geht hinaus, das Log nennt nur die
// ScheibenID.
func TestReassignedCardLeavesWithConsent(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "87654321", "1", 3)
	f.runFor(30 * time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[]" {
		t.Fatalf("ohne Zustimmung %s", got)
	}
	f.ablage.setSportpass(1, "12345678")
	f.runFor(time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("nach dem Umbuchen %s", got)
	}
	if n, last := f.lines("card-reassigned"); n != 1 || last != "card-reassignedscheibe1lifesignsame" {
		t.Fatalf("Log %v", f.logs)
	}
	for _, l := range f.logs {
		if strings.Contains(l, "Muster") || strings.Contains(l, "12345678") || strings.Contains(l, "87654321") {
			t.Fatalf("Log mit Personenfeld: %s", l)
		}
	}
}

func TestNoStateNoUpload(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.stateErr = &api.Error{Code: "network"}
	for range 3 {
		f.step()
	}
	if len(f.sp.batches) != 0 || len(f.sp.heartbeats) != 0 {
		t.Fatal("ohne Zustand nichts hochladen (SF-38)")
	}
	f.sp.stateErr = nil
	for range 3 {
		f.step()
	}
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("mit Zustand: %s", got)
	}
}

func TestFailedUploadIsReadAndSentAgain(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.errs = []error{&api.Error{Code: "network"}}
	f.step()
	wait := f.step() // zwei gleiche Lesungen, der Upload scheitert
	if len(f.sp.batches) != 0 || wait < RetryFirst {
		t.Fatalf("nach Fehler: %d Stapel, Pause %v", len(f.sp.batches), wait)
	}
	f.step()
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("neu gelesen und geschickt: %s", got)
	}

	for range 3 {
		f.step()
	}
	if len(f.sp.sent()) != 1 {
		t.Fatal("ein bestätigter Stand geht nicht erneut")
	}
}

func TestRetryAfterIsHonoured(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.errs = []error{&api.Error{Status: 429, Code: "rate-limited", RetryAfter: 7 * time.Second}}
	f.step()
	before := f.clock
	if wait := f.step(); wait < 7*time.Second {
		t.Fatalf("Pause %v (SF-58)", wait)
	}
	// eine Runde mitten in der Pause (etwa nach einem Fehler der Ablage) schickt nichts
	f.clock = before.Add(3 * time.Second)
	if _, err := f.runner.Step(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(f.sp.sent()) != 0 {
		t.Fatal("während der Pause")
	}
	f.clock = before.Add(8 * time.Second)
	f.step()
	if len(f.sp.sent()) != 1 {
		t.Fatal("nach der Pause")
	}
}

func TestTooLargeSplitsTheBatch(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.ablage.put(2, "12345678", "1", 4)
	f.sp.errs = []error{&api.Error{Status: 413, Code: "too-large"}}
	f.step()
	f.step()
	if len(f.sp.batches) != 2 || len(f.sp.batches[0]) != 1 {
		t.Fatalf("Stapel %d", len(f.sp.batches))
	}
}

func TestUnauthorizedStops(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.errs = []error{&api.Error{Status: 401, Code: "unauthorized"}}
	f.step()
	if _, err := f.runner.Step(context.Background()); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("%v", err)
	}
}

func TestEpochUnconfirmedResentWhenConfirmed(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.outcome = func(contract.Snapshot) string { return "epoch-unconfirmed" }
	f.step()
	f.step()
	for range 3 {
		f.step()
	}
	if len(f.sp.sent()) != 1 {
		t.Fatalf("bis zur Bestätigung nicht erneut: %d", len(f.sp.sent()))
	}
	two := 2
	f.sp.state.Epoch = &two
	f.sp.outcome = nil
	f.clock = f.clock.Add(StateEvery)
	for range 3 {
		f.step()
	}
	b := f.sp.batches
	if len(b) != 2 || b[1][0].Epoch != 2 {
		t.Fatalf("nach der Bestätigung: %d Stapel", len(b))
	}
}

func TestNewConsentSendsWhatIsInMemory(t *testing.T) {
	f := setup(t)
	f.ablage.put(1, "12345678", "1", 3)
	for range 3 {
		f.step()
	}
	if len(f.sp.sent()) != 0 {
		t.Fatal("ohne Zustimmung")
	}
	f.sp.state.Sportpass.Hashes = []string{filter.SportpassHash(salt, "12345678")}
	f.clock = f.clock.Add(StateEvery)
	for range 3 {
		f.step()
	}
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("nach der Zustimmung: %s", got)
	}
}

func TestFutureSequencePauses(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.outcome = func(contract.Snapshot) string { return "future" }
	f.step()
	if wait := f.step(); wait < FuturePause {
		t.Fatalf("Pause %v", wait)
	}
}

func TestDatabaseDownIsReportedNotDeletion(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.step()
	f.step()
	f.ablage.fail = errors.New("dial tcp: connection refused")
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.Status != "db-error" {
		t.Fatalf("Status %s", hb.Status)
	}
	// ein Netzfehler heißt: Anlage nicht erreichbar
	f.ablage.fail = &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("refused")}
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.Status != "db-unreachable" {
		t.Fatalf("Status %s", hb.Status)
	}
	f.ablage.fail = nil
	for range 3 {
		f.step()
	}
	if len(f.sp.sent()) != 1 {
		t.Fatal("nach dem Ausfall nichts doppelt")
	}
}

func TestPossibleResetReported(t *testing.T) {
	f := setup(t, "12345678")
	for i := int32(1); i <= 12; i++ {
		f.ablage.put(i, "87654321", "1", 1)
	}
	f.step()
	for i := int32(1); i <= 10; i++ {
		delete(f.ablage.stamps, i)
	}
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.Status != "possible-reset" {
		t.Fatalf("Status %s", hb.Status)
	}
}

func TestBatches(t *testing.T) {
	var many []contract.Snapshot
	for i := range 120 {
		many = append(many, contract.Snapshot{ScheibenID: int32(i)})
	}
	b := batches(many)
	if len(b) != 3 || len(b[0]) != 50 || len(b[2]) != 20 {
		t.Fatalf("%d Stapel", len(b))
	}
	big := strings.Repeat("x", 4000)
	row := contract.Row{}
	for i := range 100 {
		row[fmt.Sprint("c", i)] = &big
	}
	var heavy []contract.Snapshot
	for i := range 20 {
		heavy = append(heavy, contract.Snapshot{ScheibenID: int32(i), Data: contract.Data{Treffer: contract.Table{Rows: []contract.Row{row}}}})
	}
	for _, batch := range batches(heavy) {
		size := 0
		for _, s := range batch {
			size += api.Size(s)
		}
		if size > BatchBytes {
			t.Fatalf("Stapel mit %d Bytes", size)
		}
	}
}

func TestCatchUpFromWatermarkInLocalTime(t *testing.T) {
	var state api.State
	state.Site.TimeZone = "Europe/Berlin"
	if catchUpFrom(state) != "" {
		t.Fatal("ohne Wasserstand nichts")
	}
	mark := time.Date(2026, 10, 9, 20, 4, 11, 0, time.UTC)
	state.Watermark = &mark
	// 20:04 UTC sind 22:04 Ortszeit (Sommerzeit), einen Tag davor
	if got := catchUpFrom(state); got != "2026-10-08 22:04:11" {
		t.Fatalf("%s", got)
	}
	state.Site.TimeZone = "Mars/Olympus"
	if got := catchUpFrom(state); got != "2026-10-08 20:04:11" {
		t.Fatalf("unbekannte Zone: %s", got)
	}
}

func TestCatchUpAfterStartWhileShooting(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3) // heute 20:03
	old := f.ablage.data[1]
	f.ablage.stamps[2], f.ablage.data[2] = "2026-10-12 21:00:00", old // der Abend davor, vor dem Startfenster
	mark := time.Date(2026, 10, 12, 19, 30, 0, 0, time.UTC)
	f.sp.state.Watermark = &mark
	f.sp.state.Site.TimeZone = "Europe/Berlin"
	// erst der laufende Stand, das Nachholen danach in derselben Runde (SF-52), auch während der Stand aktiv ist
	f.runFor(time.Minute)
	sent := fmt.Sprint(f.sp.sent())
	if !strings.Contains(sent, "1") || !strings.Contains(sent, "2") {
		t.Fatalf("gesendet %s", sent)
	}
}

func TestUploadFailingIsReportedDelayed(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	for range 10 {
		f.sp.errs = append(f.sp.errs, &api.Error{Code: "network"})
	}
	f.step()
	f.step()
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.Status != "delayed" || hb.Backlog != 1 {
		t.Fatalf("Heartbeat %+v", hb)
	}
}

func TestServiceUnavailableIsHonoured(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	// länger als die Pause nach einem Netzfehler (5 s): nur `Retry-After` erklärt sie
	f.sp.errs = []error{&api.Error{Status: 503, Code: "busy", RetryAfter: 40 * time.Second}}
	f.step()
	if wait := f.step(); wait < 40*time.Second {
		t.Fatalf("Pause %v", wait)
	}
}

func TestRejectedBatchDropsOnlyTheNamedSnapshot(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.ablage.put(2, "12345678", "1", 4)
	rejected := &api.Error{Status: 400, Code: "invalid"}
	rejected.Issues = append(rejected.Issues, struct {
		Path string `json:"path"`
		Code string `json:"code"`
	}{Path: "snapshots[0].data.treffer.rows[2]", Code: "custom"})
	f.sp.errs = []error{rejected}
	f.step()
	f.step() // Stapel [2, 1] (die jüngste zuerst), Index 0 verworfen
	for range 3 {
		f.step()
	}
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("gesendet %s", got)
	}
}

func TestSingleTooLargeIsDropped(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.errs = []error{&api.Error{Status: 413, Code: "too-large"}}
	f.step()
	f.step()
	for range 3 {
		f.step()
	}
	if len(f.sp.sent()) != 0 || !strings.Contains(strings.Join(f.logs, " "), "card-too-large") {
		t.Fatalf("gesendet %v, Log %v", f.sp.sent(), f.logs)
	}
}

func TestStateFailureWaits(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.step()
	calls := 0
	f.sp.stateErr = &api.Error{Status: 429, Code: "rate-limited", RetryAfter: 10 * time.Second}
	f.clock = f.clock.Add(StateEvery)
	counting := &countingSpiegel{spiegel: f.sp, calls: &calls}
	f.runner.spiegel = counting
	begin := f.clock
	// ein belegter Stand: Runden jede Sekunde
	for i := 0; f.clock.Sub(begin) < 30*time.Second; i++ {
		f.ablage.stamps[1] = fmt.Sprintf("2026-10-13 21:00:%02d", i%60)
		f.step()
	}
	if calls > 3 {
		t.Fatalf("%d Abfragen des Zustands in 30 s", calls)
	}
}

// Neue Zustimmungen, Aufträge und aufgehobene Meldungen erreichen die Brücke binnen einer Minute: Sie fragt einmal je
// Minute, weit unter dem, was Spiegel nimmt (sechs je Minute).
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
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("nach der Zustimmung %s", got)
	}
}

type countingSpiegel struct {
	*spiegel
	calls *int
}

func (c *countingSpiegel) State(ctx context.Context) (api.State, error) {
	*c.calls++
	return c.spiegel.State(ctx)
}

func TestStaleStateStopsUploads(t *testing.T) {
	f := setup(t, "12345678")
	f.step()
	f.sp.stateErr = &api.Error{Code: "network"}
	f.clock = f.clock.Add(MaxStateAge + time.Minute)
	f.ablage.put(1, "12345678", "1", 3)
	for range 4 {
		f.step()
	}
	if len(f.sp.sent()) != 0 {
		t.Fatal("mit einem Zustand älter als eine Stunde nichts hochladen")
	}
	f.sp.stateErr = nil
	f.clock = f.clock.Add(RetryMax)
	for range 4 {
		f.step()
	}
	if len(f.sp.sent()) != 1 {
		t.Fatal("mit frischem Zustand wieder")
	}
}

func TestClockOffsetBoundedAndMeasured(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.now = text("2026-10-13 18:00:02.500")
	f.step()
	// der erste Heartbeat prüft erst die eigene Uhr: ohne sie keine Abweichung der Anlage (SF-79)
	if hb := f.sp.heartbeats[0]; hb.SourceClockOffsetMs != nil {
		t.Fatalf("ungeprüft gemeldet: %v", *hb.SourceClockOffsetMs)
	}
	f.clock = f.clock.Add(HeartbeatEvery)
	f.ablage.now = text(f.clock.Add(2500 * time.Millisecond).Format("2006-01-02 15:04:05.000"))
	f.step()
	// gemessen gegen die Mitte der Runde: ein paar Mikrosekunden der echten Abfrage gehen ab
	if hb := f.sp.heartbeats[1]; hb.SourceClockOffsetMs == nil || *hb.SourceClockOffsetMs < 2490 || *hb.SourceClockOffsetMs > 2500 {
		t.Fatalf("Versatz %v", hb.SourceClockOffsetMs)
	}
	f.ablage.now = text("2000-01-01 00:00:00.000")
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.SourceClockOffsetMs != nil {
		t.Fatalf("Uhr auf 2000: %v", *hb.SourceClockOffsetMs)
	}
}

func TestHeartbeatMatchesTheSchema(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "5", 3)
	f.step()
	f.step()
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]
	instant := regexp.MustCompile(`^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$`)
	if !instant.MatchString(hb.RunStartedAt) || !instant.MatchString(hb.SentAt) || hb.LastDBContactAt == nil || !instant.MatchString(*hb.LastDBContactAt) {
		t.Fatalf("Zeiten %+v", hb)
	}
	if hb.ContractVersion != 1 || hb.BridgeVersion == "" || hb.Status != "ok" || hb.QueryMs == nil || *hb.QueryMs < 0 {
		t.Fatalf("%+v", hb)
	}
	if fmt.Sprint(hb.HeldBack) != "[{5 1}]" || hb.SourceFingerprint == nil || *hb.SourceFingerprint.Version != "9" {
		t.Fatalf("%+v", hb)
	}
}

// old legt eine Scheibe von einem früheren Abend an (vor dem Startfenster, ohne Wasserstand also nie nachgeholt).
func (a *ablage) old(id int32, sportpass, mode, stamp string) {
	a.put(id, sportpass, mode, 3)
	a.stamps[id] = stamp
}

// lastDone: die erledigten Aufträge im jüngsten Heartbeat
func (f *fixture) lastDone() string {
	if len(f.sp.heartbeats) == 0 {
		return "keiner"
	}
	var ids []int
	for _, d := range f.sp.heartbeats[len(f.sp.heartbeats)-1].HistoryDone {
		ids = append(ids, d.ID)
	}
	return fmt.Sprint(ids)
}

// request ist ein Auftrag zum Nachladen für die SportpassID, eröffnet zu `since`
func request(id int, sportpass, since string) api.HistoryRequest {
	return api.HistoryRequest{ID: id, Since: since, SportpassHash: filter.SportpassHash(salt, sportpass)}
}

const since1 = "2026-10-13T17:00:00.000Z"

// runFor macht Runden, bis die Uhr so weit ist; der Heartbeat jede Minute
func (f *fixture) runFor(d time.Duration) {
	end := f.clock.Add(d)
	for f.clock.Before(end) {
		f.step()
	}
}

func TestHistoryLoadsOlderCardsWhileShooting(t *testing.T) {
	f := setup(t, "12345678")
	f.sp.state.History = []api.HistoryRequest{{ID: 7, SportpassHash: filter.SportpassHash(salt, "12345678")}}
	f.ablage.put(1, "12345678", "1", 3)                     // der laufende Abend
	f.ablage.old(2, "12345678", "1", "2025-05-01 19:00:00") // älter, angefordert
	f.ablage.old(3, "12345678", "1", "2024-11-20 18:30:00") // älter, angefordert
	f.ablage.old(4, "87654321", "1", "2025-05-02 19:00:00") // älter, ohne Auftrag und ohne Zustimmung
	// der Stand ist aktiv: Das Nachladen kommt trotzdem, hinter dem laufenden Stand (SF-52)
	f.runFor(2 * time.Minute)
	sent := fmt.Sprint(f.sp.sent())
	if !strings.Contains(sent, "2") || !strings.Contains(sent, "3") || strings.Contains(sent, "4") {
		t.Fatalf("gesendet %s", sent)
	}
	f.runFor(2 * HeartbeatEvery)
	if f.lastDone() != "[7]" {
		t.Fatalf("erledigt %s", f.lastDone())
	}
}

func TestHistoryHeldBackCardsCountAsDone(t *testing.T) {
	f := setup(t, "12345678")
	f.sp.state.History = []api.HistoryRequest{
		request(7, "12345678", since1),
		// ein Auftrag ohne Scheiben in der Ablage ist gleich nach der ersten Runde erledigt
		request(8, "555", since1),
	}
	f.ablage.put(1, "87654321", "1", 3)                     // der laufende Abend, ohne Zustimmung
	f.ablage.old(5, "12345678", "5", "2025-05-01 19:00:00") // verdeckt (SF-19)
	f.ablage.old(6, "12345678", "1", "2025-05-03 19:00:00") // gesperrt
	// die Sperre gilt um den Beginn aus den Schusszeiten (`put` schreibt sie auf den 13. Oktober)
	f.sp.state.Blocked = []api.Blocked{{ScheibenID: 6, StartedAt: time.Date(2026, 10, 13, 20, 0, 0, 0, time.UTC)}}
	f.step()
	if f.lastDone() != "[8]" {
		t.Fatalf("nach der ersten Runde %s", f.lastDone())
	}
	// auch während der Stand aktiv ist
	f.runFor(2 * time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[]" {
		t.Fatalf("gesendet %s", got)
	}
	if f.lastDone() != "[7 8]" {
		t.Fatalf("erledigt %s", f.lastDone())
	}
}

func TestHistoryDoneOnlyAfterSpiegelAnswered(t *testing.T) {
	f := setup(t, "12345678")
	f.sp.state.History = []api.HistoryRequest{{ID: 7, SportpassHash: filter.SportpassHash(salt, "12345678")}}
	f.ablage.put(1, "87654321", "1", 3) // der laufende Abend, ohne Zustimmung
	f.ablage.old(2, "12345678", "1", "2025-05-01 19:00:00")
	// Spiegel antwortet erst nicht (Netz), dann schon; die Pausen nach zehn Fehlern dauern zusammen über sieben Minuten
	for range 10 {
		f.sp.errs = append(f.sp.errs, errors.New("netz"))
	}
	f.runFor(3 * time.Minute)
	if f.lastDone() != "[]" || len(f.sp.errs) == 10 {
		t.Fatalf("ohne Antwort erledigt: %s (%d Fehler übrig)", f.lastDone(), len(f.sp.errs))
	}
	f.sp.errs = nil
	f.runFor(3 * time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[2]" {
		t.Fatalf("gesendet %s", got)
	}
	f.runFor(2 * HeartbeatEvery)
	if f.lastDone() != "[7]" {
		t.Fatalf("erledigt %s", f.lastDone())
	}
}

func TestHistoryRequestMidRunTakesEffect(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "87654321", "1", 3) // der laufende Abend, ohne Zustimmung: verankert das Startfenster
	f.ablage.old(2, "12345678", "1", "2025-05-01 19:00:00")
	f.runFor(3 * time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[]" {
		t.Fatalf("ohne Auftrag %s", got)
	}
	// mit dem nächsten Zustand, auch während der Stand aktiv ist
	f.sp.state.History = []api.HistoryRequest{{ID: 9, SportpassHash: filter.SportpassHash(salt, "12345678")}}
	f.runFor(StateEvery + time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[2]" {
		t.Fatalf("nach dem neuen Auftrag %s", got)
	}
	f.runFor(2 * HeartbeatEvery)
	if f.lastDone() != "[9]" {
		t.Fatalf("erledigt %s", f.lastDone())
	}
}

func TestHistoryReopenedRequestReadsHandledCardsAgain(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "87654321", "1", 3) // der laufende Abend, ohne Zustimmung
	f.ablage.old(2, "12345678", "1", "2025-05-01 19:00:00")
	// als „nicht meine“ gemeldet: gesperrt, die Brücke hält sie zurück und meldet den Auftrag erledigt
	f.sp.state.History = []api.HistoryRequest{request(7, "12345678", since1)}
	f.sp.state.Blocked = []api.Blocked{{ScheibenID: 2, StartedAt: time.Date(2026, 10, 13, 20, 0, 0, 0, time.UTC)}}
	f.runFor(23 * time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[]" || f.lastDone() != "[7]" {
		t.Fatalf("gesperrt: gesendet %s, erledigt %s", got, f.lastDone())
	}
	// der Admin hebt die Meldung auf: dieselbe Id, neu eröffnet, ohne Sperre
	f.sp.state.Blocked = nil
	f.sp.state.History = []api.HistoryRequest{request(7, "12345678", "2026-10-13T18:30:00.000Z")}
	f.runFor(StateEvery + 2*time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[2]" {
		t.Fatalf("nach dem Aufheben gesendet %s", got)
	}
	f.runFor(2 * HeartbeatEvery)
	last := f.sp.heartbeats[len(f.sp.heartbeats)-1].HistoryDone
	if len(last) != 1 || last[0].Since != "2026-10-13T18:30:00.000Z" {
		t.Fatalf("erledigt %+v", last)
	}
}

// Nimmt Spiegel nichts an, warten die nachgeladenen Scheiben und werden jede Runde neu gelesen. Solange geschossen
// wird, belegen sie dabei höchstens das Budget des Leerlaufs (SF-52), der laufende Stand bleibt vorn.
func TestHistoryWaitingCardsStayInTheBudgetWhileShooting(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.reads = map[int32]int{}
	f.ablage.put(1, "87654321", "1", 3)
	for id := int32(2); id < 10; id++ {
		f.ablage.old(id, "12345678", "1", fmt.Sprintf("2025-05-%02d 19:00:00", id))
	}
	f.sp.state.History = []api.HistoryRequest{request(7, "12345678", since1)}
	for range 200 {
		f.sp.errs = append(f.sp.errs, errors.New("netz"))
	}
	for i := range 20 {
		f.ablage.stamps[1] = fmt.Sprintf("2026-10-13 21:%02d:00", i)
		before := map[int32]int{}
		for id, n := range f.ablage.reads {
			before[id] = n
		}
		f.step()
		history := 0
		for id := int32(2); id < 10; id++ {
			history += f.ablage.reads[id] - before[id]
		}
		if f.ablage.reads[1]-before[1] != 1 || history > watch.Defaults.IdleWhileLive {
			t.Fatalf("Runde %d: Stand 1 %d-mal, Nachladen %d Scheiben", i, f.ablage.reads[1]-before[1], history)
		}
	}
	if len(f.sp.errs) == 200 {
		t.Fatal("kein Upload versucht")
	}
}

func TestRunReportsAlive(t *testing.T) {
	f := setup(t, "12345678")
	var alive atomic.Int32
	f.runner.Alive = func() { alive.Add(1) }
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- f.runner.Run(ctx) }()
	// die erste Meldung kommt gleich nach dem ersten Schritt, nicht erst nach dem Warten
	for deadline := time.Now().Add(2 * time.Second); alive.Load() == 0; {
		if time.Now().After(deadline) {
			t.Fatal("kein Lebenszeichen nach dem ersten Schritt")
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

// unreachable ist der Fehler einer ausgeschalteten Anlage (`ssmdb2.Code`: connection).
var unreachable = &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("no route to host")}

// lines zählt die Zeilen im Log mit diesem Code und gibt die letzte zurück (wie `fmt.Sprint`: ohne Leerzeichen
// zwischen Texten).
func (f *fixture) lines(code string) (int, string) {
	n, last := 0, ""
	for _, l := range f.logs {
		if strings.HasPrefix(l, code) {
			n, last = n+1, l
		}
	}
	return n, last
}

func TestRepeatedRoundFailureLogsRarely(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.fail = unreachable
	// ein Schritt mit Fehler wartet 10 s: 61 Schritte sind zehn Minuten nach dem ersten
	for range 61 {
		f.step()
	}
	if n, last := f.lines("round-failed"); n != 2 || last != "round-failedcodeconnectionrounds61" {
		t.Fatalf("%d Zeilen, zuletzt %q", n, last)
	}
	f.ablage.fail = nil
	f.step()
	if n, last := f.lines("round-ok"); n != 1 || last != "round-okafter61" {
		t.Fatalf("%d Zeilen, zuletzt %q", n, last)
	}
	f.ablage.fail = unreachable
	f.step()
	if n, last := f.lines("round-failed"); n != 3 || last != "round-failedcodeconnectionrounds1" {
		t.Fatalf("%d Zeilen, zuletzt %q", n, last)
	}
}

// Die Anlage ist im Sommer wochenlang aus, die Brücke läuft weiter. Was am Ende des letzten Abends nicht hinauskam
// (Internet weg), geht hinaus, sobald die Anlage wieder an ist: aus dem Speicher, und nach einem Neustart der Brücke
// in der Pause (Reboot nach einem Update) über das Startfenster. Woher es kommt, zeigt die Scheibe, die schon oben war:
// Aus dem Speicher geht sie nicht noch einmal, nach dem Neustart liest die Brücke sie neu und schickt sie erneut.
func TestWaitingCardSurvivesWeeksWithoutSource(t *testing.T) {
	for _, reboot := range []bool{false, true} {
		t.Run(fmt.Sprintf("reboot=%v", reboot), func(t *testing.T) {
			f := setup(t, "12345678")
			count := func(id int32) int {
				n := 0
				for _, sent := range f.sp.sent() {
					if sent == id {
						n++
					}
				}
				return n
			}
			f.ablage.put(2, "12345678", "1", 2)
			f.step()
			f.step()
			if count(2) != 1 {
				t.Fatalf("die erste Scheibe ist nicht oben: %v", f.sp.sent())
			}
			f.ablage.put(1, "12345678", "1", 3)
			f.sp.errs = []error{&api.Error{Code: "network"}, &api.Error{Code: "network"}, &api.Error{Code: "network"}}
			f.step()
			f.step() // zwei gleiche Lesungen, der Upload scheitert
			if count(1) != 0 {
				t.Fatal("der Upload sollte scheitern")
			}
			f.ablage.fail = unreachable
			f.sp.errs = nil
			f.step()
			if reboot {
				log := func(code string, pairs ...any) {
					f.logs = append(f.logs, fmt.Sprint(append([]any{code}, pairs...)...))
				}
				f.runner = New("test", f.ablage, f.sp, log, watch.Defaults, func() time.Time { return f.clock })
			}
			f.clock = f.clock.Add(21 * 24 * time.Hour)
			for range 3 {
				f.step()
			}
			f.ablage.fail = nil
			for range 6 {
				f.step()
			}
			if count(1) != 1 {
				t.Fatalf("nach drei Wochen gesendet: %v, Log %v", f.sp.sent(), f.logs)
			}
			// aus dem Speicher: die bestätigte nicht noch einmal; nach dem Neustart: neu gelesen und erneut geschickt
			if want := map[bool]int{false: 1, true: 2}[reboot]; count(2) != want {
				t.Fatalf("die schon gesendete Scheibe %d-mal statt %d-mal: %v", count(2), want, f.sp.sent())
			}
		})
	}
}

// lastRequests: der Ausgang der Aufträge per ID im jüngsten Heartbeat
func (f *fixture) lastRequests() string {
	if len(f.sp.heartbeats) == 0 {
		return "keiner"
	}
	var out []string
	for _, d := range f.sp.heartbeats[len(f.sp.heartbeats)-1].RequestsDone {
		out = append(out, fmt.Sprintf("%d:%s", d.ID, d.Outcome))
	}
	return fmt.Sprint(out)
}

func TestRequestedCardLeavesWithoutConsentWhileShooting(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)                     // der laufende Abend, mit Zustimmung
	f.ablage.put(2, "87654321", "1", 3)                     // ohne Zustimmung, angefragt
	f.ablage.put(3, "87654321", "1", 3)                     // ohne Zustimmung, nicht angefragt
	f.ablage.old(4, "0", "1", "2025-05-01 19:00:00")        // alt (Lebenszeichen), ohne Sportpass, angefragt; Schüsse wie `put` am 13.
	f.ablage.old(5, "87654321", "1", "2025-05-02 19:00:00") // alt, nicht angefragt
	f.sp.state.Requests = []api.CardRequest{{ID: 7, ScheibenID: 2, Day: "2026-10-13"}, {ID: 8, ScheibenID: 4, Day: "2026-10-13"}}
	// der Stand ist aktiv: Ein Auftrag per ID kommt vor dem Budget des Leerlaufs (anders als das Nachladen)
	f.runFor(2 * time.Minute)
	sent := fmt.Sprint(f.sp.sent())
	for _, want := range []string{"1", "2", "4"} {
		if !strings.Contains(sent, want) {
			t.Fatalf("gesendet %s, %s fehlt", sent, want)
		}
	}
	if strings.Contains(sent, "3") || strings.Contains(sent, "5") {
		t.Fatalf("gesendet %s: nicht angefragt", sent)
	}
	f.runFor(2 * HeartbeatEvery)
	if got := f.lastRequests(); got != "[7:sent 8:sent]" {
		t.Fatalf("Ausgang %s", got)
	}
	raw, _ := json.Marshal(f.sp.heartbeats[len(f.sp.heartbeats)-1])
	if strings.Contains(string(raw), "87654321") || strings.Contains(string(raw), "Muster") {
		t.Fatal("Heartbeat mit Personenfeld (SF-59)")
	}
}

func TestRequestMissingOrHeld(t *testing.T) {
	f := setup(t)
	f.ablage.put(1, "87654321", "1", 3) // verankert das Startfenster
	f.ablage.put(2, "87654321", "5", 3) // verdeckt (SF-19)
	f.ablage.put(3, "87654321", "1", 3) // gesperrt
	f.ablage.put(4, "87654321", "1", 0) // ohne Treffer (SF-13): keine Scheibe
	f.sp.state.Blocked = []api.Blocked{{ScheibenID: 3, StartedAt: time.Date(2026, 10, 13, 20, 0, 0, 0, time.UTC)}}
	f.sp.state.Requests = []api.CardRequest{{ID: 5, ScheibenID: 2, Day: "2026-10-13"}, {ID: 6, ScheibenID: 3, Day: "2026-10-13"}, {ID: 7, ScheibenID: 99, Day: "2026-10-13"}, {ID: 8, ScheibenID: 4, Day: "2026-10-13"}}
	f.runFor(2 * HeartbeatEvery)
	if got := fmt.Sprint(f.sp.sent()); got != "[]" {
		t.Fatalf("gesendet %s", got)
	}
	if got := f.lastRequests(); got != "[5:held 6:held 7:missing 8:missing]" {
		t.Fatalf("Ausgang %s", got)
	}
}

func TestRequestAfterTheCardWasHeldWithoutConsent(t *testing.T) {
	f := setup(t)
	f.ablage.put(1, "87654321", "1", 3)
	f.runFor(3 * time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[]" {
		t.Fatalf("ohne Auftrag %s", got)
	}
	// der Auftrag kommt mit dem nächsten Zustand: Die schon zurückgehaltene Scheibe wird noch einmal gelesen
	f.sp.state.Requests = []api.CardRequest{{ID: 9, ScheibenID: 1, Day: "2026-10-13"}}
	f.runFor(StateEvery + time.Minute)
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("nach dem Auftrag %s", got)
	}
	// Spiegel nennt den Auftrag nicht mehr: nicht mehr melden
	f.sp.state.Requests = nil
	f.runFor(StateEvery + HeartbeatEvery)
	if got := f.lastRequests(); got != "[]" {
		t.Fatalf("Ausgang nach dem Ende %s", got)
	}
}

func TestRequestForAnotherEveningStaysHome(t *testing.T) {
	f := setup(t)
	f.ablage.put(1, "87654321", "1", 3) // Schüsse am 13. Oktober, 20 Uhr
	f.ablage.put(2, "87654321", "1", 3)
	f.sp.state.Requests = []api.CardRequest{{ID: 5, ScheibenID: 1, Day: "2026-10-12"}, {ID: 6, ScheibenID: 2, Day: "2026-10-13"}}
	f.runFor(2 * HeartbeatEvery)
	if got := fmt.Sprint(f.sp.sent()); got != "[2]" {
		t.Fatalf("gesendet %s: nur die Scheibe vom genannten Abend", got)
	}
	if got := f.lastRequests(); got != "[5:mismatch 6:sent]" {
		t.Fatalf("Ausgang %s", got)
	}
}
