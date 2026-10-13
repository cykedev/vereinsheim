//go:build replay

// Abnahme der Brücke gegen die Sonderfälle aus packages/ssmdb2-cases (SP-1.4 a, D10): je Fall die Schritte in eine
// echte MariaDB spielen und nach jedem Schritt lesen wie im Betrieb, eine nicht flüchtige Lesung zweimal, eine
// flüchtige einmal. Nicht im Gate (braucht Docker):
//
//	pnpm --filter spiegel-bridge replay                     MariaDB 10.6 wie an der Vereinsanlage
//	REPLAY_DOCKER_IMAGE=mariadb:11 pnpm --filter spiegel-bridge replay
//	BRIDGE_TEST_DSN='root:…@tcp(127.0.0.1:3306)/' …         gegen einen laufenden Server (legt SSMDB2 neu an)
package ssmdb2

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/watch"
)

var casesDir = filepath.Join("..", "..", "..", "..", "packages", "ssmdb2-cases")

type expectedCase struct {
	ID       string `json:"id"`
	Readings []struct {
		Reading    int    `json:"reading"`
		ObservedAt string `json:"observedAt"`
		Transient  bool   `json:"transient"`
	} `json:"readings"`
	Cards []struct {
		ScheibenID   int32  `json:"scheibenId"`
		Bridge       string `json:"bridge"`
		SentReadings []int  `json:"sentReadings"`
	} `json:"cards"`
}

type frozenReading struct {
	Reading   int                 `json:"reading"`
	Snapshots []contract.Snapshot `json:"snapshots"`
}

