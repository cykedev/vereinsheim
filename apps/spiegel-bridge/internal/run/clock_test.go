package run

import (
	"encoding/json"
	"errors"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/api"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
)

// Uhr der Brücke falsch (SF-79): Ein Pi ohne Echtzeituhr startet mit der Uhr vom letzten Abend (fake-hwclock), bis NTP
// antwortet. Ohne Prüfung schickte die Brücke Stände und Heartbeat mit der alten Zeit und meldete die eigene Verspätung
// als Abweichung der Anlage.

func (f *fixture) logged(code string) bool {
	return slices.ContainsFunc(f.logs, func(l string) bool { return strings.HasPrefix(l, code) })
}

func TestClockBehindHolds(t *testing.T) {
	f := setup(t, "12345678")
	// die Brücke mit der Uhr vom letzten Abend; Spiegel und die Anlage 45 h später, richtig
	f.clock = time.Date(2026, 10, 13, 22, 0, 0, 0, time.UTC)
	f.runner.started = f.clock
	f.serverAhead = 45 * time.Hour
	f.ablage.now = text("2026-10-15 19:00:00.000")
	f.ablage.put(1, "12345678", "1", 3)
	for range 3 {
		f.step()
	}
	f.clock = f.clock.Add(HeartbeatEvery)
	f.step()
	if len(f.sp.batches) != 0 {
		t.Fatalf("mit falscher Uhr geschickt: %v", f.sp.sent())
	}
	// der erste misst erst: ungeprüft „ok“; danach „clock“; nie die eigene Verspätung als Abweichung der Anlage
	for i, hb := range f.sp.heartbeats {
		want := StatusClock
		if i == 0 {
			want = StatusOK
		}
		if len(f.sp.heartbeats) < 2 || hb.Status != want || hb.SourceClockOffsetMs != nil {
			t.Fatalf("Heartbeat %d von %d: %+v", i, len(f.sp.heartbeats), hb)
		}
	}
	if !slices.Contains(f.logs, "clock-wrongseconds-162000") {
		t.Fatalf("Log %v", f.logs)
	}

	// NTP: Die Uhr springt vor. Der nächste Heartbeat misst richtig, danach geht der Stand mit der Zeit von jetzt hinaus.
	f.clock = f.clock.Add(45 * time.Hour)
	f.serverAhead = 0
	f.ablage.now = text(f.clock.Format("2006-01-02 15:04:05.000"))
	f.step()
	if !f.logged("clock-ok") || len(f.sp.batches) != 0 {
		t.Fatalf("Log %v, Stapel %d", f.logs, len(f.sp.batches))
	}
	f.step()
	if len(f.sp.batches) != 1 {
		t.Fatalf("nach NTP nicht geschickt: %d Stapel", len(f.sp.batches))
	}
	s := f.sp.batches[0][0]
	if s.ObservedAt[:10] != "2026-10-15" || s.Sequence < f.clock.Add(-time.Minute).UnixMilli() {
		t.Fatalf("observedAt %s, sequence %d", s.ObservedAt, s.Sequence)
	}
	f.clock = f.clock.Add(HeartbeatEvery)
	f.ablage.now = text(f.clock.Format("2006-01-02 15:04:05.000"))
	f.step()
	last := f.sp.heartbeats[len(f.sp.heartbeats)-1]
	if last.Status != StatusOK || last.SourceClockOffsetMs == nil || *last.SourceClockOffsetMs > 1000 || *last.SourceClockOffsetMs < -1000 {
		t.Fatalf("nach NTP: %+v", last)
	}
}

