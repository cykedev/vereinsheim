package watch

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
)

// memory ist eine Ablage im Speicher: je Scheibe Lebenszeichen und Daten.
type memory struct {
	stamps map[int32]string
	data   map[int32]contract.Data
	fail   error
	reads  [][]int32
}

func newMemory() *memory {
	return &memory{stamps: map[int32]string{}, data: map[int32]contract.Data{}}
}

func (m *memory) put(id int32, stamp string, shots int, value string) {
	m.stamps[id] = stamp
	m.data[id] = cardData(id, shots, value)
}

func (m *memory) Round(_ context.Context, choose func([]Lifesign) []int32) (Round, error) {
	var lifesigns []Lifesign
	for id, stamp := range m.stamps {
		lifesigns = append(lifesigns, Lifesign{ID: id, Stamp: stamp})
	}
	ids := choose(lifesigns)
	m.reads = append(m.reads, ids)
	// die Abfrage der Zeilen scheitert erst nach der Wahl, mitten in der Runde
	if m.fail != nil {
		return Round{}, m.fail
	}
	cards := map[int32]contract.Data{}
	for _, id := range ids {
		cards[id] = m.data[id]
	}
	version := "9"
	return Round{Lifesigns: lifesigns, Cards: cards, SourceVersion: &version, SessionTimeZone: "+00:00"}, nil
}

func text(s string) *string { return &s }

func cardData(id int32, shots int, value string) contract.Data {
	sid := fmt.Sprint(id)
	treffer := contract.Table{
		Columns: map[string]string{"ScheibenID": "int(11)", "Treffer": "smallint(6)", "Ring01": "int(11)"},
		Rows:    []contract.Row{},
	}
	for i := 1; i <= shots; i++ {
		treffer.Rows = append(treffer.Rows, contract.Row{"ScheibenID": text(sid), "Treffer": text(fmt.Sprint(i)), "Ring01": text(value)})
	}
	return contract.Data{
		Scheiben: contract.Table{
			Columns: map[string]string{"ScheibenID": "int(11)", "Nachname": "varchar(36)"},
			Rows:    []contract.Row{{"ScheibenID": text(sid), "Nachname": text("Muster")}},
		},
		Serien:  contract.Table{Columns: map[string]string{"ScheibenID": "int(11)"}, Rows: []contract.Row{}},
		Treffer: treffer,
	}
}

type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }
func start() *clock                      { return &clock{time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)} }
func tick(t *testing.T, w *Watcher, m *memory) Result {
	t.Helper()
	r, err := w.Tick(context.Background(), m)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func ids(r Result) []int32 {
	var out []int32
	for _, s := range r.Snapshots {
		out = append(out, s.ScheibenID)
	}
	return out
}

func TestTwoEqualReadingsThenNothingNew(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	if r := tick(t, w, m); len(r.Snapshots) != 0 {
		t.Fatal("eine Lesung allein geht nicht hinaus (SF-71)")
	}
	c.advance(time.Second)
	r := tick(t, w, m)
	if len(r.Snapshots) != 1 {
		t.Fatalf("nach zwei gleichen Lesungen: %d Snapshots", len(r.Snapshots))
	}
	s := r.Snapshots[0]
	if err := contract.Validate(s); err != nil {
		t.Fatal(err)
	}
	if s.Epoch != 1 || s.Sequence != c.t.UnixMilli() || s.ObservedAt != "2026-10-13T18:00:01.000Z" || *s.SourceVersion != "9" {
		t.Fatalf("Hülle %+v", s)
	}
	for range 3 {
		c.advance(time.Second)
		if r := tick(t, w, m); len(r.Snapshots) != 0 {
			t.Fatal("unveränderter Stand geht nicht erneut hinaus")
		}
	}
}

func TestTornReadingIsNotSentAndOldStateNotResent(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 40, "100")
	tick(t, w, m)
	c.advance(time.Second)
	if len(tick(t, w, m).Snapshots) != 1 {
		t.Fatal("40 Schuss")
	}
	// zerrissen: Kopfzeile ohne Treffer, einmal gesehen; dann wieder ganz
	m.data[7] = cardData(7, 3, "100")
	c.advance(time.Second)
	if len(tick(t, w, m).Snapshots) != 0 {
		t.Fatal("flüchtig")
	}
	m.data[7] = cardData(7, 40, "100")
	for range 2 {
		c.advance(time.Second)
		if len(tick(t, w, m).Snapshots) != 0 {
			t.Fatal("der alte Stand ist nichts Neues")
		}
	}
}

func TestWithoutHitsNever(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 0, "0")
	for range 3 {
		if r := tick(t, w, m); len(r.Snapshots) != 0 || r.Busy && len(m.reads) > 2 && !r.Busy {
			t.Fatal("ohne Treffer nie (SF-13)")
		}
		c.advance(time.Second)
	}
}

