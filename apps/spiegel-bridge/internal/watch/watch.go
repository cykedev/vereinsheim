// Package watch erkennt Änderungen in der Ablage und baut daraus Snapshots: ohne eigenen Zustand auf der Platte, nur
// im Arbeitsspeicher (ADR-027).
//
// Eine Runde liest in einer Transaktion das Lebenszeichen aller Scheiben und dann die Scheiben ganz, die neu sind,
// deren Lebenszeichen oder SportpassID sich bewegt hat, die noch auf Bestätigung warten oder die aktiv sind. Ein
// Snapshot entsteht, wenn zwei Lesungen hintereinander gleich sind (SF-71) und sich vom zuletzt gemeldeten Stand
// unterscheiden.
package watch

import (
	"context"
	"sort"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
)

// Lifesign ist `Scheiben.Zeitstempel` einer Scheibe, als Text wie im Textprotokoll. Er steigt alle 5 bis 10 s, solange
// der Stand belegt ist (SF-50), kommt aber von der Uhr des Stands (SF-73): verglichen wird nur auf Gleichheit.
type Lifesign struct {
	ID    int32
	Stamp string
	// `Scheiben.SportpassID` als Text, nil ohne: ordnet eine Scheibe einem Auftrag zum Nachladen zu, ohne sie ganz
	// zu lesen, und zeigt ein Umbuchen in Meyton, das das Lebenszeichen nicht bewegt (SF-80)
	Sportpass *string
}

// Round ist, was eine Runde aus der Ablage gelesen hat: alle Lebenszeichen und die gewählten Scheiben ganz.
type Round struct {
	Lifesigns       []Lifesign
	Cards           map[int32]contract.Data
	SourceVersion   *string
	SessionTimeZone string
	// `NOW(3)` der Anlage in der Sitzungszone (UTC) als Text; nil ohne Messung. Verankert das Startfenster und misst die
	// Uhrabweichung im Heartbeat (SF-29).
	SourceNow *string
}

// Source liest eine Runde in einer kurzen lesenden Transaktion (SF-51). `choose` bekommt die Lebenszeichen und die Uhr
// der Anlage (`Round.SourceNow`) und nennt die Scheiben, die ganz gelesen werden; sie stehen danach in `Round.Cards`.
type Source interface {
	Round(ctx context.Context, choose func(lifesigns []Lifesign, sourceNow *string) []int32) (Round, error)
}

// Config sind die Regeln der Erkennung; `Defaults` sind die voreingestellten.
type Config struct {
	// Epoche der Quelle (SF-23), aus dem Zustand in Spiegel
	Epoch int
	// so lange nach der letzten Bewegung des Lebenszeichens wird eine Scheibe jede Runde ganz gelesen: fängt Korrektur
	// und Löschen ohne neues Lebenszeichen (SF-21, SF-22)
	ActiveFor time.Duration
	// beim Start gelten Scheiben bis so weit vor dem jüngsten Lebenszeichen als neu (nicht gegen die eigene Uhr, SF-73)
	StartWindow time.Duration
	// höchstens so viele Scheiben je Runde ganz lesen (SF-52)
	MaxCards int
	// eine Scheibe, die so lange nicht mehr in der Ablage stand, vergisst die Brücke (Fehlen ist keine Löschung, SF-24)
	ForgetAfter time.Duration
	// ein Stand, der sich vom gesendeten nur im Lebenszeichen unterscheidet, höchstens so oft
	LifesignEvery time.Duration
	// so weit vor dem jüngsten Lebenszeichen liest der Abgleich im Leerlauf schon gelesene Scheiben neu: späte
	// Korrekturen und Umbuchen ohne neues Lebenszeichen (SF-21, SF-80)
	ReconcileWindow time.Duration
	// so lange nach der letzten Lesung ist eine Scheibe für den Abgleich wieder dran
	ReconcileEvery time.Duration
}