func TestClockAheadHolds(t *testing.T) {
	f := setup(t, "12345678")
	// die Brücke geht fünf Minuten vor: Spiegel nähme die Folgenummer noch an, die Scheibe verschöbe sich trotzdem
	f.serverAhead = -5 * time.Minute
	f.ablage.put(1, "12345678", "1", 3)
	f.runFor(3 * time.Minute)
	if len(f.sp.batches) != 0 || f.logged("future") {
		t.Fatalf("geschickt %v, Log %v", f.sp.sent(), f.logs)
	}
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.Status != StatusClock {
		t.Fatalf("Status %s", hb.Status)
	}
	if !slices.Contains(f.logs, "clock-wrongseconds300") {
		t.Fatalf("Log %v", f.logs)
	}
	// NTP stellt sie zurück: Die Folgenummer kommt von der Uhr von jetzt, nicht aus der Zeit, als sie vorging
	f.clock = f.clock.Add(-5 * time.Minute)
	f.serverAhead = 0
	// im Betrieb misst Go den Abstand zum letzten Heartbeat monoton; die Uhr des Tests hat keinen monotonen Teil und sähe
	// ihn fünf Minuten „voraus“. Deshalb wie im Betrieb: der nächste Heartbeat ist fällig
	f.runner.lastHeartbeat = f.clock.Add(-HeartbeatEvery)
	f.step()
	f.step()
	if len(f.sp.batches) != 1 || f.sp.batches[0][0].Sequence > f.clock.UnixMilli() {
		t.Fatalf("Stapel %d, Folgenummer nach der Uhr %v", len(f.sp.batches), f.sp.sent())
	}
}

func TestClockUncheckedWithoutHeartbeatAnswer(t *testing.T) {
	f := setup(t, "12345678")
	f.sp.hbErr = &api.Error{Code: "network"}
	f.ablage.put(1, "12345678", "1", 3)
	f.runFor(3 * time.Minute)
	if len(f.sp.batches) != 0 {
		t.Fatalf("ohne geprüfte Uhr geschickt: %v", f.sp.sent())
	}
	// ungeprüft ist nicht falsch: kein „clock“
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.Status != StatusOK {
		t.Fatalf("Status %s", hb.Status)
	}
	f.sp.hbErr = nil
	f.runFor(2 * time.Minute)
	if len(f.sp.batches) != 1 {
		t.Fatalf("nach der ersten Messung: %d Stapel", len(f.sp.batches))
	}
}

// Die Umlaufzeit macht eine Messung unsicher, nicht ungültig: Stimmt die Uhr auch im ungünstigsten Fall,
// gilt sie; geht sie auch im günstigsten falsch, gilt sie als falsch; dazwischen bleibt sie ungemessen.
func TestClockUncertainRoundTrip(t *testing.T) {
	f := setup(t, "12345678")
	// 20 s nach, 30 s Umlauf: 20 + 15 > 30 und 20 − 15 ≤ 30, also nicht entschieden
	f.serverAhead = 20 * time.Second
	f.sp.hbTakes = 30 * time.Second
	f.ablage.put(1, "12345678", "1", 3)
	f.runFor(3 * time.Minute)
	if len(f.sp.batches) != 0 || !f.logged("clock-unmeasured") || f.sp.heartbeats[len(f.sp.heartbeats)-1].Status != StatusOK {
		t.Fatalf("Stapel %d, Log %v", len(f.sp.batches), f.logs)
	}
	// eine langsame Leitung mit richtiger Uhr: 0 + 20 ≤ 30, die Brücke schickt (eine harte Grenze der Umlaufzeit hielte sie für immer)
	f.serverAhead = 0
	f.sp.hbTakes = 40 * time.Second
	f.runFor(3 * time.Minute)
	if len(f.sp.batches) != 1 {
		t.Fatalf("langsame Leitung, richtige Uhr: %d Stapel", len(f.sp.batches))
	}
}

// Gemessen wird gegen die Mitte zwischen Senden und Antwort: 25 s nach, 10 s Umlauf ergibt genau
// die Schwelle; gegen den Zeitpunkt des Sendens wären es 30 + 5 s, nicht entschieden.
func TestClockMeasuredAtTheMidpoint(t *testing.T) {
	f := setup(t, "12345678")
	f.serverAhead = 25 * time.Second
	f.sp.hbTakes = 10 * time.Second
	f.ablage.put(1, "12345678", "1", 3)
	f.runFor(3 * time.Minute)
	if len(f.sp.batches) != 1 {
		t.Fatalf("an der Schwelle: %d Stapel, Log %v", len(f.sp.batches), f.logs)
	}
}

