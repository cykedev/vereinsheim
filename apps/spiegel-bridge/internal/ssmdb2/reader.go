// Package ssmdb2 liest die Meyton-Ablage nur lesend (ADR-027): feste Abfragen ohne Platzhalter im Textprotokoll, Zellen
// als Text, jede Runde eine kurze Transaktion `WITH CONSISTENT SNAPSHOT, READ ONLY` (SF-51), alle Spalten mit ihrem Typ
// aus information_schema (SF-25), Sitzung fest auf UTC (SF-31).
package ssmdb2

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/watch"
)

// SessionTimeZone ist die Zeitzone jeder Sitzung; DATETIME-Spalten berührt sie nicht, TIMESTAMP-Spalten liest sie in
// UTC (SF-31).
const SessionTimeZone = "+00:00"

// die Tabellen einer Scheibe, mit ihrem Namen im Snapshot
var tables = [...]struct{ name, key string }{
	{"Scheiben", "scheiben"},
	{"Serien", "serien"},
	{"Treffer", "treffer"},
}

// ErrColumnsChanged: Die Spalten einer Abfrage passen nicht mehr zu information_schema (Meyton-Update während des
// Laufs). Die Runde zählt nicht; die nächste liest die Spalten neu.
var ErrColumnsChanged = errors.New("columns-changed")

// Reader liest die SSMDB2 über eine einzige Verbindung.
type Reader struct {
	db      *sql.DB
	columns map[string]map[string]string // Tabelle → Spalte → COLUMN_TYPE
}

// Open bereitet die Verbindung vor, ohne sie schon aufzubauen; die Brücke ist oft vor dem Meyton-Server wach.
func Open(dsn string) (*Reader, error) {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return nil, errors.New("dsn-invalid")
	}
	if cfg.Params == nil {
		cfg.Params = map[string]string{}
	}
	if err := cfg.Apply(mysql.Charset("utf8mb4", "")); err != nil {
		return nil, errors.New("dsn-invalid")
	}
	cfg.Params["time_zone"] = "'" + SessionTimeZone + "'"
	cfg.ParseTime = false
	cfg.InterpolateParams = false
	cfg.MultiStatements = false
	cfg.Timeout = 5 * time.Second
	cfg.ReadTimeout = 30 * time.Second
	cfg.WriteTimeout = 30 * time.Second
	connector, err := mysql.NewConnector(cfg)
	if err != nil {
		return nil, errors.New("dsn-invalid")
	}
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(10 * time.Minute)
	return &Reader{db: db}, nil
}

// Close beendet die Verbindung.
func (r *Reader) Close() error { return r.db.Close() }

// Code beschreibt einen Fehler ohne seinen Text: Meldungen des Treibers und des Servers können Werte enthalten (SF-59).
func Code(err error) string {
	var mysqlErr *mysql.MySQLError
	var netErr net.Error
	switch {
	case err == nil:
		return ""
	case errors.Is(err, ErrColumnsChanged):
		return ErrColumnsChanged.Error()
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.As(err, &mysqlErr):
		return fmt.Sprintf("mysql-%d", mysqlErr.Number)
	case errors.As(err, &netErr), errors.Is(err, mysql.ErrInvalidConn), errors.Is(err, sql.ErrConnDone):
		return "connection"
	}
	var known interface{ Code() string }
	if errors.As(err, &known) {
		return known.Code()
	}
	return "error"
}

type codeError string

func (e codeError) Error() string { return string(e) }
func (e codeError) Code() string  { return string(e) }

