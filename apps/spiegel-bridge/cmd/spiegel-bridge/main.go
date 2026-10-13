// spiegel-bridge liest die Meyton-Ablage (SSMDB2) und baut Snapshots für Spiegel (ADR-027, vault/spiegel/spiegel-bridge.md).
// Teil a (SP-1.4 a): nur lokal, ohne Upload.
//
//	spiegel-bridge watch --dsn 'user:pass@tcp(192.168.10.200:3306)/SSMDB2'   im Takt lesen, je Snapshot eine Zeile
//	spiegel-bridge watch --once --json                                       eine Runde, volle Snapshots als JSON
//	spiegel-bridge version
//
// Die DSN kommt auch aus SPIEGEL_BRIDGE_DSN. Auf die Platte schreibt die Brücke nichts.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/ssmdb2"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/watch"
)

// version setzt der Build (`-ldflags "-X main.version=…"`).
var version = "dev"

const (
	busyEvery  = time.Second
	quietEvery = 30 * time.Second
	// nach einem Fehler: erst kurz, dann bis zum ruhigen Takt (Anlage aus, Server startet noch)
	retryFirst = 5 * time.Second
)

func main() {
	if len(os.Args) < 2 {
		usage(os.Stderr)
		os.Exit(2)
	}
	switch os.Args[1] {
	case "version":
		fmt.Println(version)
	case "watch":
		os.Exit(runWatch(os.Args[2:], os.Stdout, os.Stderr))
	default:
		usage(os.Stderr)
		os.Exit(2)
	}
}

func usage(w io.Writer) {
	fmt.Fprintln(w, "spiegel-bridge watch [--dsn DSN] [--epoch N] [--once] [--json] | spiegel-bridge version")
}

// logger schreibt Meldungen nur mit Zahlen und festen Codes (SF-59).
type logger struct{ w io.Writer }

func (l logger) log(code string, pairs ...any) {
	line := time.Now().UTC().Format(time.RFC3339) + " " + code
	for i := 0; i+1 < len(pairs); i += 2 {
		line += fmt.Sprintf(" %v=%v", pairs[i], pairs[i+1])
	}
	fmt.Fprintln(l.w, line)
}

func runWatch(args []string, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("watch", flag.ContinueOnError)
	flags.SetOutput(stderr)
	dsn := flags.String("dsn", os.Getenv("SPIEGEL_BRIDGE_DSN"), "Zugang zur SSMDB2 (go-sql-driver/mysql)")
	epoch := flags.Int("epoch", watch.Defaults.Epoch, "Epoche der Quelle")
	once := flags.Bool("once", false, "nur eine Runde")
	asJSON := flags.Bool("json", false, "volle Snapshots als JSON-Zeilen (enthalten Namen)")
	maxCards := flags.Int("max-cards", watch.Defaults.MaxCards, "höchstens so viele Scheiben je Runde ganz lesen")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	log := logger{stderr}
	if *dsn == "" {
		log.log("dsn-missing")
		return 2
	}
	reader, err := ssmdb2.Open(*dsn)
	if err != nil {
		log.log("dsn-invalid")
		return 2
	}
	defer reader.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := watch.Defaults
	cfg.Epoch, cfg.MaxCards = *epoch, *maxCards
	w := watch.New(cfg, nil)
	out := json.NewEncoder(stdout)
	out.SetEscapeHTML(false)
	log.log("start", "version", version, "epoch", cfg.Epoch)

	failures := 0
	for {
		began := time.Now()
		roundCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		result, err := w.Tick(roundCtx, reader)
		cancel()
		took := time.Since(began)
		wait := quietEvery
		switch {
		case ctx.Err() != nil:
			log.log("stop")
			return 0
		case err != nil:
			failures++
			// nie als Löschung werten: die Runde zählt nicht (SF-24)
			log.log("round-failed", "code", ssmdb2.Code(err), "failures", failures)
			wait = min(retryFirst*time.Duration(failures), quietEvery)
			if *once {
				return 1
			}
		default:
			failures = 0
			for _, s := range result.Snapshots {
				if *asJSON {
					if err := out.Encode(s); err != nil {
						return 1
					}
				} else {
					fmt.Fprintln(stdout, s.Summary())
				}
			}
			for _, skip := range result.Skipped {
				log.log("card-skipped", "scheibe", skip.ID, "code", skip.Code)
			}
			// eine Zeile je Runde mit Ergebnis, nicht je Sekunde, solange nur gelesen wird
			if len(result.Snapshots) > 0 {
				log.log("round", "cards", result.Cards, "read", result.Read, "snapshots", len(result.Snapshots), "ms", took.Milliseconds())
			}
			if result.Busy {
				wait = busyEvery
			}
		}
		if *once {
			return 0
		}
		// eine langsame Abfrage streckt den Takt, statt die Anlage zu bremsen
		wait = max(wait, 2*took)
		select {
		case <-ctx.Done():
			log.log("stop")
			return 0
		case <-time.After(wait):
		}
	}
}