// Im Halten bleibt der Takt ruhig: Ohne die Dehnung hielt jeder wartende Stand die Brücke im Sekundentakt,
// und sie las bis zu 50 ganze Scheiben je Sekunde, solange die Uhr falsch geht.
func TestHoldKeepsTheQuietCadence(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.reads = map[int32]int{}
	f.serverAhead = 45 * time.Hour
	for id := int32(1); id <= 60; id++ {
		f.ablage.put(id, "12345678", "1", 3)
	}
	steps := 0
	for end := f.clock.Add(10 * time.Minute); f.clock.Before(end); steps++ {
		f.step()
	}
	reads := 0
	for _, n := range f.ablage.reads {
		reads += n
	}
	// 10 min im Takt von 30 s, dazu die ersten Runden vor der ersten Messung
	if steps > 25 || reads > 25*BatchSnapshots || len(f.sp.batches) != 0 {
		t.Fatalf("%d Runden, %d Lesungen, %d Stapel", steps, reads, len(f.sp.batches))
	}
}

// `sentAt` ist der Zeitpunkt des Sendens, nicht der Beginn der Runde: Spiegel prüft daran die Uhr der Brücke.
func TestHeartbeatSentAtIsTheSendTime(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.step()
	// der nächste Heartbeat ist fällig, der Stapel davor dauert 50 s
	f.clock = f.clock.Add(HeartbeatEvery)
	f.sp.snapTakes = 50 * time.Second
	f.step()
	hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]
	if len(f.sp.batches) != 1 || hb.SentAt != contract.ObservedAt(f.clock.Add(-BusyEvery).UnixMilli()) {
		t.Fatalf("sentAt %s, Uhr beim Senden %s", hb.SentAt, contract.ObservedAt(f.clock.Add(-BusyEvery).UnixMilli()))
	}
}

// Ein älterer Spiegel kennt `clock` nicht und lehnt den Heartbeat ab: Die Brücke meldet dann ungeprüft und
// misst beim nächsten Mal, statt für immer zu halten.
func TestRejectedClockHeartbeatChecksAgain(t *testing.T) {
	f := setup(t, "12345678")
	f.sp.hbCheck = func(hb api.Heartbeat) error {
		if hb.Status == StatusClock {
			return &api.Error{Status: 400, Code: "invalid"}
		}
		return nil
	}
	f.serverAhead = 45 * time.Hour
	f.ablage.put(1, "12345678", "1", 3)
	f.runFor(3 * time.Minute)
	if len(f.sp.batches) != 0 || !f.logged("clock-wrong") {
		t.Fatalf("Stapel %d, Log %v", len(f.sp.batches), f.logs)
	}
	// NTP stellt die Uhr; der nächste Heartbeat geht als „ok“ durch und misst
	f.clock = f.clock.Add(45 * time.Hour)
	f.serverAhead = 0
	f.runFor(3 * time.Minute)
	if len(f.sp.batches) != 1 {
		t.Fatalf("nach NTP: %d Stapel, Log %v", len(f.sp.batches), f.logs)
	}
}

// Eine Abweichung der Anlage, gemessen gegen die falsche Uhr, geht auch nach der Freigabe nicht hinaus: Scheitern die Runden danach, misst niemand neu.
func TestNoSourceOffsetFromTheWrongClock(t *testing.T) {
	f := setup(t, "12345678")
	f.clock = time.Date(2026, 10, 13, 22, 0, 0, 0, time.UTC)
	f.serverAhead = 45 * time.Hour
	f.ablage.now = text("2026-10-15 19:00:00.000")
	f.step()
	f.ablage.fail = errors.New("table is marked as crashed")
	f.clock = f.clock.Add(45 * time.Hour)
	f.serverAhead = 0
	f.runFor(3 * time.Minute)
	if !f.logged("clock-ok") {
		t.Fatalf("Log %v", f.logs)
	}
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.SourceClockOffsetMs != nil {
		t.Fatalf("Abweichung aus der Zeit der falschen Uhr: %d", *hb.SourceClockOffsetMs)
	}
}

