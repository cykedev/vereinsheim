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
	now    *string // Uhr der Anlage (`NOW(3)`)
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

func (m *memory) Round(_ context.Context, choose func([]Lifesign, *string) []int32) (Round, error) {
	var lifesigns []Lifesign
	for id, stamp := range m.stamps {
		l := Lifesign{ID: id, Stamp: stamp}
		// die SportpassID der Zeile wie `readLifesigns`, als eigener Text: Die Erkennung behält ihn bis zur nächsten Runde
		if rows := m.data[id].Scheiben.Rows; len(rows) == 1 && rows[0]["SportpassID"] != nil {
			l.Sportpass = text(*rows[0]["SportpassID"])
		}
		lifesigns = append(lifesigns, l)
	}
	ids := choose(lifesigns, m.now)
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
	return Round{Lifesigns: lifesigns, Cards: cards, SourceVersion: &version, SessionTimeZone: "+00:00", SourceNow: m.now}, nil
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

// withSportpass gibt die Daten mit dieser SportpassID in `Scheiben` zurück; die Maps von `d` bleiben unverändert.
func withSportpass(d contract.Data, value string) contract.Data {
	columns := map[string]string{}
	for k, v := range d.Scheiben.Columns {
		columns[k] = v
	}
	columns["SportpassID"] = "bigint(20)"
	row := contract.Row{}
	for k, v := range d.Scheiben.Rows[0] {
		row[k] = v
	}
	row["SportpassID"] = text(value)
	d.Scheiben = contract.Table{Columns: columns, Rows: []contract.Row{row}}
	return d
}

type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }
func start() *clock                      { return &clock{time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)} }

// tick liest eine Runde, und Spiegel bestätigt jeden Snapshot (der Upload gelingt)
func tick(t *testing.T, w *Watcher, m *memory) Result {
	t.Helper()
	r := tickUndelivered(t, w, m)
	for _, s := range r.Snapshots {
		w.Delivered(s)
	}
	return r
}