func docker(t *testing.T, args ...string) string {
	t.Helper()
	out, err := exec.Command("docker", args...).CombinedOutput()
	if err != nil {
		t.Fatalf("docker %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

// server startet MariaDB in Docker und gibt die DSN ohne Datenbank zurück.
func server(t *testing.T) string {
	if dsn := os.Getenv("BRIDGE_TEST_DSN"); dsn != "" {
		return dsn
	}
	image := os.Getenv("REPLAY_DOCKER_IMAGE")
	if image == "" {
		image = "mariadb:10.6"
	}
	name := fmt.Sprintf("spiegel-bridge-replay-%d", os.Getpid())
	docker(t, "run", "-d", "--rm", "--name", name, "-e", "MARIADB_ROOT_PASSWORD=root", "-p", "127.0.0.1::3306", image, "--skip-ssl")
	t.Cleanup(func() { _ = exec.Command("docker", "rm", "-f", name).Run() })
	// bereit erst, wenn der eigentliche Server läuft (beim Start gehört der Socket einem Init-Server)
	for i := 0; ; i++ {
		if exec.Command("docker", "exec", name, "healthcheck.sh", "--connect", "--innodb_initialized").Run() == nil {
			break
		}
		if i > 90 {
			t.Fatalf("%s nach 90 s nicht bereit", image)
		}
		time.Sleep(time.Second)
	}
	port := docker(t, "port", name, "3306/tcp")
	return fmt.Sprintf("root:root@tcp(%s)/", port[strings.LastIndex(port, "\n")+1:])
}

// admin öffnet eine Verbindung, die mehrere Anweisungen auf einmal nimmt (Schema, Schritte); die Brücke selbst nie.
func admin(t *testing.T, dsn, database string) *sql.DB {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.DBName = database
	cfg.MultiStatements = true
	if err := cfg.Apply(mysql.Charset("utf8mb4", "")); err != nil {
		t.Fatal(err)
	}
	connector, err := mysql.NewConnector(cfg)
	if err != nil {
		t.Fatal(err)
	}
	db := sql.OpenDB(connector)
	t.Cleanup(func() { db.Close() })
	return db
}

func exec1(t *testing.T, db *sql.DB, statements string) {
	t.Helper()
	if _, err := db.Exec(statements); err != nil {
		t.Fatalf("SQL: %v\n%.300s", err, statements)
	}
}

func readFile(t *testing.T, path string) []byte {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// personal sammelt die Personenfelder der eingefrorenen Snapshots: Keine Ausgabe der Brücke darf sie enthalten (SF-59).
func personal(readings []frozenReading, into map[string]bool) {
	for _, r := range readings {
		for _, s := range r.Snapshots {
			for _, row := range s.Data.Scheiben.Rows {
				for _, column := range []string{"Nachname", "Vorname", "Verein", "SportpassID"} {
					if v := row[column]; v != nil && len(*v) > 2 && *v != "0" {
						into[*v] = true
					}
				}
			}
		}
	}
}

func TestReplayCases(t *testing.T) {
	dsn := server(t)
	root := admin(t, dsn, "")
	exec1(t, root, "DROP DATABASE IF EXISTS SSMDB2; CREATE DATABASE SSMDB2")
	db := admin(t, dsn, "SSMDB2")
	exec1(t, db, string(readFile(t, filepath.Join(casesDir, "schema", "ssmdb2.sql"))))

	cfg, _ := mysql.ParseDSN(dsn)
	cfg.DBName = "SSMDB2"
	reader, err := Open(cfg.FormatDSN())
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()

	entries, err := os.ReadDir(filepath.Join(casesDir, "cases", "v1"))
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	var output []string
	cases := 0
	for _, entry := range entries {
		dir := filepath.Join(casesDir, "cases", "v1", entry.Name())
		var expected expectedCase
		var frozen []frozenReading
		if err := json.Unmarshal(readFile(t, filepath.Join(dir, "expected.json")), &expected); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(readFile(t, filepath.Join(dir, "snapshots.json")), &frozen); err != nil {
			t.Fatal(err)
		}
		personal(frozen, names)
		steps, _ := filepath.Glob(filepath.Join(dir, "steps", "*.sql"))
		sort.Strings(steps)
		if len(steps) != len(expected.Readings) || len(frozen) != len(expected.Readings) {
			t.Fatalf("%s: %d Schritte, %d Lesungen", expected.ID, len(steps), len(expected.Readings))
		}

		t.Run(expected.ID, func(t *testing.T) {
			exec1(t, db, "DELETE FROM Scheiben; DELETE FROM Version")
			var clock time.Time
			w := watch.New(watch.Defaults, func() time.Time { return clock })
			sent := map[int32][]int{}
			for i, step := range steps {
				exec1(t, db, string(readFile(t, step)))
				reading := expected.Readings[i]
				clock, err = time.Parse(time.RFC3339Nano, reading.ObservedAt)
				if err != nil {
					t.Fatal(err)
				}
				frozenBy := map[int32]contract.Snapshot{}
				for _, s := range frozen[i].Snapshots {
					frozenBy[s.ScheibenID] = s
				}
				reads := 2
				if reading.Transient {
					reads = 1
				}
				for range reads {
					result, err := w.Tick(context.Background(), reader)
					if err != nil {
						t.Fatalf("Lesung %d: %s", reading.Reading, Code(err))
					}
					for _, skip := range result.Skipped {
						t.Errorf("Lesung %d: Scheibe %d übersprungen (%s)", reading.Reading, skip.ID, skip.Code)
					}
					for _, s := range result.Snapshots {
						output = append(output, s.Summary())
						sent[s.ScheibenID] = append(sent[s.ScheibenID], reading.Reading)
						if err := contract.Validate(s); err != nil {
							t.Errorf("Lesung %d, Scheibe %d: %v", reading.Reading, s.ScheibenID, err)
						}
						want, ok := frozenBy[s.ScheibenID]
						if !ok {
							t.Errorf("Lesung %d: Scheibe %d ist nicht eingefroren", reading.Reading, s.ScheibenID)
							continue
						}
						if s.Checksum != want.Checksum {
							got, _ := contract.CanonicalData(s.Data)
							exp, _ := contract.CanonicalData(want.Data)
							t.Errorf("Lesung %d, Scheibe %d: Prüfsumme weicht ab\n got  %.400s\n want %.400s", reading.Reading, s.ScheibenID, got, exp)
						}
						if s.SessionTimeZone != want.SessionTimeZone || *s.SourceVersion != *want.SourceVersion {
							t.Errorf("Lesung %d: Hülle %s/%v statt %s/%v", reading.Reading, s.SessionTimeZone, *s.SourceVersion, want.SessionTimeZone, *want.SourceVersion)
						}
					}
					clock = clock.Add(300 * time.Millisecond)
				}
			}
			for _, card := range expected.Cards {
				got := sent[card.ScheibenID]
				switch card.Bridge {
				case "senden", "auslassen":
					if !slices.Equal(got, card.SentReadings) && !(len(got) == 0 && len(card.SentReadings) == 0) {
						t.Errorf("Scheibe %d (%s): gesendet in Lesung %v, erwartet %v", card.ScheibenID, card.Bridge, got, card.SentReadings)
					}
				default:
					// Opt-in und Verdeckung filtert erst SP-1.5: hier nur, dass nichts Flüchtiges hinausgeht
					for _, n := range got {
						if expected.Readings[n-1].Transient {
							t.Errorf("Scheibe %d: flüchtige Lesung %d gesendet", card.ScheibenID, n)
						}
					}
				}
			}
		})
		cases++
	}
	if cases < 31 {
		t.Fatalf("nur %d Fälle", cases)
	}
	joined := strings.Join(output, "\n")
	for name := range names {
		if strings.Contains(joined, name) {
			t.Errorf("die Ausgabe enthält ein Personenfeld")
		}
	}
	t.Logf("%d Fälle, %d Snapshots", cases, len(output))
}

// Ein Meyton-Update fügt während des Laufs eine Spalte an (SF-25): Die Runde danach zählt nicht, die nächste liest die
// Spalten neu, und die neue Spalte reist mit.
func TestReplayColumnAddedWhileRunning(t *testing.T) {
	dsn := server(t)
	root := admin(t, dsn, "")
	exec1(t, root, "DROP DATABASE IF EXISTS SSMDB2; CREATE DATABASE SSMDB2")
	db := admin(t, dsn, "SSMDB2")
	exec1(t, db, string(readFile(t, filepath.Join(casesDir, "schema", "ssmdb2.sql"))))
	exec1(t, db, string(readFile(t, filepath.Join(casesDir, "cases", "v1", "SF-21", "steps", "01.sql"))))
	cfg, _ := mysql.ParseDSN(dsn)
	cfg.DBName = "SSMDB2"
	reader, err := Open(cfg.FormatDSN())
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	clock := time.Date(2026, 10, 13, 18, 0, 0, 0, time.UTC)
	w := watch.New(watch.Defaults, func() time.Time { return clock })
	tick := func() (watch.Result, error) {
		clock = clock.Add(time.Second)
		return w.Tick(context.Background(), reader)
	}
	if _, err := tick(); err != nil {
		t.Fatal(Code(err))
	}
	exec1(t, db, "ALTER TABLE Treffer ADD COLUMN Neu int(11) NOT NULL DEFAULT 7")
	if _, err := tick(); Code(err) != "columns-changed" {
		t.Fatalf("Fehler %q", Code(err))
	}
	var snapshots []contract.Snapshot
	for range 2 {
		result, err := tick()
		if err != nil {
			t.Fatal(Code(err))
		}
		snapshots = append(snapshots, result.Snapshots...)
	}
	if len(snapshots) != 1 {
		t.Fatalf("%d Snapshots", len(snapshots))
	}
	treffer := snapshots[0].Data.Treffer
	if treffer.Columns["Neu"] != "int(11)" || *treffer.Rows[0]["Neu"] != "7" {
		t.Fatalf("neue Spalte fehlt: %v", treffer.Columns)
	}
}