// Defaults sind die voreingestellten Regeln.
var Defaults = Config{
	Epoch:         1,
	ActiveFor:     20 * time.Minute,
	StartWindow:   12 * time.Hour,
	MaxCards:      50,
	ForgetAfter:   24 * time.Hour,
	LifesignEvery: 30 * time.Second,
	// zwei Wochen decken die nächsten zwei Trainings, rund 30 Scheiben: eine Runde
	ReconcileWindow: 14 * 24 * time.Hour,
	ReconcileEvery:  time.Hour,
}

// LifesignColumn ist die Spalte des Lebenszeichens in `Scheiben`.
const LifesignColumn = "Zeitstempel"

type card struct {
	stamp   string
	movedAt time.Time // Uhr der Brücke; null: seit dem Start nicht bewegt
	seenAt  time.Time
	dirty   bool // neu oder bewegt, seit der letzten Lesung nicht gelesen (das Budget reichte nicht)
	// beim Start vor dem Startfenster, aber nach dem Wasserstand in Spiegel: einmal lesen, wenn niemand schießt
	backfill bool
	readAt   time.Time // zuletzt ganz gelesen
	last     string    // Prüfsumme der vorigen Lesung
	waiting  bool      // ein neuer Stand mit Treffern, noch nicht von Spiegel bestätigt
	sent     string    // Prüfsumme des zuletzt bestätigten Stands
	// dessen Prüfsumme ohne Lebenszeichen und wann er bestätigt wurde (Drossel des Lebenszeichens)
	sentContent string
	sentAt      time.Time
	skipped     string // Code, mit dem die letzte Lesung übersprungen wurde (einmal melden)
	// `Scheiben.SportpassID` aus dem Lebenszeichen; ein offener Auftrag zum Nachladen will sie
	sportpass *string
	// zuletzt ganz gelesen ohne Treffer: geht nie hinaus (SF-13), für einen Auftrag per ID keine Scheibe
	empty bool
	// der wartende Stand kommt von einer neuen SportpassID (SF-80): die zweite Lesung wartet nicht auf den Leerlauf
	reassigned bool
}

// setWaiting: Ohne wartenden Stand ist auch eine neue SportpassID erledigt.
func (c *card) setWaiting(waiting bool) {
	c.waiting = waiting
	c.reassigned = c.reassigned && waiting
}

// handled: in diesem Lauf gelesen, kein Stand wartet auf Spiegel, und seither ist nichts neu zu lesen
func handled(c *card) bool { return !c.readAt.IsZero() && !c.waiting && !c.dirty }

// Skip ist eine Scheibe, die die Runde nicht melden kann, mit festem Code ohne Inhalt (SF-59).
type Skip struct {
	ID   int32
	Code string
}

// Result ist das Ergebnis einer Runde.
type Result struct {
	Snapshots []contract.Snapshot
	// Scheiben, die gegen den Vertrag verstoßen (zu lang, ungültige Bytes): gehen nicht hinaus, der Heartbeat meldet sie
	Skipped []Skip
	// Scheiben, deren SportpassID sich seit der letzten Runde geändert hat: in Meyton umgebucht (SF-80)
	Reassigned []int32
	// gelesene Scheiben und alle Lebenszeichen
	Read, Cards int
	// etwas bewegt sich oder wartet auf Bestätigung: die nächste Runde bald
	Busy bool
	// Scheiben mit neuem Stand, die Spiegel noch nicht bestätigt hat (Heartbeat)
	Backlog int
	// `NOW(3)` der Anlage in UTC beim Lesen, als Text; nil ohne Messung
	SourceNow *string
}

