// Package contract ist der Vertrag Brücke ↔ Spiegel auf der Seite der Brücke: Snapshot v1, kanonische Form nach
// RFC 8785 und Prüfsumme. Die Spezifikation steht in vault/spiegel/spiegel-ingest-contract.md, verbindlich sind die
// Testvektoren in packages/ingest-contract (aus einer unabhängigen Python-Implementierung).
package contract

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// ErrMalformed: ein String ist kein wohlgeformtes UTF-8. Die Brücke ersetzt nichts still (encoding/json machte U+FFFD
// daraus), sie schickt die Scheibe nicht.
var ErrMalformed = errors.New("malformed-string")

// CompareUTF16 vergleicht nach UTF-16-Codeeinheiten wie RFC 8785 (und JavaScript `<`). Go vergleicht Strings nach
// UTF-8-Bytes; das weicht ab, sobald ein Zeichen über U+FFFF auf eines zwischen U+E000 und U+FFFF trifft.
func CompareUTF16(a, b string) int {
	ua, ub := utf16.Encode([]rune(a)), utf16.Encode([]rune(b))
	for i := 0; i < len(ua) && i < len(ub); i++ {
		if ua[i] != ub[i] {
			if ua[i] < ub[i] {
				return -1
			}
			return 1
		}
	}
	switch {
	case len(ua) < len(ub):
		return -1
	case len(ua) > len(ub):
		return 1
	}
	return 0
}

// UTF16Len zählt wie JavaScript `length`: Ein Zeichen über U+FFFF zählt doppelt.
func UTF16Len(s string) int {
	n := 0
	for _, r := range s {
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

// writeString schreibt einen String wie ECMAScript `JSON.stringify`: escapet werden nur `"`, `\` und Steuerzeichen
// unter U+0020; `/`, U+007F, U+2028, `<`, `>`, `&` und alles Nicht-ASCII bleiben roh.
func writeString(b *strings.Builder, s string) error {
	if !utf8.ValidString(s) {
		return ErrMalformed
	}
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\t':
			b.WriteString(`\t`)
		case '\n':
			b.WriteString(`\n`)
		case '\f':
			b.WriteString(`\f`)
		case '\r':
			b.WriteString(`\r`)
		default:
			if r < 0x20 {
				fmt.Fprintf(b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return nil
}

// Canonical serialisiert einen JSON-Wert aus Strings, null, Objekten und Arrays kanonisch (RFC 8785). Andere Typen
// (Zahlen, Wahrheitswerte) kommen im gehashten Teil eines Snapshots nicht vor und sind ein Fehler.
func Canonical(v any) (string, error) {
	var b strings.Builder
	if err := writeValue(&b, v); err != nil {
		return "", err
	}
	return b.String(), nil
}

func writeValue(b *strings.Builder, v any) error {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case string:
		return writeString(b, x)
	case *string:
		if x == nil {
			b.WriteString("null")
			return nil
		}
		return writeString(b, *x)
	case []any:
		b.WriteByte('[')
		for i, item := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeValue(b, item); err != nil {
				return err
			}
		}
		b.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool { return CompareUTF16(keys[i], keys[j]) < 0 })
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeString(b, k); err != nil {
				return err
			}
			b.WriteByte(':')
			if err := writeValue(b, x[k]); err != nil {
				return err
			}
		}
		b.WriteByte('}')
	default:
		return fmt.Errorf("kein Wert des Vertrags: %T", v)
	}
	return nil
}
