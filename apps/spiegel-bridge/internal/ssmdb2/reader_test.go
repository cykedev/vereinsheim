package ssmdb2

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/watch"
)

func TestServerUnreachableIsACodeWithoutContent(t *testing.T) {
	// Port 1 auf dem eigenen Rechner: abgelehnt, sofort; so sieht eine ausgeschaltete Anlage aus
	reader, err := Open("Muster:geheim@tcp(127.0.0.1:1)/SSMDB2")
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	w := watch.New(watch.Defaults, nil)
	_, err = w.Tick(ctx, reader)
	if err == nil {
		t.Fatal("Fehler erwartet")
	}
	if code := Code(err); code != "connection" {
		t.Fatalf("Code %q", code)
	}
}

func TestCodes(t *testing.T) {
	server := &mysql.MySQLError{Number: 1146, Message: "Table 'SSMDB2.Muster' doesn't exist"}
	cases := map[string]error{
		"mysql-1146":      server,
		"timeout":         context.DeadlineExceeded,
		"columns-changed": ErrColumnsChanged,
		"table-missing":   codeError("table-missing"),
		"error":           errors.New("Muster"),
	}
	for want, err := range cases {
		if got := Code(err); got != want || strings.Contains(got, "Muster") {
			t.Errorf("%v: %q statt %q", err, got, want)
		}
	}
}

func TestOpenRejectsGarbage(t *testing.T) {
	if _, err := Open("kein dsn"); err == nil || strings.Contains(err.Error(), "kein") {
		t.Fatalf("%v", err)
	}
}
