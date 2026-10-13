package contract

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"time"
)

// ContractVersion ist die Version des Vertrags, die diese Brücke schreibt.
const ContractVersion = 1

// Source ist die Art der Quelle; sie bestimmt den Adapter in Spiegel.
const Source = "meyton-ssmdb2"

// Row ist eine Zeile: Spaltenname → Text, wie MySQL ihn im Textprotokoll liefert, oder nil für NULL.
type Row map[string]*string

// Table ist eine Tabelle mit allen Spalten (`SELECT *`) und ihrem Typ aus information_schema.COLUMNS.COLUMN_TYPE.
type Table struct {
	Columns map[string]string `json:"columns"`
	Rows    []Row             `json:"rows"`
}

// Data ist der vollständige Stand einer Scheibe.
type Data struct {
	Scheiben Table `json:"scheiben"`
	Serien   Table `json:"serien"`
	Treffer  Table `json:"treffer"`
}

// Snapshot v1: Hülle und Daten einer Scheibe. Die Feldnamen sind die des JSON-Schemas
// (packages/ingest-contract/schema/snapshot-v1.schema.json).
type Snapshot struct {
	ContractVersion int     `json:"contractVersion"`
	Source          string  `json:"source"`
	SourceVersion   *string `json:"sourceVersion"`
	Epoch           int     `json:"epoch"`
	ScheibenID      int32   `json:"scheibenId"`
	Sequence        int64   `json:"sequence"`
	ObservedAt      string  `json:"observedAt"`
	SessionTimeZone string  `json:"sessionTimeZone"`
	Data            Data    `json:"data"`
	Checksum        string  `json:"checksum"`
}

// das `Z` steht hier wörtlich: Der Vertrag verlangt UTC, keinen Versatz
const observedLayout = "2006-01-02T15:04:05.000Z"

// ObservedAt formatiert eine Beobachtungszeit wie der Vertrag sie verlangt: UTC mit Millisekunden und `Z`.
func ObservedAt(ms int64) string {
	return time.UnixMilli(ms).UTC().Format(observedLayout)
}

// Summary beschreibt einen Snapshot in einer Zeile ohne Personenfelder (SF-59): für die Ausgabe vor Ort und Logs.
func (s Snapshot) Summary() string {
	return fmt.Sprintf("snapshot scheibe=%d serien=%d treffer=%d sequence=%d %s",
		s.ScheibenID, len(s.Data.Serien.Rows), len(s.Data.Treffer.Rows), s.Sequence, s.Checksum)
}

func tableValue(t Table) (map[string]any, error) {
	columns := make(map[string]any, len(t.Columns))
	for name, typ := range t.Columns {
		columns[name] = typ
	}
	type keyed struct {
		value map[string]any
		key   string
	}
	rows := make([]keyed, 0, len(t.Rows))
	for _, r := range t.Rows {
		value := make(map[string]any, len(r))
		for name, cell := range r {
			value[name] = cell
		}
		key, err := Canonical(value)
		if err != nil {
			return nil, err
		}
		rows = append(rows, keyed{value, key})
	}
	// Zeilen nach ihrer eigenen kanonischen Form: Reihenfolge der Abfrage ändert die Prüfsumme nicht
	sort.Slice(rows, func(i, j int) bool { return CompareUTF16(rows[i].key, rows[j].key) < 0 })
	sorted := make([]any, len(rows))
	for i, r := range rows {
		sorted[i] = r.value
	}
	return map[string]any{"columns": columns, "rows": sorted}, nil
}

// CanonicalData ist die kanonische Form von `data` mit sortierten Zeilen, über die die Prüfsumme läuft.
func CanonicalData(d Data) (string, error) {
	tables := map[string]any{}
	for name, t := range map[string]Table{"scheiben": d.Scheiben, "serien": d.Serien, "treffer": d.Treffer} {
		value, err := tableValue(t)
		if err != nil {
			return "", err
		}
		tables[name] = value
	}
	return Canonical(tables)
}

// Checksum = "sha256:" + Hex von SHA-256 über die UTF-8-Bytes der kanonischen Form von `data` (SF-27).
func Checksum(d Data) (string, error) {
	canonical, err := CanonicalData(d)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(canonical))
	return "sha256:" + hex.EncodeToString(sum[:]), nil
}
