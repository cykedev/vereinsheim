package contract

import (
	"fmt"
	"time"
	"unicode/utf8"
)

// Grenzen des Vertrags (packages/ingest-contract/src/limits.ts). Längen zählen in UTF-16-Codeeinheiten.
const (
	MaxColumns          = 200
	MaxColumnNameLength = 64
	MaxColumnTypeLength = 64
	MaxCellLength       = 4096
	MaxSerienRows       = 200
	MaxTrefferRows      = 2000
	MaxShortTextLength  = 64
	MaxBatchSnapshots   = 50
)

// Issue ist ein Verstoß gegen den Vertrag, nur mit Ort und Code, nie mit Inhalt (SF-59).
type Issue struct {
	Path string
	Code string
}

func (i *Issue) Error() string { return fmt.Sprintf("%s: %s", i.Path, i.Code) }

func issue(path, code string) error { return &Issue{Path: path, Code: code} }

func shortText(path, s string, allowEmpty bool) error {
	if !utf8.ValidString(s) {
		return issue(path, "malformed-string")
	}
	if (!allowEmpty && s == "") || UTF16Len(s) > MaxShortTextLength {
		return issue(path, "length")
	}
	return nil
}

func validateTable(path string, t Table, minRows, maxRows int) error {
	if len(t.Columns) < 1 || len(t.Columns) > MaxColumns {
		return issue(path+".columns", "column-count")
	}
	for name, typ := range t.Columns {
		if !utf8.ValidString(name) || !utf8.ValidString(typ) {
			return issue(path+".columns", "malformed-string")
		}
		// `JSON.parse` legt __proto__ als Schlüssel an, Zod verwirft ihn still: Brücke und Spiegel rechneten verschiedene
		// Prüfsummen
		if name == "__proto__" {
			return issue(path+".columns", "forbidden-key")
		}
		if name == "" || UTF16Len(name) > MaxColumnNameLength || typ == "" || UTF16Len(typ) > MaxColumnTypeLength {
			return issue(path+".columns", "length")
		}
	}
	if len(t.Rows) < minRows || len(t.Rows) > maxRows {
		return issue(path+".rows", "row-count")
	}
	for i, r := range t.Rows {
		at := fmt.Sprintf("%s.rows[%d]", path, i)
		if len(r) != len(t.Columns) {
			return issue(at, "row-columns-mismatch")
		}
		for name, cell := range r {
			if _, ok := t.Columns[name]; !ok {
				return issue(at, "row-columns-mismatch")
			}
			if cell == nil {
				continue
			}
			if !utf8.ValidString(*cell) {
				return issue(at, "malformed-string")
			}
			if UTF16Len(*cell) > MaxCellLength {
				return issue(at, "length")
			}
		}
	}
	return nil
}

// ValidateData prüft, was die Brücke selbst verhindern muss: Zeilenzahlen, Spalten, Längen, wohlgeformtes Unicode,
// `__proto__`. Ein Fehler heißt: Diese Scheibe geht nicht hinaus.
func ValidateData(d Data) error {
	if err := validateTable("data.scheiben", d.Scheiben, 1, 1); err != nil {
		return err
	}
	if err := validateTable("data.serien", d.Serien, 0, MaxSerienRows); err != nil {
		return err
	}
	return validateTable("data.treffer", d.Treffer, 0, MaxTrefferRows)
}

// Validate prüft einen fertigen Snapshot: Hülle, Daten und Prüfsumme.
func Validate(s Snapshot) error {
	if s.ContractVersion != ContractVersion {
		return issue("contractVersion", "unsupported-contract-version")
	}
	if s.Source != Source {
		return issue("source", "invalid")
	}
	if s.SourceVersion != nil {
		if err := shortText("sourceVersion", *s.SourceVersion, false); err != nil {
			return err
		}
	}
	if s.Epoch < 1 {
		return issue("epoch", "invalid")
	}
	if s.Sequence < 1 {
		return issue("sequence", "invalid")
	}
	if _, err := time.Parse(observedLayout, s.ObservedAt); err != nil {
		return issue("observedAt", "invalid")
	}
	if err := shortText("sessionTimeZone", s.SessionTimeZone, false); err != nil {
		return err
	}
	if err := ValidateData(s.Data); err != nil {
		return err
	}
	sum, err := Checksum(s.Data)
	if err != nil {
		return issue("data", "malformed-string")
	}
	if sum != s.Checksum {
		return issue("checksum", "checksum-mismatch")
	}
	return nil
}
