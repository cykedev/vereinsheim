// Package filter entscheidet, welche Scheibe das Schützenhaus verlässt (SP-1.5, ADR-027: Datensparsamkeit am Rand). Die
// Regeln sind die, nach denen Spiegel ohnehin verwirft (apps/spiegel/src/lib/ingest/ingest.ts und meyton-ssmdb2.ts):
// Zustimmung, verdeckt, gesperrt. So verlässt nichts das Gerät, was Spiegel nicht nehmen darf.
package filter

import (
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"regexp"
	"strconv"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/api"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
)

// Gründe, eine Scheibe nicht zu schicken; die Codes von Spiegel (`DISCARD_REASONS`).
const (
	NoConsent = "no-consent"
	Hidden    = "hidden"
	Blocked   = "blocked"
)

// HeldDisplayModes: am Monitor verdeckt (5, 10) oder unbekannt (0); verlassen die Anlage nicht ohne Freigabe (SF-19,
// SF-20). Wie `HELD_DISPLAY_MODES` in Spiegel.
var HeldDisplayModes = map[int]bool{0: true, 5: true, 10: true}

// UnreadableMode steht für eine `Wertung`, die keine Zahl ist; im Heartbeat als 0 (unbekannt) gezählt.
const UnreadableMode = 0

// so weit um den Beginn der Scheibe gilt eine Sperre derselben ScheibenID (`BLOCK_WINDOW_MS` in Spiegel); die ID kehrt
// nach rund 49,7 Tagen wieder (SF-77)
const blockWindow = 30 * 24 * time.Hour

var digits = regexp.MustCompile(`^\d+$`)

// SportpassHash ist der Hash der Zustimmungsliste: SHA-256 (Hex, klein) über
// `spiegel-sportpass-v1:<salt>:<SportpassID dezimal ohne führende Nullen>`; leer, wenn die ID keine positive Zahl ist.
func SportpassHash(salt, sportpassID string) string {
	if !digits.MatchString(sportpassID) {
		return ""
	}
	id, ok := new(big.Int).SetString(sportpassID, 10)
	if !ok || id.Sign() <= 0 {
		return ""
	}
	sum := sha256.Sum256([]byte("spiegel-sportpass-v1:" + salt + ":" + id.String()))
	return hex.EncodeToString(sum[:])
}

// Decision sagt, ob eine Scheibe hinausgeht, und wenn nicht, warum.
type Decision struct {
	Send   bool
	Reason string
	// bei `hidden`: die Anzeigeart des ersten zurückhaltenden Schusses (Heartbeat `heldBack`)
	Mode int
}

// Rules sind der Zustand aus Spiegel, für schnelle Prüfung vorbereitet.
type Rules struct {
	salt    string
	consent map[string]bool
	blocked map[int32][]time.Time
}

// NewRules bereitet den Zustand vor.
func NewRules(state api.State) *Rules {
	r := &Rules{salt: state.Sportpass.Salt, consent: map[string]bool{}, blocked: map[int32][]time.Time{}}
	for _, h := range state.Sportpass.Hashes {
		r.consent[h] = true
	}
	for _, b := range state.Blocked {
		r.blocked[b.ScheibenID] = append(r.blocked[b.ScheibenID], b.StartedAt)
	}
	return r
}

func cell(row contract.Row, column string) string {
	if v := row[column]; v != nil {
		return *v
	}
	return ""
}

// Decide prüft in der Reihenfolge von Spiegel: Zustimmung, verdeckt, gesperrt.
func (r *Rules) Decide(s contract.Snapshot) Decision {
	if len(s.Data.Scheiben.Rows) != 1 {
		return Decision{Reason: NoConsent}
	}
	hash := SportpassHash(r.salt, cell(s.Data.Scheiben.Rows[0], "SportpassID"))
	if hash == "" || !r.consent[hash] {
		return Decision{Reason: NoConsent}
	}
	for _, row := range s.Data.Treffer.Rows {
		mode, err := strconv.Atoi(cell(row, "Wertung"))
		if err != nil {
			return Decision{Reason: Hidden, Mode: UnreadableMode}
		}
		if HeldDisplayModes[mode] {
			return Decision{Reason: Hidden, Mode: mode}
		}
	}
	if starts := r.blocked[s.ScheibenID]; len(starts) > 0 {
		at := startHint(s)
		for _, started := range starts {
			if d := started.Sub(at); d <= blockWindow && d >= -blockWindow {
				return Decision{Reason: Blocked}
			}
		}
	}
	return Decision{Send: true}
}

// startHint ist der Beginn der Scheibe, grob wie `startHintMs` in Spiegel: der früheste plausible Schuss als Ortszeit
// (± die Zone), nur Zeiten bis einen Tag vor dem letzten (eine Uhr, die 2009 zeigte, verschöbe sonst alles, SF-30);
// ohne Schuss die Beobachtung.
func startHint(s contract.Snapshot) time.Time {
	floor := time.Date(1971, 1, 1, 0, 0, 0, 0, time.UTC)
	var times []time.Time
	for _, row := range s.Data.Treffer.Rows {
		t, err := time.Parse("2006-01-02 15:04:05", cell(row, "Zeitstempel"))
		if err == nil && t.After(floor) {
			times = append(times, t)
		}
	}
	if len(times) == 0 {
		t, _ := time.Parse(time.RFC3339Nano, s.ObservedAt)
		return t
	}
	last := times[0]
	for _, t := range times {
		if t.After(last) {
			last = t
		}
	}
	first := last
	for _, t := range times {
		if last.Sub(t) <= 24*time.Hour && t.Before(first) {
			first = t
		}
	}
	return first
}
