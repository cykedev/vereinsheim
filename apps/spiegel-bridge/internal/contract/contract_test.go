package contract

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// Vektoren und Beispiele liegen im TypeScript-Paket des Vertrags; beide Seiten prüfen gegen dieselben Dateien.
var contractDir = filepath.Join("..", "..", "..", "..", "packages", "ingest-contract")

func readJSON(t *testing.T, rel string, into any) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(contractDir, rel))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, into); err != nil {
		t.Fatalf("%s: %v", rel, err)
	}
}

type vector struct {
	Name                  string `json:"name"`
	Data                  Data   `json:"data"`
	Canonical             string `json:"canonical"`
	Checksum              string `json:"checksum"`
	SameChecksumAs        string `json:"sameChecksumAs"`
	DifferentChecksumFrom string `json:"differentChecksumFrom"`
}

func TestChecksumVectors(t *testing.T) {
	var file struct {
		Vectors []vector `json:"vectors"`
	}
	readJSON(t, "test-vectors/checksum-v1.json", &file)
	if len(file.Vectors) < 13 {
		t.Fatalf("nur %d Vektoren", len(file.Vectors))
	}
	sums := map[string]string{}
	for _, v := range file.Vectors {
		canonical, err := CanonicalData(v.Data)
		if err != nil {
			t.Fatalf("%s: %v", v.Name, err)
		}
		if canonical != v.Canonical {
			t.Errorf("%s: kanonische Form\n got  %q\n want %q", v.Name, canonical, v.Canonical)
		}
		sum, _ := Checksum(v.Data)
		if sum != v.Checksum {
			t.Errorf("%s: Prüfsumme %s statt %s", v.Name, sum, v.Checksum)
		}
		sums[v.Name] = sum
	}
	for _, v := range file.Vectors {
		if v.SameChecksumAs != "" && sums[v.Name] != sums[v.SameChecksumAs] {
			t.Errorf("%s: sollte dieselbe Prüfsumme haben wie %s", v.Name, v.SameChecksumAs)
		}
		if v.DifferentChecksumFrom != "" && sums[v.Name] == sums[v.DifferentChecksumFrom] {
			t.Errorf("%s: sollte sich von %s unterscheiden", v.Name, v.DifferentChecksumFrom)
		}
	}
}

func TestEncodingJSONWouldFail(t *testing.T) {
	// Gegenprobe zur eigenen Serialisierung: encoding/json escapet <, > und U+2028, die kanonische Form nicht
	s := "a<b>& "
	canonical, _ := Canonical(s)
	marshalled, _ := json.Marshal(s)
	if canonical == string(marshalled) {
		t.Fatal("encoding/json wäre hier kanonisch; der Test prüft nichts")
	}
	if canonical != "\"a<b>& \"" {
		t.Fatalf("kanonisch %q", canonical)
	}
}

func TestExamples(t *testing.T) {
	entries, err := os.ReadDir(filepath.Join(contractDir, "examples", "v1"))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		rel := filepath.Join("examples", "v1", e.Name())
		var snapshot Snapshot
		readJSON(t, rel, &snapshot)
		if err := Validate(snapshot); err != nil {
			t.Errorf("%s: %v", e.Name(), err)
		}
		// Rundreise: dieselben Feldnamen und Werte wie im Schema, nichts verloren
		var original, again any
		readJSON(t, rel, &original)
		out, err := json.Marshal(snapshot)
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(out, &again); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(original, again) {
			t.Errorf("%s: Rundreise weicht ab", e.Name())
		}
	}
}

// Fälle aus invalid-v1.json, die eine Brücke selbst bauen könnte und deshalb selbst verhindern muss. Die übrigen
// (Zahl statt Text, Wert vom falschen Typ, fehlendes Feld, einzelnes Surrogat) lässt ihr Typsystem nicht zu.
var producible = []string{
	"zeile-ohne-spalte",
	"zeile-mit-fremder-spalte",
	"zwei-scheiben-zeilen",
	"keine-scheiben-zeile",
	"leere-spaltenliste",
	"tabelle-fehlt",
	"zelle-zu-lang",
	"zelle-zu-lang-utf16",
	"falsche-pruefsumme",
	"data-nach-pruefsumme-geaendert",
	"pruefsumme-ohne-praefix",
	"vertragsversion-2",
	"folgenummer-null",
	"beobachtungszeit-mit-versatz",
	"beobachtungszeit-ohne-millisekunden",
	"unbekannte-quelle",
	"zeile-mit-vertauschter-spalte",
	"spaltentyp-zu-lang",
	"spaltenname-leer",
	"proto-in-zeile",
	"proto-als-spalte",
}

func TestInvalidCases(t *testing.T) {
	var file struct {
		Cases []struct {
			Name     string          `json:"name"`
			Snapshot json.RawMessage `json:"snapshot"`
		} `json:"cases"`
	}
	readJSON(t, "test-vectors/invalid-v1.json", &file)
	byName := map[string]json.RawMessage{}
	for _, c := range file.Cases {
		byName[c.Name] = c.Snapshot
	}
	for _, name := range producible {
		raw, ok := byName[name]
		if !ok {
			t.Errorf("%s fehlt in invalid-v1.json", name)
			continue
		}
		var snapshot Snapshot
		if err := json.Unmarshal(raw, &snapshot); err != nil {
			t.Errorf("%s: nicht als Snapshot lesbar: %v", name, err)
			continue
		}
		if err := Validate(snapshot); err == nil {
			t.Errorf("%s: gilt als gültig", name)
		}
	}
}

func TestInvalidUTF8NeverPasses(t *testing.T) {
	bad := string([]byte{'M', 0xff, 'r'})
	if _, err := Canonical(bad); err != ErrMalformed {
		t.Fatalf("Fehler %v", err)
	}
	v := "1"
	d := Data{
		Scheiben: Table{Columns: map[string]string{"ScheibenID": "int(11)", "Nachname": "varchar(36)"}, Rows: []Row{{"ScheibenID": &v, "Nachname": &bad}}},
		Serien:   Table{Columns: map[string]string{"ScheibenID": "int(11)"}, Rows: []Row{}},
		Treffer:  Table{Columns: map[string]string{"ScheibenID": "int(11)"}, Rows: []Row{}},
	}
	err := ValidateData(d)
	if err == nil || !strings.Contains(err.Error(), "malformed-string") || strings.Contains(err.Error(), "Nachname") {
		t.Fatalf("Fehler %v", err)
	}
}

func TestUTF16(t *testing.T) {
	if UTF16Len("a\U0001F3AF") != 3 {
		t.Fatal("U+1F3AF zählt doppelt")
	}
	// U+1F3AF (Surrogate D83C …) liegt in UTF-16 vor U+FB01, in UTF-8 dahinter
	if CompareUTF16("\U0001F3AF", "ﬁ") >= 0 || "\U0001F3AF" < "ﬁ" {
		t.Fatal("Sortierung nach UTF-16")
	}
}
