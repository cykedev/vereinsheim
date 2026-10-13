package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
)

func TestCheckURL(t *testing.T) {
	for raw, ok := range map[string]bool{
		"https://spiegel.example":     true,
		"https://spiegel.example/":    true,
		"http://localhost:3012":       true,
		"http://127.0.0.1:3012":       true,
		"http://spiegel.example":      false,
		"ftp://spiegel.example":       false,
		"https://spiegel.example?x=1": false,
		"spiegel.example":             false,
	} {
		if _, err := CheckURL(raw); (err == nil) != ok {
			t.Errorf("%s: %v", raw, err)
		}
	}
}

func TestRequestsAndErrors(t *testing.T) {
	var seen []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.Method+" "+r.URL.Path+" "+r.Header.Get("authorization"))
		body, _ := io.ReadAll(r.Body)
		switch r.URL.Path {
		case "/api/ingest/v1/state":
			w.Write([]byte(`{"site":{"name":"SV Musterstadt","timeZone":"Europe/Berlin"},"epoch":null,"sportpass":{"salt":"00","hashes":[]},"blocked":[{"scheibenId":-5,"startedAt":"2026-10-09T17:20:41.381Z"}],"watermark":null}`))
		case "/api/ingest/v1/snapshots":
			// HTML-Zeichen bleiben im Körper roh
			if !strings.Contains(string(body), `"a<b>&"`) {
				t.Errorf("Körper %s", body)
			}
			w.Header().Set("retry-after", "7")
			w.WriteHeader(429)
			w.Write([]byte(`{"error":{"code":"rate-limited","message":"…","retryAfterSeconds":7}}`))
		case "/api/ingest/v1/heartbeat":
			w.WriteHeader(401)
			w.Write([]byte(`{"error":{"code":"unauthorized","message":"…"}}`))
		default:
			w.WriteHeader(500)
			w.Write([]byte(`kaputt`))
		}
	}))
	defer server.Close()
	c, err := New(strings.Replace(server.URL, "127.0.0.1", "localhost", 1), "spgl_x")
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	state, err := c.State(ctx)
	if err != nil || state.Epoch != nil || state.Blocked[0].ScheibenID != -5 || state.Blocked[0].StartedAt.Year() != 2026 {
		t.Fatalf("%+v %v", state, err)
	}
	v := "a<b>&"
	_, err = c.Snapshots(ctx, []contract.Snapshot{{Data: contract.Data{Scheiben: contract.Table{Rows: []contract.Row{{"x": &v}}}}}})
	apiErr, ok := err.(*Error)
	if !ok || apiErr.Status != 429 || apiErr.Code != "rate-limited" || apiErr.RetryAfter != 7*time.Second {
		t.Fatalf("%#v", err)
	}
	if err := c.Heartbeat(ctx, Heartbeat{}); err == nil || err.(*Error).Status != 401 {
		t.Fatalf("%v", err)
	}
	if seen[0] != "GET /api/ingest/v1/state Bearer spgl_x" {
		t.Fatalf("%v", seen)
	}
	// ohne Server: ein Code, kein Text mit Adresse
	server.Close()
	_, err = c.State(ctx)
	if err == nil || err.Error() != "network" {
		t.Fatalf("%v", err)
	}
}

func TestHeartbeatShape(t *testing.T) {
	raw, _ := json.Marshal(Heartbeat{HeldBack: []Held{}})
	for _, key := range []string{"contractVersion", "bridgeVersion", "runStartedAt", "sentAt", "status", "backlog", "lastDbContactAt", "queryMs", "sourceClockOffsetMs", "heldBack", "sourceFingerprint"} {
		if !strings.Contains(string(raw), `"`+key+`"`) {
			t.Errorf("%s fehlt", key)
		}
	}
}