// Watcher hält den Arbeitsspeicher der Erkennung. Nicht nebenläufig benutzen.
type Watcher struct {
	cfg     Config
	now     func() time.Time
	cards   map[int32]*card
	started bool
	lastSeq int64
	// Nachholen beim Start ab hier (Lebenszeichen als Text), aus dem Wasserstand in Spiegel; leer: nur das Startfenster
	catchUpFrom string
	// in der letzten Runde bewegte sich etwas oder war aktiv: das Nachholen wartet und hält den Takt nicht hoch
	live bool
	// offene Aufträge zum Nachladen: will ein Auftrag die Scheibe mit dieser SportpassID? nil: keiner
	history func(sportpass string) bool
	// offene Aufträge per ID (ID vom Ausdruck): will einer diese Scheibe? nil: keiner
	requested func(id int32) bool
	// Uhr der letzten gelungenen Runde: welche Scheiben in ihr in der Ablage standen
	roundAt time.Time
	// die Uhr der Brücke stimmt nicht oder ist ungeprüft (SF-79): nichts herausgeben
	hold bool
}

// SetHold: Solange die Uhr der Brücke nicht stimmt (SF-79), gibt `Tick` keine Stände heraus und lässt die Folgenummer,
// wie sie ist; gelesen und vermerkt wird wie sonst, ein neuer Stand wartet. Nach der Freigabe geht ein stabiler Stand
// in der nächsten Runde hinaus, mit der Uhr von dann.
func (w *Watcher) SetHold(hold bool) { w.hold = hold }

// SetHistory legt fest, welche Scheiben offene Aufträge zum Nachladen wollen, nach ihrer SportpassID als Text;
// nil heißt keiner. Gelesen werden sie wie das Nachholen: nur, wenn niemand schießt (SF-52), mit dem Budget je Runde.
func (w *Watcher) SetHistory(wanted func(sportpass string) bool) { w.history = wanted }

func (w *Watcher) wantsHistory(sportpass *string) bool {
	return w.history != nil && sportpass != nil && w.history(*sportpass)
}

// SetRequested legt fest, welche Scheiben ein Auftrag per ID will; nil heißt keiner. Anders als das Nachladen liest die
// Erkennung sie gleich (Rang 1), auch wenn geschossen wird: Es ist je Auftrag eine Scheibe, und jemand wartet darauf.
func (w *Watcher) SetRequested(wanted func(id int32) bool) { w.requested = wanted }

func (w *Watcher) wantsRequest(id int32) bool { return w.requested != nil && w.requested(id) }

// RequestState sagt, wie es um die Scheibe eines Auftrags steht: `seen`, ob sie in der letzten Runde in der Ablage stand
// und Treffer hat (ohne Treffer geht sie nie hinaus, SF-13), `open`, ob sie noch zu lesen ist oder ihr Stand auf Spiegel
// wartet.
func (w *Watcher) RequestState(id int32) (seen, open bool) {
	c := w.cards[id]
	if c == nil || !c.seenAt.Equal(w.roundAt) {
		return false, false
	}
	if handled(c) && c.empty {
		return false, false
	}
	return true, !handled(c)
}

// Reopen: Ein Auftrag zum Nachladen ist neu eröffnet (Meldungen aufgehoben, neu bestätigt). Was er will, liest die
// Erkennung noch einmal und meldet es neu, auch was sie in diesem Lauf schon gemeldet oder zurückgehalten hat; wie das
// Nachladen nur im Leerlauf.
func (w *Watcher) Reopen(wanted func(sportpass string) bool) {
	for _, c := range w.cards {
		if c.sportpass != nil && wanted(*c.sportpass) {
			c.readAt, c.sent, c.sentContent, c.last, c.waiting = time.Time{}, "", "", "", false
		}
	}
}

// HistoryOpen nennt die SportpassIDs (als Text) der Scheiben aus der letzten Runde, die ein Auftrag noch will: nicht
// gelesen, oder ihr Stand wartet noch auf Spiegel. Kommt eine SportpassID nicht vor, ist ihr Auftrag erledigt, soweit
// die Ablage reicht.
func (w *Watcher) HistoryOpen() []string {
	var out []string
	for _, c := range w.cards {
		if c.seenAt.Equal(w.roundAt) && w.wantsHistory(c.sportpass) && !handled(c) {
			out = append(out, *c.sportpass)
		}
	}
	return out
}

