// Package api spricht die API v1 von Spiegel (packages/ingest-contract/src/v1/api.ts): Kopplung, Zustand, Stapel von
// Snapshots, Heartbeat. Pfade unter `/api/ingest/v1`, alles außer `pair` mit `Authorization: Bearer <token>`.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/cykedev/vereinsheim/apps/spiegel-bridge/internal/contract"
)

const prefix = "/api/ingest/v1"

// höchstens so viel Antwort lesen; der Zustand mit 100.000 Hashes wäre rund 7 MB
const maxResponseBytes = 16 << 20

// MaxRetryAfter begrenzt, wie lange die Brücke auf ein `Retry-After` wartet.
const MaxRetryAfter = 10 * time.Minute

// Site ist die Anlage, wie Spiegel sie kennt.
type Site struct {
	Name     string `json:"name"`
	TimeZone string `json:"timeZone"`
}

// PairRequest ist `POST /pair`.
type PairRequest struct {
	ContractVersion int     `json:"contractVersion"`
	Code            string  `json:"code"`
	Name            *string `json:"name"`
	BridgeVersion   string  `json:"bridgeVersion"`
}

// PairResponse ist die Antwort auf die Kopplung.
type PairResponse struct {
	BridgeID int    `json:"bridgeId"`
	Token    string `json:"token"`
	Site     Site   `json:"site"`
}

// Blocked ist ein Grabstein oder eine Löschsperre (SF-28).
type Blocked struct {
	ScheibenID int32     `json:"scheibenId"`
	StartedAt  time.Time `json:"startedAt"`
	// Epoche der Sperre (seit 13. Oktober 2026); nil von einem älteren Spiegel: gilt dann für jede
	Epoch *int `json:"epoch"`
}

// State ist `GET /state`: was die Brücke im Arbeitsspeicher hält.
type State struct {
	Site      Site `json:"site"`
	Epoch     *int `json:"epoch"`
	Sportpass struct {
		Salt   string   `json:"salt"`
		Hashes []string `json:"hashes"`
	} `json:"sportpass"`
	Blocked   []Blocked  `json:"blocked"`
	Watermark *time.Time `json:"watermark"`
	// offene Aufträge, ältere Scheiben einer Zustimmung nachzuladen (P2d, additiv); fehlt bei einem älteren Spiegel
	History []HistoryRequest `json:"history"`
}

// HistoryRequest ist ein Auftrag zum Nachladen: Id und `Since` meldet die Brücke zurück, der Hash wie
// `Sportpass.Hashes`. Ein neues `Since` derselben Id ist ein neuer Auftrag.
type HistoryRequest struct {
	ID            int    `json:"id"`
	Since         string `json:"since"`
	SportpassHash string `json:"sportpassHash"`
}

// HistoryDone ist ein erledigter Auftrag, wie er im Zustand stand.
type HistoryDone struct {
	ID    int    `json:"id"`
	Since string `json:"since"`
}

// Held zählt zurückgehaltene Scheiben einer Anzeigeart.
type Held struct {
	DisplayMode int `json:"displayMode"`
	Cards       int `json:"cards"`
}

// SourceFingerprint ist der Fingerabdruck der Quelle (SF-23), ohne Inhalte.
type SourceFingerprint struct {
	Version     *string `json:"version"`
	Scheiben    int     `json:"scheiben"`
	Treffer     int     `json:"treffer"`
	OldestStamp *string `json:"oldestStamp"`
}

// Heartbeat ist `POST /heartbeat`, einmal je Minute; nie Namen oder Nummern (SF-59).
type Heartbeat struct {
	ContractVersion     int                `json:"contractVersion"`
	BridgeVersion       string             `json:"bridgeVersion"`
	RunStartedAt        string             `json:"runStartedAt"`
	SentAt              string             `json:"sentAt"`
	Status              string             `json:"status"`
	Backlog             int                `json:"backlog"`
	LastDBContactAt     *string            `json:"lastDbContactAt"`
	QueryMs             *int               `json:"queryMs"`
	SourceClockOffsetMs *int64             `json:"sourceClockOffsetMs"`
	HeldBack            []Held             `json:"heldBack"`
	SourceFingerprint   *SourceFingerprint `json:"sourceFingerprint"`
	// erledigte Aufträge zum Nachladen (P2d, additiv): nur Ids, nie Nummern (SF-59)
	HistoryDone []HistoryDone `json:"historyDone,omitempty"`
}

// Result ist das Ergebnis eines Snapshots im Stapel.
type Result struct {
	Index      int    `json:"index"`
	ScheibenID int32  `json:"scheibenId"`
	Outcome    string `json:"outcome"`
	Reason     string `json:"reason,omitempty"`
}

// Final: Bis auf `future` und `epoch-unconfirmed` schickt die Brücke denselben Stand nicht noch einmal.
func (r Result) Final() bool { return r.Outcome != "future" && r.Outcome != "epoch-unconfirmed" }

// Error ist eine Antwort von Spiegel mit Fehlercode, oder ein Fehler auf dem Weg dorthin (Status 0).
type Error struct {
	Status     int
	Code       string
	RetryAfter time.Duration
	// bei `invalid`: Pfad und Code, nie Inhalte
	Issues []struct {
		Path string `json:"path"`
		Code string `json:"code"`
	}
}

