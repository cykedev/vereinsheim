// Package config ist das Einzige, was die Brücke auf die Platte schreibt (ADR-027): Adresse von Spiegel, Geräte-Token
// und der Zugang zur SSMDB2. Geschrieben nur beim Koppeln, atomar und nur für den eigenen Benutzer lesbar.
package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"runtime"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/api"
)

// Config ist die Konfiguration einer gekoppelten Brücke.
type Config struct {
	URL      string `json:"url"`
	BridgeID int    `json:"bridgeId"`
	Token    string `json:"token"`
	DSN      string `json:"dsn"`
}

// tokenPattern wie `TOKEN_PATTERN` im Vertrag
var tokenPattern = regexp.MustCompile(`^spgl_[A-Za-z0-9_-]{43}$`)

// DefaultPath ist der Ort ohne `--config`.
func DefaultPath() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("ProgramData"), "spiegel-bridge", "config.json")
	}
	return "/etc/spiegel-bridge/config.json"
}

// Check prüft, ob die Konfiguration vollständig ist; Fehler ohne Inhalte.
func (c Config) Check() error {
	if _, err := api.CheckURL(c.URL); err != nil {
		return err
	}
	if !tokenPattern.MatchString(c.Token) {
		return errors.New("token-invalid")
	}
	if c.DSN == "" {
		return errors.New("dsn-missing")
	}
	return nil
}

// Load liest die Konfiguration.
func Load(path string) (Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Config{}, errors.New("config-missing")
		}
		return Config{}, errors.New("config-unreadable")
	}
	var c Config
	if err := json.Unmarshal(raw, &c); err != nil {
		return Config{}, errors.New("config-invalid")
	}
	return c, c.Check()
}

// Save schreibt die Konfiguration atomar: temporäre Datei mit 0600 im selben Verzeichnis, `fsync`, dann `rename`. Ein
// Stromausfall mitten im Schreiben lässt die alte Datei oder die neue, nie eine halbe.
func Save(path string, c Config) error {
	if err := c.Check(); err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return errors.New("config-dir")
	}
	raw, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".config-*.json")
	if err != nil {
		return errors.New("config-write")
	}
	defer os.Remove(tmp.Name())
	if err := tmp.Chmod(0o600); err != nil && runtime.GOOS != "windows" {
		tmp.Close()
		return errors.New("config-write")
	}
	if _, err := tmp.Write(append(raw, '\n')); err != nil {
		tmp.Close()
		return errors.New("config-write")
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return errors.New("config-write")
	}
	if err := tmp.Close(); err != nil {
		return errors.New("config-write")
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		return errors.New("config-write")
	}
	// auch das Verzeichnis: sonst kann nach einem Stromausfall die Datei fehlen, obwohl der Code schon verbraucht ist
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		d.Close()
	}
	return nil
}

// CheckWritable prüft vor dem Koppeln, ob sich die Konfiguration schreiben lässt (ein eingelöster Code ist verbraucht).
func CheckWritable(path string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return errors.New("config-dir")
	}
	tmp, err := os.CreateTemp(dir, ".config-*.json")
	if err != nil {
		return errors.New("config-write")
	}
	tmp.Close()
	return os.Remove(tmp.Name())
}
