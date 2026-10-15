package api

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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
	if _, err := c.Heartbeat(ctx, Heartbeat{}); err == nil || err.(*Error).Status != 401 {
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

func TestNoRedirectAndRetryCap(t *testing.T) {
	var hits []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits = append(hits, r.URL.Path+" "+r.Header.Get("authorization"))
		if r.URL.Path == "/api/ingest/v1/state" {
			http.Redirect(w, r, "/anderswo", http.StatusFound)
			return
		}
		w.Header().Set("retry-after", "86400")
		w.WriteHeader(503)
	}))
	defer server.Close()
	c, _ := New(strings.Replace(server.URL, "127.0.0.1", "localhost", 1), "spgl_x")
	_, err := c.State(context.Background())
	if err == nil || len(hits) != 1 {
		t.Fatalf("Weiterleitung gefolgt: %v %v", hits, err)
	}
	_, err = c.Heartbeat(context.Background(), Heartbeat{})
	if e, ok := err.(*Error); !ok || e.RetryAfter != MaxRetryAfter {
		t.Fatalf("%#v", err)
	}
}

// die Dateien des Vertrags (packages/ingest-contract), nie kopiert
var contractDir = filepath.Join("..", "..", "..", "..", "packages", "ingest-contract")

func readContract(t *testing.T, rel string) []byte {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(contractDir, rel))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// Die Antwort auf den Heartbeat trägt die Uhr von Spiegel; an ihr misst die Brücke ihre eigene (SF-79).
func TestHeartbeatServerTime(t *testing.T) {
	body := readContract(t, "examples/api-v1/heartbeat-response.json")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-test") == "kaputt" {
			w.Write([]byte(`{}`))
			return
		}
		w.Write(body)
	}))
	defer server.Close()
	c, _ := New(strings.Replace(server.URL, "127.0.0.1", "localhost", 1), "spgl_x")
	at, err := c.Heartbeat(context.Background(), Heartbeat{})
	if err != nil || !at.Equal(time.Date(2026, 10, 13, 18, 12, 0, 93_000_000, time.UTC)) {
		t.Fatalf("%v %v", at, err)
	}
	// ohne `serverTime` keine Messung: ein Fehler, keine Nullzeit
	c.http.Transport = headerTransport{"x-test", "kaputt"}
	if _, err := c.Heartbeat(context.Background(), Heartbeat{}); err == nil || err.(*Error).Code != "response-invalid" {
		t.Fatalf("%v", err)
	}
}

type headerTransport struct{ key, value string }

func (h headerTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	r.Header.Set(h.key, h.value)
	return http.DefaultTransport.RoundTrip(r)
}

// Welche Ergebnisse endgültig sind, steht im Vektor des Vertrags (von Hand aus der Spezifikation).
func TestFinalFromContractVector(t *testing.T) {
	var vector struct {
		SnapshotOutcomes map[string]string `json:"snapshotOutcomes"`
	}
	if err := json.Unmarshal(readContract(t, "test-vectors/api-v1.json"), &vector); err != nil {
		t.Fatal(err)
	}
	if len(vector.SnapshotOutcomes) == 0 {
		t.Fatal("Vektor leer")
	}
	for outcome, kind := range vector.SnapshotOutcomes {
		if got := (Result{Outcome: outcome}).Final(); got != (kind == "final") {
			t.Errorf("%s: Final %v, Vektor %s", outcome, got, kind)
		}
	}
	var res struct {
		Results []Result `json:"results"`
	}
	if err := json.Unmarshal(readContract(t, "examples/api-v1/snapshots-response.past.json"), &res); err != nil {
		t.Fatal(err)
	}
	if res.Results[0].Outcome != "past" || res.Results[0].Final() || !res.Results[1].Final() {
		t.Fatalf("%+v", res.Results)
	}
}

// Eine Uhr vor dem Beginn des Zertifikats (Pi ohne fake-hwclock: 1970) lässt TLS scheitern; das sagt der Code. Ein
// wirklich abgelaufenes Zertifikat heißt anders: Die Uhr am Gerät ist dann nicht schuld.
func TestTLSCertificateTime(t *testing.T) {
	now := time.Now()
	for _, c := range []struct {
		from, until time.Time
		code        string
	}{
		{now.Add(24 * time.Hour), now.Add(48 * time.Hour), "tls-time"},
		{now.Add(-48 * time.Hour), now.Add(-24 * time.Hour), "tls-expired"},
	} {
		if got := tlsError(t, c.from, c.until); got != c.code {
			t.Errorf("gültig %s bis %s: %s, erwartet %s", c.from.Format(time.DateOnly), c.until.Format(time.DateOnly), got, c.code)
		}
	}
}

// tlsError fragt einen Server mit einem Zertifikat, dem der Client vertraut, das aber nur in dieser Zeit gilt
func tlsError(t *testing.T, from, until time.Time) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "spiegel.test"},
		NotBefore:             from,
		NotAfter:              until,
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, _ := x509.ParseCertificate(der)
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	server.TLS = &tls.Config{Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}}
	server.Config.ErrorLog = log.New(io.Discard, "", 0)
	server.StartTLS()
	defer server.Close()
	c, err := New(server.URL, "spgl_x")
	if err != nil {
		t.Fatal(err)
	}
	// dem Zertifikat vertrauen: Es geht nur um die Zeit
	pool := x509.NewCertPool()
	pool.AddCert(cert)
	c.http.Transport = &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool}}
	_, err = c.State(context.Background())
	if err == nil {
		return "kein Fehler"
	}
	return err.Error()
}