// SetCatchUpFrom legt vor der ersten Runde fest, ab welchem Lebenszeichen nachgeholt wird (SF-55): was davor im
// Startfenster fehlt, liest die Brücke einmal, sobald niemand schießt. Nach der ersten Runde ohne Wirkung.
func (w *Watcher) SetCatchUpFrom(stamp string) {
	if !w.started {
		w.catchUpFrom = stamp
	}
}

// New legt eine Erkennung an; `now` ist die Uhr der Brücke (nil: die Systemuhr).
func New(cfg Config, now func() time.Time) *Watcher {
	if now == nil {
		now = time.Now
	}
	return &Watcher{cfg: cfg, now: now, cards: map[int32]*card{}}
}

const stampLayout = "2006-01-02 15:04:05"

// windowFrom ist das älteste Lebenszeichen in einem Fenster der Länge `d` vor dem jüngsten: beim ersten Lauf das
// Startfenster (was noch als neu gilt), in jeder Runde das Fenster des Abgleichs. `YYYY-MM-DD HH:MM:SS` sortiert als Text
// wie als Zeit. Die Uhr eines einzelnen Stands kann vorgehen (SF-73): Was mehr als einen Tag nach der Uhr der Anlage
// liegt, verankert das Fenster nicht (ein Tag deckt die Zone der Ortszeit ab). Ohne lesbares Lebenszeichen und ohne Uhr
// leer: alles im Fenster.
func (w *Watcher) windowFrom(lifesigns []Lifesign, sourceNow *string, d time.Duration) string {
	limit := ""
	if sourceNow != nil && len(*sourceNow) >= len(stampLayout) {
		if t, err := time.Parse(stampLayout, (*sourceNow)[:len(stampLayout)]); err == nil {
			limit = t.Add(24 * time.Hour).Format(stampLayout)
		}
	}
	newest := ""
	for _, l := range lifesigns {
		if l.Stamp > newest && (limit == "" || l.Stamp <= limit) {
			newest = l.Stamp
		}
	}
	if newest == "" && sourceNow != nil && len(*sourceNow) >= len(stampLayout) {
		newest = (*sourceNow)[:len(stampLayout)]
	}
	t, err := time.Parse(stampLayout, newest)
	if err != nil {
		return ""
	}
	return t.Add(-d).Format(stampLayout)
}