func TestCorrectionWithoutLifesignWhileActive(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 20, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	// Korrektur durch die Standaufsicht: anderer Wert, dasselbe Lebenszeichen (SF-21)
	c.advance(5 * time.Minute)
	m.data[7] = cardData(7, 20, "95")
	tick(t, w, m)
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 1 {
		t.Fatalf("Korrektur innerhalb von 20 Minuten: %v", got)
	}
	// später ruht die Scheibe: Ohne Lebenszeichen liest die Brücke sie nicht mehr (den Abgleich bringt Teil c)
	c.advance(25 * time.Minute)
	m.data[7] = cardData(7, 20, "90")
	tick(t, w, m)
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 0 {
		t.Fatalf("ruhende Scheibe: %v", got)
	}
	if last := m.reads[len(m.reads)-1]; len(last) != 0 {
		t.Fatalf("ruhende Scheibe gelesen: %v", last)
	}
}

func TestStartWindowFromNewestLifesign(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	// die Uhr der Stände geht eine Woche vor: gemessen wird am jüngsten Lebenszeichen, nicht an der eigenen Uhr
	m.put(1, "2026-10-20 18:00:00", 5, "100")
	m.put(2, "2026-10-20 07:00:00", 5, "100")
	m.put(3, "2026-10-20 05:59:59", 5, "100")
	tick(t, w, m)
	if got := m.reads[0]; len(got) != 2 || got[0] != 1 || got[1] != 2 {
		t.Fatalf("Startfenster 12 h: %v", got)
	}
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 2 {
		t.Fatalf("beide im Fenster: %v", got)
	}
	// die alte Scheibe bewegt sich wieder: jetzt ist sie dabei
	m.stamps[3] = "2026-10-20 18:00:05"
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 1 || got[0] != 3 {
		t.Fatalf("nach Bewegung: %v", got)
	}
}

func TestFailedRoundChangesNothing(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	tick(t, w, m)
	m.fail = errors.New("Verbindung weg")
	c.advance(time.Second)
	if _, err := w.Tick(context.Background(), m); err == nil {
		t.Fatal("Fehler erwartet")
	}
	m.fail = nil
	// die gescheiterte Runde zählt nicht als Lesung, die gelungene davor schon: jetzt sind es zwei gleiche
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 1 {
		t.Fatalf("%v", got)
	}
}

func TestMissingIsNoDeletion(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	// eine Runde ohne die Scheibe (beschädigte Tabelle, SF-24), dann ist sie wieder da
	stamp, data := m.stamps[7], m.data[7]
	delete(m.stamps, 7)
	c.advance(time.Second)
	if r := tick(t, w, m); len(r.Snapshots) != 0 {
		t.Fatal("Fehlen meldet nichts")
	}
	m.stamps[7], m.data[7] = stamp, data
	for range 2 {
		c.advance(time.Second)
		if got := ids(tick(t, w, m)); len(got) != 0 {
			t.Fatalf("derselbe Stand erneut: %v", got)
		}
	}
	// nach einem Tag ohne Kontakt ist sie vergessen; kommt sie wieder, gilt sie als neu
	delete(m.stamps, 7)
	c.advance(25 * time.Hour)
	tick(t, w, m)
	m.stamps[7] = stamp
	tick(t, w, m)
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 1 {
		t.Fatalf("vergessen und neu: %v", got)
	}
}

func TestBudgetWaitingFirstThenNewest(t *testing.T) {
	m, c := newMemory(), start()
	cfg := Defaults
	cfg.MaxCards = 3
	w := New(cfg, c.now)
	for i := int32(1); i <= 5; i++ {
		m.put(i, fmt.Sprintf("2026-10-13 18:00:0%d", i), 1, "100")
	}
	tick(t, w, m)
	if got := m.reads[0]; fmt.Sprint(got) != "[5 4 3]" {
		t.Fatalf("die jüngsten zuerst: %v", got)
	}
	c.advance(time.Second)
	tick(t, w, m)
	// 5, 4, 3 sind gemeldet; 1 und 2 kommen jetzt dran
	if got := m.reads[1]; fmt.Sprint(got) != "[5 4 3]" {
		t.Fatalf("wartende zuerst: %v", got)
	}
	c.advance(time.Second)
	tick(t, w, m)
	if got := m.reads[2]; !strings.Contains(fmt.Sprint(got), "2") || !strings.Contains(fmt.Sprint(got), "1") {
		t.Fatalf("der Rest folgt: %v", got)
	}
}

func TestSequenceStrictlyIncreasing(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 1, "100")
	tick(t, w, m)
	c.advance(time.Second)
	first := tick(t, w, m).Snapshots[0].Sequence
	// die Uhr der Brücke springt zurück (NTP)
	c.advance(-time.Hour)
	m.put(7, "2026-10-13 18:00:05", 2, "100")
	tick(t, w, m)
	second := tick(t, w, m).Snapshots[0].Sequence
	if second <= first {
		t.Fatalf("Folgenummer %d nach %d (SF-26)", second, first)
	}
}

func TestInvalidCardSkippedWithoutContent(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 1, "100")
	bad := m.data[7]
	bad.Scheiben.Rows[0]["Nachname"] = text(string([]byte{'M', 0xff}))
	m.data[7] = bad
	r := tick(t, w, m)
	if len(r.Skipped) != 1 || r.Skipped[0].Code != "malformed-string" || r.Skipped[0].ID != 7 {
		t.Fatalf("%+v", r.Skipped)
	}
	c.advance(time.Second)
	if r := tick(t, w, m); len(r.Snapshots) != 0 {
		t.Fatal("ungültige Bytes gehen nie hinaus")
	}
}
