# Spiegel-Brücke: Kopplung, Upload und Heartbeat (SP-1.4 b, mit den Filtern aus SP-1.5)

## Kontext

Auftrag des Users (13. Oktober 2026, autonom): weitere offene Themen. Teil a (`plans/2026-10-13-spiegel-bruecke-leser.md`)
liest und baut Snapshots, nur lokal. Teil b bringt sie zu Spiegel über die API v1, die seit SP-1.6 b steht
(`packages/ingest-contract/src/v1/api.ts`, `apps/spiegel/src/lib/ingest/http.ts`).

**Die Filter aus SP-1.5 kommen mit** (Zustimmung, Sperren, verdeckt): Ohne sie verließe jede Scheibe mit Namen das
Schützenhaus, und Spiegel verwürfe sie erst dort. Das widerspricht der Datensparsamkeit am Rand ([[adr-027]]). Die
Aufträge (`commands`) bleiben in SP-1.5.

## Entscheidungen

- **D1 Konfiguration**, das Einzige auf der Platte ([[adr-027]]): eine JSON-Datei mit Adresse von Spiegel, Brücken-Id,
  Geräte-Token und dem Zugang zur SSMDB2. Ort: `--config`, sonst `/etc/spiegel-bridge/config.json` bzw.
  `%ProgramData%\spiegel-bridge\config.json`. Geschrieben nur beim Koppeln, atomar (temporäre Datei, `rename`), Rechte
  0600. `http://` nur für `localhost`, sonst HTTPS.
- **D2 `spiegel-bridge pair --url … --code … --dsn …`**: `POST /pair`, dann die Konfiguration schreiben. Ein falscher
  Code schreibt nichts.
- **D3 `spiegel-bridge run`**: beim Start `GET /state` (ohne Zustand lädt die Brücke nichts hoch, SF-38; sie wartet und
  fragt erneut), danach alle 5 Minuten. Epoche aus dem Zustand (ohne bestätigte 1).
- **D4 Filter wie in Spiegel** (`internal/filter`), Regeln aus `ingest.ts` und `meyton-ssmdb2.ts` übernommen:
  - Zustimmung: `sportpassHash(salt, Scheiben.SportpassID)` steht in `state.sportpass.hashes`; der Hash wie
    `sportpassHash` im Vertrag, geprüft gegen `test-vectors/sportpass-v1.json`.
  - Verdeckt: ein Treffer mit `Wertung` 0, 5, 10 oder nicht lesbar hält die ganze Scheibe zurück (SF-19, SF-20); gezählt
    je Anzeigeart im Heartbeat (`heldBack`).
  - Gesperrt: Grabstein oder Löschsperre derselben ScheibenID mit Beginn bis 30 Tage um den Beginn der Scheibe (früheste
    plausible Schusszeit als Ortszeit, wie `startHintMs`), SF-28.
  - Was der Filter nicht durchlässt, gilt als erledigt; ändert sich der Zustand (neue Zustimmung, neue Epoche), schickt
    die Brücke die Scheiben, die sie noch im Speicher hat, erneut.
- **D5 Upload ohne Warteschlange**: Stapel bis 50 Snapshots und 3,5 MiB (Spiegel nimmt 4 MiB). Erst die Antwort macht
  einen Stand „gesendet“ (`Watcher.Delivered`); bis dahin wartet die Scheibe und wird jede Runde neu gelesen. Scheitert
  der Upload (Netz, 5xx), liest die Brücke beim nächsten Durchgang neu und schickt erneut (verzögert, Status
  `delayed`). 429 und 503: `Retry-After` abwarten (SF-58). 413: den Stapel teilen. 401: Token widerrufen, die Brücke
  hört auf und verlangt neues Koppeln. Ergebnisse: alle außer `future` und `epoch-unconfirmed` sind endgültig.
- **D6 Lebenszeichen gedrosselt**: Unterscheidet sich ein Stand vom zuletzt gesendeten nur in `Scheiben.Zeitstempel`,
  geht er höchstens alle 30 s hinaus ([[spiegel-bridge]], Empfehlung vom 13. Oktober 2026); Schüsse sofort.
- **D7 Heartbeat** jede Minute, der erste gleich nach der ersten Runde: Status (`ok`, `delayed`, `db-unreachable`,
  `db-error`), Rückstau (wartende Scheiben), letzter Kontakt zur Ablage, Dauer der Runde, Uhrabweichung der Anlage
  (`NOW(3)` in UTC gegen die Uhr der Brücke, SF-29), zurückgehaltene Scheiben je Anzeigeart, Fingerabdruck der Quelle
  (Version, Zahl der Scheiben und Treffer, ältestes Lebenszeichen). Nie Namen oder Nummern (SF-59).
- **D8 Möglicher Reset** (SF-23) nur gemeldet: Fällt die Zahl der Scheiben in einem Lauf um mehr als die Hälfte
  (mindestens 10), meldet der Heartbeat `possible-reset`. Eine neue Epoche zu eröffnen bleibt offen (Teil c oder eigene
  Entscheidung): Ein falscher Alarm hieße eine Epoche, die der Admin bestätigen müsste.
- **D9 Tests**: Go-Tests gegen einen Spiegel aus `httptest` (Kopplung schreibt 0600 und nichts bei falschem Code;
  Filter je Regel; Upload mit 429, 503, 413, 401 und Netzfehler, danach neu gelesen; Drossel; Heartbeat ohne Namen).
  Ende zu Ende `pnpm --filter spiegel bridge-e2e`: eigener Build von Spiegel auf :3012, eigene Anlage mit Zustimmung für
  den erfundenen Sportpass, MariaDB mit den Fällen SF-03 (Zustimmung), SF-13 (ohne Sportpass) und SF-19 (verdeckt),
  das echte Binary koppelt und läuft; geprüft in der Datenbank: nur SF-03 kommt an, beim richtigen Konto, Heartbeat
  vermerkt. Danach alles entfernt.

## Nicht in diesem Plan

Aufträge (SP-1.5), Nachholen ab dem Wasserstand, Abgleich der letzten Tage, Selbst-Update, Statusseite, Dienst-Datei für
systemd (Teil c), neue Epoche bei einem Reset (D8), Releases (SP-1.9).