func (r *Reader) loadColumns(ctx context.Context, conn *sql.Conn) error {
	rows, err := conn.QueryContext(ctx,
		"SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS "+
			"WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Scheiben', 'Serien', 'Treffer')")
	if err != nil {
		return err
	}
	defer rows.Close()
	columns := map[string]map[string]string{}
	for rows.Next() {
		var table, column, typ string
		if err := rows.Scan(&table, &column, &typ); err != nil {
			return err
		}
		if columns[table] == nil {
			columns[table] = map[string]string{}
		}
		columns[table][column] = typ
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, t := range tables {
		if _, ok := columns[t.name]["ScheibenID"]; !ok {
			return codeError("table-missing")
		}
	}
	r.columns = columns
	return nil
}

// Round liest eine Runde (watch.Source): Lebenszeichen aller Scheiben, dann die gewählten ganz, alles in einer
// lesenden Transaktion mit konsistentem Schnappschuss.
func (r *Reader) Round(ctx context.Context, choose func([]watch.Lifesign) []int32) (watch.Round, error) {
	conn, err := r.db.Conn(ctx)
	if err != nil {
		return watch.Round{}, err
	}
	defer conn.Close()
	if r.columns == nil {
		if err := r.loadColumns(ctx, conn); err != nil {
			return watch.Round{}, err
		}
	}
	if _, err := conn.ExecContext(ctx, "START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY"); err != nil {
		return watch.Round{}, err
	}
	// lesend: ROLLBACK und COMMIT sind gleich; auch nach einem Fehler offen lassen hieße eine lange Transaktion
	defer func() { _, _ = conn.ExecContext(context.WithoutCancel(ctx), "ROLLBACK") }()

	round := watch.Round{Cards: map[int32]contract.Data{}}
	if err := conn.QueryRowContext(ctx, "SELECT @@session.time_zone").Scan(&round.SessionTimeZone); err != nil {
		return watch.Round{}, err
	}
	round.SourceVersion = readVersion(ctx, conn)

	lifesigns, err := readLifesigns(ctx, conn)
	if err != nil {
		return watch.Round{}, err
	}
	round.Lifesigns = lifesigns
	ids := choose(lifesigns)
	if len(ids) == 0 {
		return round, nil
	}

	list := make([]string, len(ids))
	for i, id := range ids {
		list[i] = strconv.FormatInt(int64(id), 10)
	}
	in := strings.Join(list, ",")
	for _, id := range ids {
		data := contract.Data{}
		for _, t := range tables {
			*tableOf(&data, t.key) = contract.Table{Columns: copyColumns(r.columns[t.name]), Rows: []contract.Row{}}
		}
		round.Cards[id] = data
	}
	for _, t := range tables {
		// nur ganze Zahlen werden eingesetzt; Platzhalter schalteten auf das Binärprotokoll, das Datumswerte umdeutet
		query := fmt.Sprintf("SELECT * FROM `%s` WHERE `ScheibenID` IN (%s)", t.name, in)
		if err := r.readTable(ctx, conn, query, t.name, t.key, round.Cards); err != nil {
			if errors.Is(err, ErrColumnsChanged) {
				r.columns = nil
			}
			return watch.Round{}, err
		}
	}
	return round, nil
}

func tableOf(d *contract.Data, key string) *contract.Table {
	switch key {
	case "scheiben":
		return &d.Scheiben
	case "serien":
		return &d.Serien
	default:
		return &d.Treffer
	}
}

func copyColumns(columns map[string]string) map[string]string {
	out := make(map[string]string, len(columns))
	for k, v := range columns {
		out[k] = v
	}
	return out
}

// readVersion liest die Tabelle `Version`; nicht lesbar oder leer ist kein Fehler der Runde.
func readVersion(ctx context.Context, conn *sql.Conn) *string {
	var version sql.NullString
	if err := conn.QueryRowContext(ctx, "SELECT `Versionsnummer` FROM `Version` LIMIT 1").Scan(&version); err != nil || !version.Valid {
		return nil
	}
	return &version.String
}

func readLifesigns(ctx context.Context, conn *sql.Conn) ([]watch.Lifesign, error) {
	rows, err := conn.QueryContext(ctx, "SELECT `ScheibenID`, `Zeitstempel` FROM `Scheiben`")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []watch.Lifesign
	for rows.Next() {
		var id int32
		var stamp sql.RawBytes
		if err := rows.Scan(&id, &stamp); err != nil {
			return nil, err
		}
		out = append(out, watch.Lifesign{ID: id, Stamp: string(stamp)})
	}
	return out, rows.Err()
}

func (r *Reader) readTable(ctx context.Context, conn *sql.Conn, query, table, key string, cards map[int32]contract.Data) error {
	rows, err := conn.QueryContext(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()
	names, err := rows.Columns()
	if err != nil {
		return err
	}
	known := r.columns[table]
	if len(names) != len(known) {
		return ErrColumnsChanged
	}
	idAt := -1
	for i, name := range names {
		if _, ok := known[name]; !ok {
			return ErrColumnsChanged
		}
		if name == "ScheibenID" {
			idAt = i
		}
	}
	cells := make([]sql.RawBytes, len(names))
	targets := make([]any, len(names))
	for i := range cells {
		targets[i] = &cells[i]
	}
	for rows.Next() {
		if err := rows.Scan(targets...); err != nil {
			return err
		}
		id, err := strconv.ParseInt(string(cells[idAt]), 10, 32)
		if err != nil {
			return codeError("scheiben-id-invalid")
		}
		row := make(contract.Row, len(names))
		for i, name := range names {
			if cells[i] == nil {
				row[name] = nil
				continue
			}
			text := string(cells[i])
			row[name] = &text
		}
		data, ok := cards[int32(id)]
		if !ok {
			continue
		}
		t := tableOf(&data, key)
		t.Rows = append(t.Rows, row)
		cards[int32(id)] = data
	}
	return rows.Err()
}
