package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

const token = "spgl_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ"

func TestSaveLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sub", "config.json")
	c := Config{URL: "https://spiegel.example", BridgeID: 3, Token: token, DSN: "u:p@tcp(192.168.10.200:3306)/SSMDB2"}
	if err := Save(path, c); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("Rechte %v", info.Mode().Perm())
	}
	got, err := Load(path)
	if err != nil || got != c {
		t.Fatalf("%+v %v", got, err)
	}
	entries, _ := os.ReadDir(filepath.Dir(path))
	if len(entries) != 1 {
		t.Fatalf("temporäre Dateien übrig: %d", len(entries))
	}
}

func TestRejects(t *testing.T) {
	dir := t.TempDir()
	if err := Save(filepath.Join(dir, "a.json"), Config{URL: "http://spiegel.example", Token: token, DSN: "x"}); err == nil {
		t.Fatal("http ohne localhost")
	}
	if err := Save(filepath.Join(dir, "b.json"), Config{URL: "https://spiegel.example", Token: "geheim", DSN: "x"}); err == nil || err.Error() != "token-invalid" {
		t.Fatalf("%v", err)
	}
	if _, err := Load(filepath.Join(dir, "fehlt.json")); err == nil || err.Error() != "config-missing" {
		t.Fatalf("%v", err)
	}
	if err := CheckWritable(filepath.Join(dir, "c", "config.json")); err != nil {
		t.Fatal(err)
	}
}
