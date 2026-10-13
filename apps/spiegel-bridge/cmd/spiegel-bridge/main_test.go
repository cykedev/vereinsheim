package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/config"
)

func TestPairWritesConfigOnlyOnSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Code string `json:"code"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if r.URL.Path != "/api/ingest/v1/pair" || req.Code != "ABCDE-FGHJK" {
			w.WriteHeader(400)
			w.Write([]byte(`{"error":{"code":"invalid-code","message":"…"}}`))
			return
		}
		w.Write([]byte(`{"bridgeId":4,"token":"spgl_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ","site":{"name":"SV Musterstadt","timeZone":"Europe/Berlin"}}`))
	}))
	defer server.Close()
	url := strings.Replace(server.URL, "127.0.0.1", "localhost", 1)
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	dsn := "u:p@tcp(192.168.10.200:3306)/SSMDB2"

	var out, errs bytes.Buffer
	if code := runPair([]string{"--config", path, "--url", url, "--code", "FALSCH-CODE", "--dsn", dsn}, &out, &errs); code != 1 {
		t.Fatalf("Exit %d", code)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("ein falscher Code schreibt nichts")
	}
	if !strings.Contains(errs.String(), "invalid-code") {
		t.Fatalf("%s", errs.String())
	}
	if code := runPair([]string{"--config", path, "--url", url, "--code", "ABCDE-FGHJK", "--dsn", dsn}, &out, &errs); code != 0 {
		t.Fatalf("Exit %d: %s", code, errs.String())
	}
	c, err := config.Load(path)
	if err != nil || c.BridgeID != 4 || c.DSN != dsn || c.URL != url {
		t.Fatalf("%+v %v", c, err)
	}
	if info, _ := os.Stat(path); runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("Rechte %v", info.Mode().Perm())
	}
	if strings.Contains(out.String()+errs.String(), "spgl_") {
		t.Fatal("das Token steht in der Ausgabe")
	}
}

func TestPairAsksForTheDSN(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"bridgeId":5,"token":"spgl_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ","site":{"name":"SV Musterstadt","timeZone":"Europe/Berlin"}}`))
	}))
	defer server.Close()
	t.Setenv("SPIEGEL_BRIDGE_DSN", "")
	path := filepath.Join(t.TempDir(), "config.json")
	url := strings.Replace(server.URL, "127.0.0.1", "localhost", 1)
	var out, errs bytes.Buffer
	stdin := strings.NewReader("u:geheim@tcp(192.168.10.200:3306)/SSMDB2\n")
	if code := pair([]string{"--config", path, "--url", url, "--code", "ABCDE-FGHJK"}, stdin, &out, &errs); code != 0 {
		t.Fatalf("Exit %d: %s", code, errs.String())
	}
	c, err := config.Load(path)
	if err != nil || c.DSN != "u:geheim@tcp(192.168.10.200:3306)/SSMDB2" {
		t.Fatalf("%+v %v", c, err)
	}
	if strings.Contains(out.String()+errs.String(), "geheim") {
		t.Fatal("das Passwort steht in der Ausgabe")
	}
}