func (e *Error) Error() string {
	if e.Status == 0 {
		return e.Code
	}
	return fmt.Sprintf("%d %s", e.Status, e.Code)
}

// Client spricht mit einer Instanz von Spiegel.
type Client struct {
	base  string
	token string
	http  *http.Client
}

// CheckURL lässt nur HTTPS zu, `http://` nur für den eigenen Rechner (Entwicklung).
func CheckURL(raw string) (string, error) {
	u, err := url.Parse(strings.TrimRight(raw, "/"))
	if err != nil || u.Host == "" || u.RawQuery != "" || u.Fragment != "" {
		return "", errors.New("url-invalid")
	}
	switch u.Scheme {
	case "https":
	case "http":
		host := u.Hostname()
		if host != "localhost" && host != "127.0.0.1" && host != "::1" {
			return "", errors.New("url-not-https")
		}
	default:
		return "", errors.New("url-invalid")
	}
	return u.String(), nil
}

// New legt einen Client an; `token` leer nur für die Kopplung.
func New(base, token string) (*Client, error) {
	checked, err := CheckURL(base)
	if err != nil {
		return nil, err
	}
	return &Client{base: checked, token: token, http: &http.Client{
		Timeout: 60 * time.Second,
		// keine Weiterleitung: Sie könnte das Token an eine andere Adresse oder über http tragen
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}, nil
}

func (c *Client) do(ctx context.Context, method, path string, body any, into any) error {
	var reader io.Reader
	if body != nil {
		raw, err := marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+prefix+path, reader)
	if err != nil {
		return &Error{Code: "request"}
	}
	if body != nil {
		req.Header.Set("content-type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("authorization", "Bearer "+c.token)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return transportError(err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxResponseBytes))
	if err != nil {
		return transportError(err)
	}
	if res.StatusCode >= 200 && res.StatusCode < 300 {
		if into == nil {
			return nil
		}
		if err := json.Unmarshal(raw, into); err != nil {
			return &Error{Status: res.StatusCode, Code: "response-invalid"}
		}
		return nil
	}
	apiErr := &Error{Status: res.StatusCode, Code: "http"}
	var parsed struct {
		Error struct {
			Code              string `json:"code"`
			RetryAfterSeconds int    `json:"retryAfterSeconds"`
		} `json:"error"`
		Issues []struct {
			Path string `json:"path"`
			Code string `json:"code"`
		} `json:"issues"`
	}
	if json.Unmarshal(raw, &parsed) == nil && parsed.Error.Code != "" {
		apiErr.Code = parsed.Error.Code
		apiErr.Issues = parsed.Issues
		if parsed.Error.RetryAfterSeconds > 0 {
			apiErr.RetryAfter = time.Duration(parsed.Error.RetryAfterSeconds) * time.Second
		}
	}
	if seconds, err := strconv.Atoi(res.Header.Get("retry-after")); err == nil && seconds > 0 {
		apiErr.RetryAfter = time.Duration(seconds) * time.Second
	}
	// eine fehlerhafte Antwort darf die Brücke nicht für Tage anhalten
	apiErr.RetryAfter = min(apiErr.RetryAfter, MaxRetryAfter)
	return apiErr
}

// transportError beschreibt einen Fehler auf dem Weg, ohne seinen Text (er kann die Adresse samt Token-Teilen nennen).
func transportError(err error) error {
	var netErr net.Error
	switch {
	case errors.Is(err, context.Canceled):
		return &Error{Code: "canceled"}
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &netErr) && netErr.Timeout():
		return &Error{Code: "timeout"}
	default:
		return &Error{Code: "network"}
	}
}

// marshal schreibt JSON ohne HTML-Escapes (Strings bleiben, wie sie sind; die Prüfsumme rechnet ohnehin über die
// kanonische Form).
func marshal(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}

// Size ist die Größe eines Snapshots im Stapel (für die Bytegrenze).
func Size(s contract.Snapshot) int {
	raw, err := marshal(s)
	if err != nil {
		return 0
	}
	return len(raw) + 1
}

// Pair löst einen Kopplungscode ein.
func (c *Client) Pair(ctx context.Context, req PairRequest) (PairResponse, error) {
	var res PairResponse
	err := c.do(ctx, http.MethodPost, "/pair", req, &res)
	return res, err
}

// State holt den Zustand der Brücke.
func (c *Client) State(ctx context.Context) (State, error) {
	var res State
	err := c.do(ctx, http.MethodGet, "/state", nil, &res)
	return res, err
}

// Snapshots schickt einen Stapel (1 bis 50).
func (c *Client) Snapshots(ctx context.Context, snapshots []contract.Snapshot) ([]Result, error) {
	var res struct {
		Results []Result `json:"results"`
	}
	err := c.do(ctx, http.MethodPost, "/snapshots", map[string]any{"snapshots": snapshots}, &res)
	return res.Results, err
}

// Heartbeat meldet den Zustand der Brücke.
func (c *Client) Heartbeat(ctx context.Context, hb Heartbeat) error {
	return c.do(ctx, http.MethodPost, "/heartbeat", hb, nil)
}
