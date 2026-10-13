// spiegel-bridge liest die Meyton-Ablage (SSMDB2) und bringt Snapshots zu Spiegel (ADR-027, vault/spiegel/spiegel-bridge.md).
//
//	spiegel-bridge pair --url https://spiegel.example --code ABCDE-FGHJK --dsn 'user:pass@tcp(192.168.10.200:3306)/SSMDB2'
//	spiegel-bridge run                                                       Betrieb: lesen, filtern, hochladen, Heartbeat
//	spiegel-bridge watch --dsn …                                             nur lokal lesen, je Snapshot eine Zeile
//	spiegel-bridge version
//
// `--config` nennt die Konfiguration (sonst /etc/spiegel-bridge/config.json bzw. %ProgramData%); sie ist das Einzige,
// was die Brücke auf die Platte schreibt, und nur beim Koppeln. Die DSN für `watch` auch aus SPIEGEL_BRIDGE_DSN.
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/api"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/config"
	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/run"
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
	case "pair":
		os.Exit(runPair(os.Args[2:], os.Stdout, os.Stderr))
	case "run":
		os.Exit(runRun(os.Args[2:], os.Stderr))
	default:
		usage(os.Stderr)
		os.Exit(2)
	}
}

func usage(w io.Writer) {
	fmt.Fprintln(w, "spiegel-bridge pair --url URL --code CODE --dsn DSN [--name NAME] [--config PATH]")
	fmt.Fprintln(w, "spiegel-bridge run [--config PATH]")
	fmt.Fprintln(w, "spiegel-bridge watch [--dsn DSN] [--epoch N] [--once] [--json]")
	fmt.Fprintln(w, "spiegel-bridge version")
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
	// die Umgebung erst nach dem Lesen der Optionen: als Vorgabe stünde das Passwort in der Hilfe (SF-59)
	dsn := flags.String("dsn", "", "Zugang zur SSMDB2 (go-sql-driver/mysql; besser SPIEGEL_BRIDGE_DSN)")
	epoch := flags.Int("epoch", watch.Defaults.Epoch, "Epoche der Quelle")
	once := flags.Bool("once", false, "nur bis alles bestätigt ist (höchstens drei Runden im Sekundentakt)")
	asJSON := flags.Bool("json", false, "volle Snapshots als JSON-Zeilen (enthalten Namen)")
	maxCards := flags.Int("max-cards", watch.Defaults.MaxCards, "höchstens so viele Scheiben je Runde ganz lesen")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	if *dsn == "" {
		*dsn = os.Getenv("SPIEGEL_BRIDGE_DSN")
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
	// ein Snapshot braucht zwei gleiche Lesungen (SF-71): `--once` liest deshalb, bis nichts mehr wartet, höchstens dreimal
	onceRounds := 0
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
			onceRounds++
			if err != nil || !result.Busy || onceRounds >= 3 {
				return 0
			}
			wait = busyEvery
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

// runPair löst einen Kopplungscode ein und schreibt die Konfiguration. Vorher prüft es, ob sie sich schreiben lässt:
// Ein eingelöster Code ist verbraucht.
func runPair(args []string, stdout, stderr io.Writer) int {
	return pair(args, os.Stdin, stdout, stderr)
}

// readDSN liest den Zugang zur SSMDB2 als eine Zeile, wenn weder `--dsn` noch SPIEGEL_BRIDGE_DSN ihn nennen: Ein Passwort
// in der Befehlszeile stünde in `ps` und im Verlauf der Shell.
func readDSN(stdin io.Reader, stderr io.Writer) string {
	fmt.Fprint(stderr, "Zugang zur SSMDB2 (user:passwort@tcp(adresse:3306)/SSMDB2): ")
	line, _ := bufio.NewReader(stdin).ReadString('\n')
	return strings.TrimSpace(line)
}

func pair(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("pair", flag.ContinueOnError)
	flags.SetOutput(stderr)
	path := flags.String("config", config.DefaultPath(), "Ort der Konfiguration")
	url := flags.String("url", "", "Adresse von Spiegel (https://…)")
	code := flags.String("code", "", "Kopplungscode aus Admin → Anlage und Brücken")
	name := flags.String("name", "", "Name des Geräts (sonst der vom Admin)")
	dsn := flags.String("dsn", "", "Zugang zur SSMDB2 (besser SPIEGEL_BRIDGE_DSN oder abgefragt)")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	log := logger{stderr}
	// unter Windows gälten 0600 und 0700 nicht: Token und Passwort wären für jeden Benutzer lesbar
	if runtime.GOOS == "windows" {
		log.log("pair-unsupported-on-windows")
		return 2
	}
	if *url == "" || *code == "" {
		log.log("pair-arguments-missing")
		return 2
	}
	if *dsn == "" {
		*dsn = os.Getenv("SPIEGEL_BRIDGE_DSN")
	}
	if *dsn == "" {
		*dsn = readDSN(stdin, stderr)
	}
	if *dsn == "" {
		log.log("dsn-missing")
		return 2
	}
	if _, err := ssmdb2.Open(*dsn); err != nil {
		log.log("dsn-invalid")
		return 2
	}
	client, err := api.New(*url, "")
	if err != nil {
		log.log(err.Error())
		return 2
	}
	if err := config.CheckWritable(*path); err != nil {
		log.log(err.Error())
		return 1
	}
	var deviceName *string
	if *name != "" {
		deviceName = name
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	res, err := client.Pair(ctx, api.PairRequest{ContractVersion: 1, Code: *code, Name: deviceName, BridgeVersion: version})
	if err != nil {
		log.log("pair-failed", "code", err.Error())
		return 1
	}
	if err := config.Save(*path, config.Config{URL: *url, BridgeID: res.BridgeID, Token: res.Token, DSN: *dsn}); err != nil {
		// der Code ist verbraucht: neuen erzeugen und die Brücke in Spiegel widerrufen
		log.log("pair-config-failed", "code", err.Error(), "bridge", res.BridgeID)
		return 1
	}
	fmt.Fprintf(stdout, "gekoppelt: Brücke %d an %q\n", res.BridgeID, res.Site.Name)
	return 0
}

// runRun ist der Betrieb. Exit 3: Token widerrufen, neu koppeln.
func runRun(args []string, stderr io.Writer) int {
	flags := flag.NewFlagSet("run", flag.ContinueOnError)
	flags.SetOutput(stderr)
	path := flags.String("config", config.DefaultPath(), "Ort der Konfiguration")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	log := logger{stderr}
	cfg, err := config.Load(*path)
	if err != nil {
		log.log(err.Error())
		return 2
	}
	reader, err := ssmdb2.Open(cfg.DSN)
	if err != nil {
		log.log("dsn-invalid")
		return 2
	}
	defer reader.Close()
	client, err := api.New(cfg.URL, cfg.Token)
	if err != nil {
		log.log(err.Error())
		return 2
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	log.log("start", "version", version, "bridge", cfg.BridgeID)
	runner := run.New(version, reader, client, log.log, watch.Defaults, nil)
	if err := runner.Run(ctx); err != nil {
		if errors.Is(err, run.ErrUnauthorized) {
			log.log("unauthorized", "hint", "neu-koppeln")
			return 3
		}
		log.log("stopped", "code", err.Error())
		return 1
	}
	log.log("stop")
	return 0
}
