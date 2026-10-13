package run

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
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
}

func (a *ablage) Round(_ context.Context, choose func([]watch.Lifesign, *string) []int32) (watch.Round, error) {
	if a.fail != nil {
		return watch.Round{}, a.fail
	}
	var lifesigns []watch.Lifesign
	for id, stamp := range a.stamps {
		lifesigns = append(lifesigns, watch.Lifesign{ID: id, Stamp: stamp})
	}
	cards := map[int32]contract.Data{}
	for _, id := range choose(lifesigns, nil) {
		cards[id] = a.data[id]
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

// spiegel ist Spiegel im Speicher: Antworten der Reihe nach, sonst Erfolg.
type spiegel struct {
	state      api.State
	stateErr   error
	errs       []error // nächste Antworten auf Stapel
	outcome    func(contract.Snapshot) string
	batches    [][]contract.Snapshot
	heartbeats []api.Heartbeat
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

func (s *spiegel) Heartbeat(_ context.Context, hb api.Heartbeat) error {
	s.heartbeats = append(s.heartbeats, hb)
	return nil
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
	t      *testing.T
	clock  time.Time
	ablage *ablage
	sp     *spiegel
	runner *Runner
	logs   []string
}

func setup(t *testing.T, consent ...string) *fixture {
	f := &fixture{t: t, clock: time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)}
	f.ablage = &ablage{stamps: map[int32]string{}, data: map[int32]contract.Data{}}
	f.sp = &spiegel{}
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

func TestCatchUpAfterStart(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3) // heute 20:03
	old := f.ablage.data[1]
	f.ablage.stamps[2], f.ablage.data[2] = "2026-10-12 21:00:00", old // der Abend davor, vor dem Startfenster
	mark := time.Date(2026, 10, 12, 19, 30, 0, 0, time.UTC)
	f.sp.state.Watermark = &mark
	f.sp.state.Site.TimeZone = "Europe/Berlin"
	// erst der laufende Stand; der Abend davor erst, wenn 20 Minuten nichts mehr läuft (SF-52), dann sofort
	begin := f.clock
	for f.clock.Sub(begin) < 19*time.Minute {
		f.step()
	}
	if got := fmt.Sprint(f.sp.sent()); got != "[1]" {
		t.Fatalf("während der Stand aktiv ist: %s", got)
	}
	for f.clock.Sub(begin) < 22*time.Minute {
		f.step()
	}
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
	// gemessen gegen die Mitte der Runde: ein paar Mikrosekunden der echten Abfrage gehen ab
	if hb := f.sp.heartbeats[0]; hb.SourceClockOffsetMs == nil || *hb.SourceClockOffsetMs < 2490 || *hb.SourceClockOffsetMs > 2500 {
		t.Fatalf("Versatz %v", *hb.SourceClockOffsetMs)
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