// tickUndelivered liest eine Runde, ohne dass ein Upload gelingt
func tickUndelivered(t *testing.T, w *Watcher, m *memory) Result {
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
	// später ruht die Scheibe: Ohne Lebenszeichen liest die Brücke sie vorerst nicht mehr (den Abgleich im Leerlauf bringt
	// sie nach `ReconcileEvery`, TestReconcileReadsRestingCardsWhenIdle)
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

func TestSameText(t *testing.T) {
	for _, c := range []struct {
		a, b *string
		want bool
	}{
		{nil, nil, true},
		{nil, text("0"), false},
		{text("0"), nil, false},
		{text("12345678"), text("12345678"), true},
		{text("12345678"), text("87654321"), false},
	} {
		if got := sameText(c.a, c.b); got != c.want {
			t.Fatalf("sameText(%v, %v) = %v", c.a, c.b, got)
		}
	}
}

// Umbuchen in Meyton (SF-80): Name und SportpassID ändern sich, das Lebenszeichen womöglich nicht (offen, Schritt 12 des
// Schießprotokolls in [[meyton-ssmdb2]]). Die Brücke liest die ruhende Scheibe trotzdem neu und schickt sie nach zwei
// gleichen Lesungen.
func TestSportpassChangeWithoutLifesignIsRead(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.stamps[7] = "2026-10-13 18:00:00"
	m.data[7] = withSportpass(cardData(7, 20, "100"), "87654321")
	tick(t, w, m)
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 1 {
		t.Fatalf("erster Stand: %v", got)
	}
	c.advance(30 * time.Minute)
	tick(t, w, m)
	if last := m.reads[len(m.reads)-1]; len(last) != 0 {
		t.Fatalf("ruhende Scheibe gelesen: %v", last)
	}
	m.data[7] = withSportpass(cardData(7, 20, "100"), "12345678")
	c.advance(time.Minute)
	r := tick(t, w, m)
	if last := m.reads[len(m.reads)-1]; fmt.Sprint(last) != "[7]" {
		t.Fatalf("umgebuchte Scheibe nicht gelesen: %v", last)
	}
	if fmt.Sprint(r.Reassigned) != "[{7 false}]" || !r.Busy || len(r.Snapshots) != 0 {
		t.Fatalf("erste Lesung nach dem Umbuchen: umgebucht %v, busy %v, gesendet %v", r.Reassigned, r.Busy, ids(r))
	}
	c.advance(time.Second)
	r = tick(t, w, m)
	if len(r.Snapshots) != 1 || *r.Snapshots[0].Data.Scheiben.Rows[0]["SportpassID"] != "12345678" || len(r.Reassigned) != 0 {
		t.Fatalf("zweite Lesung: gesendet %v, umgebucht %v", ids(r), r.Reassigned)
	}
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 0 {
		t.Fatalf("danach: %v", got)
	}
	// noch einmal umgebucht, diesmal mit bewegtem Lebenszeichen: das Log sagt es
	m.stamps[7] = "2026-10-13 18:45:00"
	m.data[7] = withSportpass(cardData(7, 20, "100"), "87654321")
	c.advance(time.Second)
	if r := tick(t, w, m); fmt.Sprint(r.Reassigned) != "[{7 true}]" {
		t.Fatalf("mit Lebenszeichen: %v", r.Reassigned)
	}
}

// Mit neuer SportpassID zählt die zweite Lesung nicht zum Budget des Leerlaufs (hier ohne Budget), auch bei einer
// Scheibe, die sich in diesem Lauf nie bewegt hat (nachgeholt). Gemeldet wird der Wechsel einmal, nicht bei jedem
// Lebenszeichen eines anderen Stands.
func TestReassignedCardLeavesWhileShooting(t *testing.T) {
	m, c := newMemory(), start()
	cfg := Defaults
	cfg.IdleWhileLive = 0
	w := New(cfg, c.now)
	m.stamps[1] = "2026-10-09 21:00:00"
	m.data[1] = withSportpass(cardData(1, 40, "100"), "87654321")
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	w.SetCatchUpFrom("2026-10-08 22:00:00")
	tick(t, w, m)
	// Stand 9 ruht: Scheibe 1 kommt über das Nachholen
	c.advance(25 * time.Minute)
	sent := map[int32]bool{}
	for range 3 {
		for _, id := range ids(tick(t, w, m)) {
			sent[id] = true
		}
		c.advance(time.Second)
	}
	if !sent[1] {
		t.Fatalf("nachgeholt: %v", sent)
	}
	// Stand 9 schießt wieder, und Scheibe 1 wird umgebucht
	m.data[1] = withSportpass(cardData(1, 40, "100"), "12345678")
	sent = map[int32]bool{}
	var reassigned []string
	for range 3 {
		m.stamps[9] = c.t.Add(2 * time.Hour).Format(stampLayout)
		r := tick(t, w, m)
		for _, id := range ids(r) {
			sent[id] = true
		}
		reassigned = append(reassigned, fmt.Sprint(r.Reassigned))
		c.advance(time.Second)
	}
	if !sent[1] {
		t.Fatalf("umgebucht, während geschossen wird: %v", m.reads[len(m.reads)-3:])
	}
	if fmt.Sprint(reassigned) != "[[{1 false}] [] []]" {
		t.Fatalf("gemeldet je Runde: %v", reassigned)
	}
}

// Die neue SportpassID gilt nur für ihren eigenen Stand: Ein späterer wartender Stand derselben Scheibe, die sich in
// diesem Lauf nie bewegt hat, zählt wieder zum Budget des Leerlaufs, hinter den laufenden Scheiben.
func TestReassignedOnlyForItsOwnStand(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.stamps[1] = "2026-10-09 21:00:00"
	m.data[1] = withSportpass(cardData(1, 40, "100"), "87654321")
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	w.SetCatchUpFrom("2026-10-08 22:00:00")
	tick(t, w, m)
	// Stand 9 ruht: Scheibe 1 kommt über das Nachholen, dann umgebucht
	c.advance(25 * time.Minute)
	for range 3 {
		tick(t, w, m)
		c.advance(time.Second)
	}
	m.data[1] = withSportpass(cardData(1, 40, "100"), "12345678")
	sent := false
	for range 3 {
		sent = sent || fmt.Sprint(ids(tick(t, w, m))) == "[1]"
		c.advance(time.Second)
	}
	if !sent {
		t.Fatal("umgebucht nicht gesendet")
	}
	// eine Stunde später findet der Abgleich eine Korrektur, ihr Stand wartet auf die zweite Lesung
	c.advance(time.Hour)
	m.data[1] = withSportpass(cardData(1, 40, "95"), "12345678")
	tick(t, w, m)
	c.advance(time.Second)
	// Stand 9 schießt wieder: Der wartende Stand von 1 kommt hinter 9, nicht als Umbuchung vor allen
	from := len(m.reads)
	sent = false
	for range 3 {
		m.stamps[9] = c.t.Add(2 * time.Hour).Format(stampLayout)
		for _, id := range ids(tick(t, w, m)) {
			sent = sent || id == 1
		}
		c.advance(time.Second)
	}
	for _, read := range m.reads[from:] {
		for i, id := range read {
			if id == 1 && (i == 0 || read[0] != 9) {
				t.Fatalf("wartender Stand vor dem laufenden: %v", m.reads[from:])
			}
		}
	}
	if !sent {
		t.Fatalf("Korrektur nicht gesendet, während geschossen wird: %v", m.reads[from:])
	}
}

// Wird in der Meyton-Schützenliste eine Nummer korrigiert, ändert sich die SportpassID aller alten Scheiben dieses
// Schützen auf einmal ([[meyton-printout]]). Während geschossen wird, liest die Brücke jede davon höchstens zweimal, statt
// sie 20 Minuten lang jede Runde zu lesen (SF-52).
func TestBulkSportpassChangeReadsEachCardAtMostTwiceWhileShooting(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	const n = 120
	for i := range n {
		id := int32(1000 + i)
		m.stamps[id] = fmt.Sprintf("2025-03-%02d 19:00:00", 1+i%28)
		m.data[id] = withSportpass(cardData(id, 40, "100"), "87654321")
	}
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	tick(t, w, m)
	c.advance(time.Second)
	for i := range n {
		id := int32(1000 + i)
		m.data[id] = withSportpass(m.data[id], "12345678")
	}
	from := len(m.reads)
	sent, reassigned := map[int32]bool{}, 0
	for range 60 {
		m.stamps[9] = c.t.Add(2 * time.Hour).Format(stampLayout)
		r := tick(t, w, m)
		reassigned += len(r.Reassigned)
		for _, id := range ids(r) {
			sent[id] = true
		}
		c.advance(time.Second)
	}
	reads := map[int32]int{}
	for _, read := range m.reads[from:] {
		for _, id := range read {
			reads[id]++
		}
	}
	if reassigned != n {
		t.Fatalf("umgebucht gemeldet: %d", reassigned)
	}
	for i := range n {
		id := int32(1000 + i)
		if reads[id] > 2 || !sent[id] {
			t.Fatalf("Scheibe %d: %d Lesungen, gesendet %v", id, reads[id], sent[id])
		}
	}
}

// Abgleich im Leerlauf (SF-21): Eine Korrektur ohne Lebenszeichen, nachdem die Scheibe ruht, liest die Brücke eine
// Stunde (`ReconcileEvery`) nach der letzten Lesung; danach erst wieder nach demselben Abstand.
func TestReconcileReadsRestingCardsWhenIdle(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 20, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(25 * time.Minute)
	m.data[7] = cardData(7, 20, "95")
	tick(t, w, m)
	if last := m.reads[len(m.reads)-1]; len(last) != 0 {
		t.Fatalf("vor dem Abgleich gelesen: %v", last)
	}
	c.advance(time.Hour - 25*time.Minute)
	r := tick(t, w, m)
	if last := m.reads[len(m.reads)-1]; fmt.Sprint(last) != "[7]" || len(r.Snapshots) != 0 {
		t.Fatalf("Abgleich: gelesen %v, gesendet %v", last, ids(r))
	}
	c.advance(time.Second)
	r = tick(t, w, m)
	if len(r.Snapshots) != 1 || *r.Snapshots[0].Data.Treffer.Rows[0]["Ring01"] != "95" {
		t.Fatalf("Korrektur gesendet: %v", ids(r))
	}
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(time.Hour - 2*time.Second)
	tick(t, w, m)
	for _, read := range m.reads[len(m.reads)-2:] {
		if len(read) != 0 {
			t.Fatalf("vor dem nächsten Abgleich gelesen: %v", m.reads[len(m.reads)-2:])
		}
	}
	c.advance(2 * time.Second)
	tick(t, w, m)
	if last := m.reads[len(m.reads)-1]; fmt.Sprint(last) != "[7]" {
		t.Fatalf("nächster Abgleich: %v", last)
	}
}

// Der Abgleich kommt hinter dem laufenden Stand, auch während geschossen wird (SF-52).
func TestReconcileWhileShootingAfterTheLiveStand(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 20, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(2 * time.Hour)
	m.data[7] = cardData(7, 20, "95")
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	from := len(m.reads)
	sent := map[int32]bool{}
	for range 3 {
		m.stamps[9] = c.t.Format(stampLayout)
		for _, id := range ids(tick(t, w, m)) {
			sent[id] = true
		}
		c.advance(time.Second)
	}
	// danach wartet die Korrektur wie jeder neue Stand einer Scheibe, die sich in diesem Lauf bewegt hat
	if fmt.Sprint(m.reads[from]) != "[9 7]" {
		t.Fatalf("erst der laufende Stand, dann der Abgleich: %v", m.reads[from:])
	}
	if !sent[7] {
		t.Fatalf("Korrektur, während geschossen wird: %v", m.reads[from:])
	}
}

// Der Abgleich reicht `ReconcileWindow` vor das jüngste Lebenszeichen, nicht weiter.
func TestReconcileOnlyWithinTheWindow(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 20, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	// 15 Tage später schießt Stand 9, und an Scheibe 7 ändert sich etwas ohne Lebenszeichen. Scheibe 8 liegt 13 Tage vor 9,
	// noch im Fenster.
	c.advance(15 * 24 * time.Hour)
	m.put(9, "2026-10-28 18:00:00", 3, "100")
	m.put(8, "2026-10-15 18:00:00", 20, "100")
	m.data[7] = cardData(7, 20, "95")
	from := len(m.reads)
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(25 * time.Minute)
	idle := len(m.reads)
	for range 3 {
		tick(t, w, m)
		c.advance(time.Hour)
	}
	reconciled := map[int32]bool{}
	for i, read := range m.reads[from:] {
		for _, id := range read {
			if id == 7 {
				t.Fatalf("außerhalb des Fensters gelesen: %v", m.reads[from:])
			}
			if from+i >= idle {
				reconciled[id] = true
			}
		}
	}
	if !reconciled[8] || !reconciled[9] {
		t.Fatalf("im Fenster nicht abgeglichen: %v", m.reads[from:])
	}
}

// Der Abgleich liest nur, was dieser Lauf schon gelesen hat: Was vor dem Startfenster und vor dem Wasserstand liegt, hat
// Spiegel (SF-55).
func TestReconcileSkipsCardsNeverReadInThisRun(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(3, "2026-10-10 20:00:00", 40, "100")
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	for range 3 {
		tick(t, w, m)
		c.advance(time.Hour)
	}
	for _, read := range m.reads {
		for _, id := range read {
			if id == 3 {
				t.Fatalf("nie gelesene Scheibe abgeglichen: %v", m.reads)
			}
		}
	}
	if fmt.Sprint(m.reads[2]) != "[9]" {
		t.Fatalf("Scheibe 9 nicht abgeglichen: %v", m.reads)
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

func TestOneStandAheadDoesNotMoveTheStartWindow(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	// die Anlage zeigt 18:00 UTC (20:00 Ortszeit); Stand 2 geht zwei Tage vor (SF-73)
	m.now = text("2026-10-13 18:00:00.000")
	m.put(1, "2026-10-13 19:50:00", 5, "100")
	m.put(2, "2026-10-15 09:00:00", 5, "100")
	m.put(3, "2026-10-12 19:00:00", 5, "100")
	tick(t, w, m)
	if got := fmt.Sprint(m.reads[0]); got != "[2 1]" {
		t.Fatalf("Startfenster am jüngsten plausiblen Lebenszeichen: %v", got)
	}
	// ohne Uhr der Anlage verankerte der vorgehende Stand das Fenster, und Scheibe 1 fehlte
	m2, w2 := newMemory(), New(Defaults, c.now)
	m2.put(1, "2026-10-13 19:50:00", 5, "100")
	m2.put(2, "2026-10-15 09:00:00", 5, "100")
	tick(t, w2, m2)
	if got := fmt.Sprint(m2.reads[0]); got != "[2]" {
		t.Fatalf("Gegenprobe ohne Uhr: %v", got)
	}
}

func TestDeletedWaitingCardDoesNotKeepTheBridgeBusy(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	tick(t, w, m)
	delete(m.stamps, 7)
	c.advance(2 * time.Hour)
	if r := tick(t, w, m); r.Busy {
		t.Fatal("eine gelöschte, wartende Scheibe hält den Takt nicht bei einer Sekunde")
	}
}

func TestObservedAtIsTheObservationAfterClockStepsBack(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 1, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(-time.Hour)
	m.put(7, "2026-10-13 18:00:05", 2, "100")
	tick(t, w, m)
	s := tick(t, w, m).Snapshots[0]
	if s.ObservedAt != contract.ObservedAt(c.t.UnixMilli()) {
		t.Fatalf("observedAt %s, Uhr %s", s.ObservedAt, contract.ObservedAt(c.t.UnixMilli()))
	}
}

func TestSkippedReportedOncePerState(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 1, "100")
	bad := m.data[7]
	bad.Scheiben.Rows[0]["Nachname"] = text(string([]byte{'M', 0xff}))
	reported := 0
	for range 5 {
		reported += len(tick(t, w, m).Skipped)
		c.advance(time.Second)
	}
	if reported != 1 {
		t.Fatalf("%d Meldungen", reported)
	}
}

func TestUndeliveredIsReadAndSentAgain(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	tickUndelivered(t, w, m)
	c.advance(time.Second)
	if r := tickUndelivered(t, w, m); len(r.Snapshots) != 1 || r.Backlog != 1 {
		t.Fatalf("erster Versuch: %d Snapshots, Rückstau %d", len(r.Snapshots), r.Backlog)
	}
	// der Upload scheiterte; eine Stunde später ist die Scheibe nicht mehr aktiv, wartet aber noch
	c.advance(time.Hour)
	r := tickUndelivered(t, w, m)
	if len(r.Snapshots) != 1 || r.Backlog != 1 {
		t.Fatalf("neu gelesen und erneut: %d Snapshots, Rückstau %d", len(r.Snapshots), r.Backlog)
	}
	w.Delivered(r.Snapshots[0])
	c.advance(time.Second)
	if r := tickUndelivered(t, w, m); len(r.Snapshots) != 0 || r.Backlog != 0 {
		t.Fatalf("bestätigt: %d Snapshots, Rückstau %d", len(r.Snapshots), r.Backlog)
	}
}

func TestLifesignOnlyAtMostEvery30Seconds(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	sent := 0
	// 65 s lang alle 5 s ein Lebenszeichen, jede Sekunde eine Runde: gesendet nach 31 und 61 s (30 s nach dem vorigen)
	for second := 1; second <= 65; second++ {
		if second%5 == 0 {
			m.stamps[7] = fmt.Sprintf("2026-10-13 18:01:%02d", second%60)
			d := m.data[7]
			d.Scheiben.Columns["Zeitstempel"] = "datetime"
			d.Scheiben.Rows[0]["Zeitstempel"] = text(m.stamps[7])
			m.data[7] = d
		}
		c.advance(time.Second)
		sent += len(tick(t, w, m).Snapshots)
	}
	if sent != 2 {
		t.Fatalf("%d Stände mit nur neuem Lebenszeichen in 65 s, erwartet 2", sent)
	}
	// ein Schuss geht sofort
	m.put(7, "2026-10-13 18:02:01", 4, "100")
	d := m.data[7]
	d.Scheiben.Columns["Zeitstempel"] = "datetime"
	d.Scheiben.Rows[0]["Zeitstempel"] = text(m.stamps[7])
	m.data[7] = d
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 1 {
		t.Fatalf("Schuss: %v", got)
	}
}

func TestResendAfterNewConsent(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	c.advance(2 * time.Hour)
	w.Resend(w.Known())
	tick(t, w, m)
	c.advance(time.Second)
	if got := ids(tick(t, w, m)); len(got) != 1 {
		t.Fatalf("erneut: %v", got)
	}
}

// Das Nachholen kommt hinter dem laufenden Stand, auch während geschossen wird (SF-52): die Scheiben des vorigen
// Abends, die vor dem Wasserstand nicht.
func TestCatchUpWhileShootingAfterTheLiveStand(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	// der vorige Abend (vor dem Startfenster, nach dem Wasserstand) und heute ein laufender Stand
	m.put(1, "2026-10-09 21:00:00", 40, "100")
	m.put(2, "2026-10-09 21:30:00", 40, "100")
	m.put(3, "2026-10-01 20:00:00", 40, "100") // vor dem Wasserstand
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	w.SetCatchUpFrom("2026-10-08 22:00:00")
	sent := map[int32]bool{}
	r := tick(t, w, m)
	if fmt.Sprint(m.reads[0]) != "[9 2 1]" || !r.Busy {
		t.Fatalf("erst der laufende Stand, dann das Nachholen, die jüngste zuerst: %v", m.reads[0])
	}
	// Stand 9 schießt weiter
	for range 3 {
		c.advance(time.Second)
		m.stamps[9] = c.t.Add(2 * time.Hour).Format(stampLayout)
		for _, id := range ids(tick(t, w, m)) {
			sent[id] = true
		}
	}
	if !sent[1] || !sent[2] || sent[3] {
		t.Fatalf("nachgeholt, während geschossen wird: %v", sent)
	}
	// 25 Minuten später ruht Stand 9, und nichts ist mehr nachzuholen
	c.advance(25 * time.Minute)
	if r := tick(t, w, m); r.Busy {
		t.Fatal("nach dem Nachholen ruhig")
	}
}

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

// Das Budget liegt innerhalb von `MaxCards`: Belegen die laufenden Scheiben alle Plätze, liest die Runde nichts aus
// dem Leerlauf, auch keine wartende.
func TestIdleBudgetInsideMaxCards(t *testing.T) {
	m, c := newMemory(), start()
	cfg := Defaults
	cfg.MaxCards = 3
	w := New(cfg, c.now)
	m.put(8, "2026-10-13 20:00:00", 3, "100")
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	history(w, m, 100, 4)
	// drei Runden: Danach wartet eine Scheibe aus dem Leerlauf auf ihre zweite Lesung
	for range 3 {
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

// Im Leerlauf gilt für Nachholen, Nachladen und Abgleich nur `MaxCards`, nicht das kleine Budget.
func TestHistoryWhenIdleUpToMaxCards(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	history(w, m, 100, 12)
	w.SetHistory(nil)
	tick(t, w, m)
	// Stand 9 ruht, dann kommt der Auftrag
	c.advance(25 * time.Minute)
	history(w, m, 100, 12)
	tick(t, w, m)
	n := 0
	for _, id := range m.reads[len(m.reads)-1] {
		if id >= 100 {
			n++
		}
	}
	if n != 12 {
		t.Fatalf("im Leerlauf alle zwölf in einer Runde: %v", m.reads[len(m.reads)-1])
	}
}

// Die zweite Lesung einer per ID angefragten Scheibe zählt nicht zum Budget des Leerlaufs: Auch ohne Budget geht sie
// hinaus, während geschossen wird.
func TestRequestedWaitingCardIsNotIdle(t *testing.T) {
	m, c := newMemory(), start()
	cfg := Defaults
	cfg.IdleWhileLive = 0
	w := New(cfg, c.now)
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	m.put(4, "2025-05-01 19:00:00", 40, "100")
	tick(t, w, m)
	w.SetRequested(func(id int32) bool { return id == 4 })
	sent := false
	for range 3 {
		c.advance(time.Second)
		m.stamps[9] = c.t.Add(2 * time.Hour).Format(stampLayout)
		for _, id := range ids(tick(t, w, m)) {
			sent = sent || id == 4
		}
	}
	if !sent {
		t.Fatalf("angefragt, während geschossen wird: %v", m.reads)
	}
}

func TestCatchUpOnlyBeforeTheFirstRound(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(1, "2026-10-09 21:00:00", 40, "100")
	m.put(9, "2026-10-13 20:00:00", 3, "100")
	tick(t, w, m)
	w.SetCatchUpFrom("2026-10-08 22:00:00")
	c.advance(time.Hour)
	for range 3 {
		tick(t, w, m)
		c.advance(time.Second)
	}
	for _, read := range m.reads {
		for _, id := range read {
			if id == 1 {
				t.Fatal("ein Wasserstand nach dem Start ändert nichts")
			}
		}
	}
}

// Solange die Uhr der Brücke nicht stimmt (SF-79), gibt die Erkennung nichts heraus; sie liest weiter, der Stand wartet.
func TestHoldEmitsNothingAndReleasesAtOnce(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	w.SetHold(true)
	m.put(7, "2026-10-13 18:00:00", 3, "100")
	for range 3 {
		r := tick(t, w, m)
		if len(r.Snapshots) != 0 {
			t.Fatal("im Halten geht nichts hinaus")
		}
		c.advance(time.Second)
	}
	if r := tick(t, w, m); r.Backlog != 1 || !r.Busy {
		t.Fatalf("der Stand wartet: Rückstau %d, busy %v", r.Backlog, r.Busy)
	}
	w.SetHold(false)
	c.advance(time.Second)
	r := tick(t, w, m)
	if len(r.Snapshots) != 1 || r.Snapshots[0].Sequence != c.t.UnixMilli() {
		t.Fatalf("nach der Freigabe sofort, mit der Uhr von jetzt: %+v", r.Snapshots)
	}
}

// Ging die Uhr im Halten vor, schiebt sie die Folgenummer nicht: Nach dem Rücksprung zählt die Uhr von jetzt.
func TestHoldWithClockAheadKeepsTheSequence(t *testing.T) {
	m, c := newMemory(), start()
	w := New(Defaults, c.now)
	m.put(7, "2026-10-13 18:00:00", 1, "100")
	tick(t, w, m)
	c.advance(time.Second)
	first := tick(t, w, m).Snapshots[0].Sequence
	// die Uhr springt eine Stunde vor, die Brücke hält
	w.SetHold(true)
	c.advance(time.Hour)
	m.put(7, "2026-10-13 18:00:05", 2, "100")
	tick(t, w, m)
	c.advance(time.Second)
	tick(t, w, m)
	// NTP stellt sie zurück, die Brücke gibt frei
	c.advance(-time.Hour)
	w.SetHold(false)
	r := tick(t, w, m)
	if len(r.Snapshots) != 1 || r.Snapshots[0].Sequence != c.t.UnixMilli() || r.Snapshots[0].Sequence <= first {
		t.Fatalf("Folgenummer %v, Uhr %d, vorher %d", ids(r), c.t.UnixMilli(), first)
	}
}