// sameText: beide ohne Wert oder mit demselben Text
func sameText(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// dirty: Die Scheibe ist neu, oder ihr Lebenszeichen oder ihre SportpassID hat sich bewegt, seit sie zuletzt gelesen
// wurde. Die SportpassID ändert sich beim Umbuchen in Meyton, ohne dass das Lebenszeichen sich bewegt (SF-80).
// backfill: beim Start eine Scheibe vor dem Startfenster, aber nach dem Wasserstand in Spiegel (Nachholen, SF-55).
func (w *Watcher) backfill(l Lifesign, from string) bool {
	if w.started {
		c := w.cards[l.ID]
		return c != nil && c.backfill
	}
	return w.catchUpFrom != "" && l.Stamp >= w.catchUpFrom && l.Stamp < from
}

func (w *Watcher) dirty(l Lifesign, from string) bool {
	c, known := w.cards[l.ID]
	switch {
	case !w.started:
		return l.Stamp >= from
	case !known:
		return true
	default:
		return c.dirty || c.stamp != l.Stamp || !sameText(c.sportpass, l.Sportpass)
	}
}

// reconcileDue: Die Scheibe ist für den Abgleich dran. Sie liegt im Fenster ab `from`, und ihre letzte Lesung ist
// `ReconcileEvery` her. Nur in diesem Lauf gelesene: Was davor liegt, deckt nach einem Neustart der Wasserstand (SF-55).
func (w *Watcher) reconcileDue(c *card, l Lifesign, now time.Time, from string) bool {
	return c != nil && !c.readAt.IsZero() && from != "" && l.Stamp >= from && now.Sub(c.readAt) >= w.cfg.ReconcileEvery
}

// plan wählt die Scheiben einer Runde, ohne den Speicher zu ändern; erst eine gelungene Runde übernimmt ihn. Reihenfolge:
// was auf Bestätigung wartet, dann was sich bewegt hat (die jüngsten zuerst), dann die aktiven, die am längsten nicht
// gelesen wurden. So verhungert keine Scheibe am Budget. Nachzuholende, Nachzuladende und der Abgleich ab
// `reconcileFrom` kommen nur, wenn sonst nichts zu lesen ist: ältere Scheiben nur, wenn gerade niemand schießt (SF-52).
func (w *Watcher) plan(now time.Time, lifesigns []Lifesign, from, reconcileFrom string) []int32 {
	type pick struct {
		id     int32
		rank   int
		stamp  string
		readAt time.Time
		// nur im Leerlauf: Nachholen, Nachladen, und was davon noch auf Spiegel wartet
		idle bool
	}
	var picks []pick
	// bewegt sich etwas oder ist eine Scheibe aktiv (auch eine, die gerade auf Bestätigung wartet), bleibt das Nachholen
	// liegen
	live := false
	for _, l := range lifesigns {
		c := w.cards[l.ID]
		active := c != nil && !c.movedAt.IsZero() && now.Sub(c.movedAt) < w.cfg.ActiveFor
		live = live || active || w.dirty(l, from)
		p := pick{id: l.ID, stamp: l.Stamp, rank: -1}
		switch {
		case c != nil && c.waiting:
			// wartet eine Scheibe, die sich in diesem Lauf nie bewegt hat (Nachholen, Nachladen), bleibt sie liegen, solange
			// geschossen wird: Scheitert der Upload länger, belegte sie sonst jede Runde das Budget. Eine per ID angefragte
			// und eine mit neuer SportpassID nicht
			p.rank, p.idle = 0, c.movedAt.IsZero() && !c.reassigned && !w.wantsRequest(l.ID)
		case w.dirty(l, from):
			p.rank = 1
		// ein Auftrag per ID will sie: gleich, nicht erst im Leerlauf
		case w.wantsRequest(l.ID) && (c == nil || !handled(c)):
			p.rank = 1
		case active:
			p.rank, p.readAt = 2, c.readAt
		case w.backfill(l, from):
			p.rank, p.idle = 3, true
		// Abgleich: späte Korrekturen ohne Lebenszeichen (SF-21), wie das Nachholen nur im Leerlauf
		case w.reconcileDue(c, l, now, reconcileFrom):
			p.rank, p.idle = 3, true
		// ein Auftrag zum Nachladen will sie: wie das Nachholen, nur im Leerlauf
		case w.wantsHistory(l.Sportpass) && (c == nil || !handled(c)):
			p.rank, p.idle = 3, true
		}
		if p.rank >= 0 {
			picks = append(picks, p)
		}
	}
	sort.SliceStable(picks, func(i, j int) bool {
		a, b := picks[i], picks[j]
		if a.rank != b.rank {
			return a.rank < b.rank
		}
		if a.rank == 2 && !a.readAt.Equal(b.readAt) {
			return a.readAt.Before(b.readAt)
		}
		return a.stamp > b.stamp
	})
	w.live = live
	if live {
		kept := picks[:0]
		for _, p := range picks {
			if !p.idle {
				kept = append(kept, p)
			}
		}
		picks = kept
	}
	if len(picks) > w.cfg.MaxCards {
		picks = picks[:w.cfg.MaxCards]
	}
	ids := make([]int32, len(picks))
	for i, p := range picks {
		ids[i] = p.id
	}
	return ids
}

// Tick liest eine Runde. Scheitert sie, ändert sich nichts: keine Lesung, keine Bestätigung, keine Löschung (SF-24).
func (w *Watcher) Tick(ctx context.Context, src Source) (Result, error) {
	now := w.now()
	var chosen []int32
	var from string
	round, err := src.Round(ctx, func(lifesigns []Lifesign, sourceNow *string) []int32 {
		if !w.started {
			from = w.windowFrom(lifesigns, sourceNow, w.cfg.StartWindow)
		}
		chosen = w.plan(now, lifesigns, from, w.windowFrom(lifesigns, sourceNow, w.cfg.ReconcileWindow))
		return chosen
	})
	if err != nil {
		return Result{}, err
	}

	result := Result{Read: len(round.Cards), Cards: len(round.Lifesigns), SourceNow: round.SourceNow}
	for _, l := range round.Lifesigns {
		dirty, backfill := w.dirty(l, from), w.backfill(l, from)
		c, known := w.cards[l.ID]
		if !known {
			c = &card{}
			w.cards[l.ID] = c
		}
		// bewegt hat sich, was neu oder geändert ist; beim Start nur, was im Startfenster liegt
		if (known && c.stamp != l.Stamp) || (!known && dirty) {
			c.movedAt = now
		}
		// eine neue SportpassID macht die Scheibe nicht aktiv: Korrigiert Meyton eine Nummer, ändern sich alle alten
		// Scheiben des Schützen auf einmal, und jede würde 20 Minuten lang jede Runde gelesen (SF-52)
		if known && !sameText(c.sportpass, l.Sportpass) {
			c.reassigned = true
			result.Reassigned = append(result.Reassigned, l.ID)
		}
		c.stamp, c.dirty, c.seenAt, c.sportpass = l.Stamp, dirty, now, l.Sportpass
		c.backfill = backfill && !dirty
	}
	w.started, w.roundAt = true, now
	for _, id := range chosen {
		if c := w.cards[id]; c != nil {
			c.dirty, c.backfill, c.readAt = false, false, now
		}
	}

	seq := now.UnixMilli()
	if seq <= w.lastSeq {
		seq = w.lastSeq + 1
	}
	for _, id := range chosen {
		data, ok := round.Cards[id]
		c := w.cards[id]
		if !ok || c == nil {
			continue
		}
		if err := contract.ValidateData(data); err != nil {
			code := "invalid"
			if issue, ok := err.(*contract.Issue); ok {
				code = issue.Code
			}
			// einmal je Stand melden, nicht in jeder Runde, solange die Scheibe aktiv ist
			if c.skipped != code {
				result.Skipped = append(result.Skipped, Skip{ID: id, Code: code})
			}
			c.skipped, c.last = code, ""
			c.setWaiting(false)
			continue
		}
		sum, err := contract.Checksum(data)
		if err != nil {
			if c.skipped != "malformed-string" {
				result.Skipped = append(result.Skipped, Skip{ID: id, Code: "malformed-string"})
			}
			c.skipped, c.last = "malformed-string", ""
			c.setWaiting(false)
			continue
		}
		c.skipped = ""
		c.empty = len(data.Treffer.Rows) == 0
		stable := sum == c.last
		c.last = sum
		// nur ein neuer Stand (nach einer zerrissenen Lesung kommt oft der alte wieder) und ohne Treffer nie (SF-13)
		fresh := sum != c.sent && len(data.Treffer.Rows) > 0
		// bis Spiegel ihn bestätigt (`Delivered`), wartet ein neuer Stand und wird jede Runde neu gelesen: ohne
		// Warteschlange schickt die Brücke nach einem gescheiterten Upload, was sie dann liest (ADR-027)
		c.setWaiting(fresh)
		// zwei gleiche Lesungen hintereinander (SF-71); gehalten geht nichts hinaus (SF-79)
		if !fresh || !stable || w.hold {
			continue
		}
		// nur das Lebenszeichen bewegt: höchstens alle `LifesignEvery` (Spiegel legt dafür ohnehin keine Zeilen an)
		if content := contentChecksum(data); content != "" && content == c.sentContent && now.Sub(c.sentAt) < w.cfg.LifesignEvery {
			continue
		}
		result.Snapshots = append(result.Snapshots, contract.Snapshot{
			ContractVersion: contract.ContractVersion,
			Source:          contract.Source,
			SourceVersion:   round.SourceVersion,
			Epoch:           w.cfg.Epoch,
			ScheibenID:      id,
			Sequence:        seq,
			// die echte Beobachtung, auch wenn die Folgenummer nach einem Rücksprung der Uhr weiterzählt: Spiegel misst
			// an ihr den Versatz der Stände
			ObservedAt:      contract.ObservedAt(now.UnixMilli()),
			SessionTimeZone: round.SessionTimeZone,
			Data:            data,
			Checksum:        sum,
		})
	}
	if len(result.Snapshots) > 0 {
		w.lastSeq = seq
	}

	for id, c := range w.cards {
		if now.Sub(c.seenAt) > w.cfg.ForgetAfter {
			delete(w.cards, id)
			continue
		}
		if c.waiting && c.seenAt.Equal(now) {
			result.Backlog++
		}
		// ein offener Auftrag zum Nachladen hält den Takt hoch, solange niemand schießt; einer per ID immer
		history := w.wantsHistory(c.sportpass) && !handled(c)
		request := w.wantsRequest(id) && !handled(c)
		// nur, was in dieser Runde in der Ablage stand: Eine gelöschte Scheibe, die noch wartete, hielte die Brücke sonst
		// einen Tag lang im Sekundentakt
		if c.seenAt.Equal(now) && (c.waiting || request || ((c.backfill || history) && !w.live) || (!c.movedAt.IsZero() && now.Sub(c.movedAt) < time.Minute)) {
			result.Busy = true
		}
	}
	return result, nil
}

// Delivered: Spiegel hat den Stand endgültig beantwortet, oder die Brücke schickt ihn bewusst nicht (Filter). Er geht
// nicht noch einmal hinaus, bis sich die Scheibe ändert.
func (w *Watcher) Delivered(s contract.Snapshot) {
	c := w.cards[s.ScheibenID]
	if c == nil {
		return
	}
	c.sent = s.Checksum
	c.setWaiting(c.last != s.Checksum && c.last != "")
	c.sentContent, c.sentAt = contentChecksum(s.Data), w.now()
}

// Resend vergisst den bestätigten Stand dieser Scheiben, damit die nächsten Runden sie neu lesen und schicken (eine
// neue Zustimmung, eine bestätigte Epoche). Was die Brücke nicht mehr im Speicher hat, holt erst das Nachholen.
func (w *Watcher) Resend(ids []int32) {
	for _, id := range ids {
		if c := w.cards[id]; c != nil {
			c.sent, c.sentContent, c.last, c.dirty = "", "", "", true
		}
	}
}

// Known nennt die Scheiben im Speicher.
func (w *Watcher) Known() []int32 {
	ids := make([]int32, 0, len(w.cards))
	for id := range w.cards {
		ids = append(ids, id)
	}
	return ids
}

// SetEpoch setzt die Epoche für die nächsten Snapshots (aus dem Zustand in Spiegel).
func (w *Watcher) SetEpoch(epoch int) { w.cfg.Epoch = epoch }

// contentChecksum ist die Prüfsumme ohne `Scheiben.Zeitstempel`: Zwei Stände mit derselben unterscheiden sich nur im
// Lebenszeichen. Leer, wenn sie sich nicht rechnen lässt.
func contentChecksum(d contract.Data) string {
	if len(d.Scheiben.Rows) != 1 {
		return ""
	}
	row := contract.Row{}
	for k, v := range d.Scheiben.Rows[0] {
		if k != LifesignColumn {
			row[k] = v
		}
	}
	columns := map[string]string{}
	for k, v := range d.Scheiben.Columns {
		if k != LifesignColumn {
			columns[k] = v
		}
	}
	d.Scheiben = contract.Table{Columns: columns, Rows: []contract.Row{row}}
	sum, err := contract.Checksum(d)
	if err != nil {
		return ""
	}
	return sum
}