func TestPastFromSpiegelChecksTheClockAgain(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	answers := []string{"past"}
	f.sp.outcome = func(contract.Snapshot) string {
		if len(answers) == 0 {
			return "stored"
		}
		a := answers[0]
		answers = answers[1:]
		return a
	}
	f.step()
	if wait := f.step(); wait < FuturePause || len(f.sp.batches) != 1 || !f.logged("past") {
		t.Fatalf("Pause %v, Stapel %d, Log %v", wait, len(f.sp.batches), f.logs)
	}
	// nach der Pause ist die Uhr ungeprüft: In dieser Runde geht nichts hinaus, ihr Heartbeat misst neu
	f.step()
	if len(f.sp.batches) != 1 || f.runner.clock != clockOK {
		t.Fatalf("vor der neuen Messung: %d Stapel, Uhr %v", len(f.sp.batches), f.runner.clock)
	}
	// nicht bestätigt: Nach der Messung geht der Stand noch einmal hinaus, frisch gestempelt
	f.step()
	if len(f.sp.batches) != 2 || f.sp.batches[1][0].ScheibenID != 1 || f.sp.batches[1][0].Sequence <= f.sp.batches[0][0].Sequence {
		t.Fatalf("Stapel %v", f.sp.sent())
	}
}

// Beleg für die Grenze in Spiegel (`MAX_OBSERVED_LAG_MS`, 15 min): Nach `Retry-After` (bis 10 min) schickt die Brücke
// keinen alten Stand, sondern liest neu und stempelt neu.
func TestFreshObservationAfterRetryAfter(t *testing.T) {
	f := setup(t, "12345678")
	f.ablage.put(1, "12345678", "1", 3)
	f.sp.errs = []error{&api.Error{Status: 429, Code: "rate-limited", RetryAfter: api.MaxRetryAfter}}
	f.step()
	// die zweite Runde schickt, Spiegel bremst für zehn Minuten
	throttled := f.clock
	f.step()
	f.runFor(api.MaxRetryAfter + time.Minute)
	if len(f.sp.batches) != 1 {
		t.Fatalf("nach der Pause: %d Stapel", len(f.sp.batches))
	}
	observed, err := time.Parse(time.RFC3339Nano, f.sp.batches[0][0].ObservedAt)
	if err != nil || observed.Before(throttled.Add(api.MaxRetryAfter-time.Second)) {
		t.Fatalf("observedAt %s, Pause ab %s", f.sp.batches[0][0].ObservedAt, throttled)
	}
}

func TestDatabaseStatusBeforeClock(t *testing.T) {
	f := setup(t, "12345678")
	f.serverAhead = time.Hour
	f.ablage.fail = &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("refused")}
	f.runFor(2 * time.Minute)
	if hb := f.sp.heartbeats[len(f.sp.heartbeats)-1]; hb.Status != StatusDBUnreachable {
		t.Fatalf("Status %s", hb.Status)
	}
}

// Zustände und Schwelle wie im Vektor des Vertrags (packages/ingest-contract/test-vectors/api-v1.json).
func TestStatusesAndToleranceFromContractVector(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "packages", "ingest-contract", "test-vectors", "api-v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var vector struct {
		BridgeStatus           []string `json:"bridgeStatus"`
		BridgeClockToleranceMs int64    `json:"bridgeClockToleranceMs"`
	}
	if err := json.Unmarshal(raw, &vector); err != nil {
		t.Fatal(err)
	}
	for _, s := range Statuses {
		if !slices.Contains(vector.BridgeStatus, s) {
			t.Errorf("Status %s fehlt im Vertrag", s)
		}
	}
	if ClockTolerance.Milliseconds() != vector.BridgeClockToleranceMs {
		t.Fatalf("Schwelle %v, Vertrag %d ms", ClockTolerance, vector.BridgeClockToleranceMs)
	}
}
