package filter

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/api"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
)

var contractDir = filepath.Join("..", "..", "..", "..", "packages", "ingest-contract")

func TestSportpassVectorsFromPython(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join(contractDir, "test-vectors", "sportpass-v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Salt    string `json:"salt"`
		Vectors []struct {
			Input string `json:"input"`
			Hash  string `json:"hash"`
		} `json:"vectors"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	if len(file.Vectors) < 4 {
		t.Fatalf("nur %d Vektoren", len(file.Vectors))
	}
	for _, v := range file.Vectors {
		if got := SportpassHash(file.Salt, v.Input); got != v.Hash {
			t.Errorf("%s: %s statt %s", v.Input, got, v.Hash)
		}
	}
	for _, bad := range []string{"", "0", "000", "-5", "12a", " 12"} {
		if SportpassHash(file.Salt, bad) != "" {
			t.Errorf("%q gilt als SportpassID", bad)
		}
	}
}

const salt = "0f1e2d3c4b5a69788796a5b4c3d2e1f0"

func text(s string) *string { return &s }

func snapshot(id int32, sportpass string, modes []string, stamps []string) contract.Snapshot {
	treffer := contract.Table{Columns: map[string]string{"Wertung": "int(11)", "Zeitstempel": "datetime"}, Rows: []contract.Row{}}
	for i, m := range modes {
		treffer.Rows = append(treffer.Rows, contract.Row{"Wertung": text(m), "Zeitstempel": text(stamps[i])})
	}
	return contract.Snapshot{
		ScheibenID: id,
		ObservedAt: "2026-10-13T18:00:00.000Z",
		Data: contract.Data{
			Scheiben: contract.Table{Columns: map[string]string{"SportpassID": "bigint(20)"}, Rows: []contract.Row{{"SportpassID": text(sportpass)}}},
			Treffer:  treffer,
		},
	}
}

func rules(blocked ...api.Blocked) *Rules {
	var state api.State
	state.Sportpass.Salt = salt
	state.Sportpass.Hashes = []string{SportpassHash(salt, "12345678")}
	state.Blocked = blocked
	return NewRules(state)
}

func TestDecide(t *testing.T) {
	stamp := []string{"2026-10-13 20:00:00", "2026-10-13 20:01:00"}
	r := rules(api.Blocked{ScheibenID: 9, StartedAt: time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)})
	cases := []struct {
		name string
		s    contract.Snapshot
		want Decision
	}{
		{"mit Zustimmung", snapshot(1, "12345678", []string{"1", "1"}, stamp), Decision{Send: true}},
		{"führende Nullen wie in Spiegel", snapshot(1, "0012345678", []string{"1"}, stamp), Decision{Send: true}},
		{"ohne Zustimmung", snapshot(1, "87654321", []string{"1"}, stamp), Decision{Reason: NoConsent}},
		{"ohne Sportpass (SF-13)", snapshot(1, "0", []string{"1"}, stamp), Decision{Reason: NoConsent}},
		{"verdeckt 5 ab dem ersten Schuss (SF-19)", snapshot(1, "12345678", []string{"1", "5"}, stamp), Decision{Reason: Hidden, Mode: 5}},
		{"verdeckt 10", snapshot(1, "12345678", []string{"10"}, stamp), Decision{Reason: Hidden, Mode: 10}},
		{"Modus 0 ohne Freigabe (SF-20)", snapshot(1, "12345678", []string{"0"}, stamp), Decision{Reason: Hidden, Mode: 0}},
		{"Wertung unlesbar", snapshot(1, "12345678", []string{"x"}, stamp), Decision{Reason: Hidden, Mode: UnreadableMode}},
		{"Wertung mit Plus wie in Spiegel unlesbar", snapshot(1, "12345678", []string{"+3"}, stamp), Decision{Reason: Hidden, Mode: UnreadableMode}},
		{"Wertung über 2^53", snapshot(1, "12345678", []string{"9007199254740993"}, stamp), Decision{Reason: Hidden, Mode: UnreadableMode}},
		{"gesperrt (SF-28)", snapshot(9, "12345678", []string{"1"}, stamp), Decision{Reason: Blocked}},
		{"dieselbe ID 49 Tage später (SF-77)", snapshot(9, "12345678", []string{"1"}, []string{"2026-12-01 20:00:00"}), Decision{Send: true}},
		{"gesperrt, ohne Schusszeit die Beobachtung", snapshot(9, "12345678", []string{"1"}, []string{"0000-00-00 00:00:00"}), Decision{Reason: Blocked}},
	}
	for _, c := range cases {
		if got := r.Decide(c.s); got != c.want {
			t.Errorf("%s: %+v statt %+v", c.name, got, c.want)
		}
	}
}

func TestStartHintIgnoresClockJump(t *testing.T) {
	// eine Uhr, die 2009 zeigte (SF-30), verschiebt den Beginn nicht
	s := snapshot(9, "12345678", []string{"1", "1", "1"}, []string{"2009-01-01 00:00:00", "2026-12-01 20:00:00", "2026-12-01 20:05:00"})
	if got := startHint(s); !got.Equal(time.Date(2026, 12, 1, 20, 0, 0, 0, time.UTC)) {
		t.Fatalf("%v", got)
	}
}

func TestBlockedOnlyInItsEpoch(t *testing.T) {
	one, two := 1, 2
	at := time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)
	stamp := []string{"2026-10-13 20:00:00"}
	r := rules(api.Blocked{ScheibenID: 9, StartedAt: at, Epoch: &one}, api.Blocked{ScheibenID: 8, StartedAt: at})
	s := snapshot(9, "12345678", []string{"1"}, stamp)
	s.Epoch = 2
	if got := r.Decide(s); !got.Send {
		t.Fatalf("Sperre der Epoche 1 gilt nicht in Epoche 2 (SF-23): %+v", got)
	}
	s.Epoch = 1
	if got := r.Decide(s); got.Reason != Blocked {
		t.Fatalf("in ihrer Epoche: %+v", got)
	}
	// ohne Epoche (älterer Spiegel) gilt die Sperre in jeder
	s = snapshot(8, "12345678", []string{"1"}, stamp)
	s.Epoch = two
	if got := r.Decide(s); got.Reason != Blocked {
		t.Fatalf("ohne Epoche: %+v", got)
	}
}

func TestRequestedCardCountsAsConsentOnly(t *testing.T) {
	stamp := []string{"2026-10-13 20:00:00"}
	var state api.State
	state.Sportpass.Salt = salt
	state.Blocked = []api.Blocked{{ScheibenID: 9, StartedAt: time.Date(2026, 10, 13, 20, 0, 0, 0, time.UTC)}}
	state.Requests = []api.CardRequest{{ID: 1, ScheibenID: 7}, {ID: 2, ScheibenID: 8}, {ID: 3, ScheibenID: 9}}
	r := NewRules(state)
	cases := []struct {
		name string
		s    contract.Snapshot
		want Decision
	}{
		{"angefragt, ohne Zustimmung", snapshot(7, "87654321", []string{"1"}, stamp), Decision{Send: true}},
		{"angefragt, ohne Sportpass", snapshot(7, "0", []string{"1"}, stamp), Decision{Send: true}},
		{"nicht angefragt, ohne Zustimmung", snapshot(6, "87654321", []string{"1"}, stamp), Decision{Reason: NoConsent}},
		{"angefragt, verdeckt (SF-19)", snapshot(8, "87654321", []string{"5"}, stamp), Decision{Reason: Hidden, Mode: 5}},
		{"angefragt, gesperrt", snapshot(9, "87654321", []string{"1"}, stamp), Decision{Reason: Blocked}},
	}
	for _, c := range cases {
		if got := r.Decide(c.s); got != c.want {
			t.Errorf("%s: %+v statt %+v", c.name, got, c.want)
		}
	}
}
