# Treffsicher geht in Spiegel auf: Koordination

Koordinationsplan für den Weg in vier Stufen aus [[adr-033]] (SP-4.1). Dieser Plan setzt selbst keinen Code um. Er hält
fest, in welche Teilpläne die Stufen zerfallen, in welcher Reihenfolge sie laufen, was parallel gehen darf und wie die
Kindsessions arbeiten. Jeder Teilplan entsteht einzeln über `/plan` als eigene Datei unter `plans/` und wird vor der
Umsetzung freigegeben.

## Kontext

ADR-033 legt fest: eine App mit zwei streng getrennten Teilen (Ergebnisse in Spiegel, Tagebuch), ein Login, eine
Statistik; Treffsicher endet, Konten und Daten ziehen verlustfrei um. Der Weg hat vier Stufen, jede mit eigenem Plan.
SP-4.3 (Design 2 für alle Apps) ist umgesetzt, damit kann Stufe 1 beginnen.

Die Dev-Datenbank ist eine Kopie von Prod (Stand 26. Oktober 2026). Sie trägt die echten Konten beider Apps und ist
damit die Grundlage für den Abgleich der Konten und für den Prüfbestand der Übernahme.

## Basisbranch

- Alle Arbeit landet auf `feat/treffsicher-in-spiegel`. Er wird erst nach `main` gemergt, wenn alle vier Stufen fertig
  sind, und nur mit OK des Users (ff-only).
- Der Haupt-Checkout steht auf dem Basisbranch. Dort arbeitet nur die koordinierende Session: Teilpläne schreiben und
  committen, Kindbranches per `git merge --ff-only` übernehmen, den Basisbranch per `git rebase main` nachziehen, wenn
  `main` sich bewegt (keine Merge-Commits).
- Jeder Teilplan läuft in einer Kindsession auf einem eigenen Branch `feat/tis-<teil>` in einem eigenen Worktree,
  abgezweigt vom aktuellen Basisbranch.

## Regeln für Kindsessions

1. **Keine weiteren Sessions.** Eine Kindsession startet keine eigenen Sessions. Sub-Agents innerhalb der Session
   (etwa `code-reviewer` über `/review`) sind erlaubt.
2. **Ein Teilplan je Kindsession.** Sie arbeitet ihren freigegebenen Plan mit `/implement` ab, dann `/validate` und
   `/review`. Sie plant nicht neu: Weicht etwas vom Plan ab, meldet sie es an die koordinierende Session.
3. **Rückmeldung nur an die koordinierende Session**, nicht an den User. Fragen, Circuit-Breaker (etwa geschützte Pfade
   wie Schema und Migrationen, ADR-023) und der Abschluss gehen per Nachricht an die koordinierende Session, die mit
   dem User spricht und die Antwort weitergibt.
4. **Abschluss:** Branch auf den aktuellen Basisbranch rebasen, Gate grün im Worktree (`pnpm check`; der Stop-Hook prüft
   den Haupt-Checkout), dann melden: Branch, Commits, Bericht aus `reports/`, was nicht belegt ist, ob eine neue Brücke
   nötig ist. Kein Merge, kein Push, kein Deploy.
5. **Aufräumen nach der Übernahme:** Erst wenn die koordinierende Session meldet, dass der Branch im Basisbranch ist,
   löscht die Kindsession ihren Branch und Worktree und archiviert sich.
6. **Dev-Datenbank:** Sie ist eine Prod-Kopie und wird nie zurückgesetzt (`db-reset` und `migrate reset` sind tabu).
   Zur selben Zeit ändert höchstens eine Kindsession das Schema einer App. Eine Kindsession mit Dev-Server oder
   Skriptprüfung meldet ihren Port; zwei laufen nie auf demselben.
7. **Personendaten** (Namen, E-Mails, Sportpassnummern) nur in `reports/` (gitignored) oder im Chat, nie in Code, Tests,
   Doku oder Commits (ADR-029).

## Teile

### V · Vorab

- **V1 Abgleich der Konten** (lesend, kein Schema, kann sofort laufen): ein Skript, das die Konten von Treffsicher und
  Spiegel über die E-Mail abgleicht (ohne Groß- und Kleinschreibung, ohne Leerzeichen am Rand), und ein Bericht nur in
  `reports/`:
  - Konten nur in Treffsicher: Für sie fehlt ein Konto in Spiegel. Mit Hinweis, ob sie Einheiten haben und wann die
    letzte war, und ob sie aktiv sind.
  - Verdacht auf eine abweichende E-Mail: Konten ohne Treffer über die E-Mail, die über andere Merkmale zusammenpassen
    könnten (gleicher oder ähnlicher Name, gleicher Teil vor dem `@`, Tippfehler in der Domain).
  - Konten in beiden: Spiegel behält sein Konto (ADR-033), mit Hinweis, wenn Rolle oder Aktiv-Status abweichen.
  - Dazu die Zählungen, die ADR-033 vor Stufe 3 verlangt, soweit sie ohne das neue Modell gehen: Konten, Einheiten,
    Favoriten.

  Das Skript liegt im Repo (ohne Daten) und läuft vor der Übernahme noch einmal gegen Prod, durch den User. Dazu
  schreibt es einen Vorschlag für die Zuordnung (Treffsicher-E-Mail → Spiegel-E-Mail), den der User prüft und der später
  die Aufrufe der Übernahme Konto für Konto speist (Stufe 3).

### Stufe 1 · Spiegel lernt vereinfachte Scheiben

Vorgeschlagener Schnitt, endgültig im jeweiligen `/plan`:

- **1a Angaben-Modell:** Herkunft und Angaben an der Scheibe, Serien-Summen ohne Schüsse, eingetragene Disziplinen ohne
  Meyton-ID mit Familie, fremde Orte als `Site` ohne Brücke, Projektion und `needs`/`onMissing` für die neuen Angaben.
  Schema, interaktiv.
- **1b QR-Weg (SP-1.7 b):** Scannen (Kamera, Link, Teilen unter Android), PDF von erlaubten Adressen in einem
  kurzlebigen Kindprozess, PDF-Volume samt Backup, Auftrag an die Brücke, Vorschau und Bestätigung. Berührt
  Deploy-Vertrag und `scripts/`, interaktiv.
- **1c Ergebnisse fremder Anlagen (SP-2.6):** vollständiger Parser in `packages/meyton-pdf`, Meyton-QR ohne Brücke
  ergibt eine Scheibe aus dem PDF. Braucht 1a und 1b.
- **1d Handeingabe (SP-4.4):** „Ergebnis eintragen“ je Serie und je Schuss, Trefferlage als Summe, Beleg an der Scheibe,
  eigene Einträge ändern und löschen. Braucht 1a, für den Beleg den Datei-Speicher aus 1b.
- **1e Grundlage sichtbar:** „Streuung über 12 von 20 Scheiben, 8 ohne Lage“ in jeder Zahlengruppe, Rekorde je
  Angabe. Braucht 1a.

Reihenfolge: 1a und 1b zuerst (parallel nur, wenn höchstens eine von beiden das Schema ändert), dann 1c, 1d und 1e,
soweit sie sich nicht in denselben Dateien treffen.

### Stufe 2 · Das Tagebuch

Eigener Teil mit eigenem Datenmodell, neu entworfen (Einträge, Befinden, Prognose und Feedback, Reflexion, Ausführung je
Serie, Anhänge, Saisonziele, Schuss-Abläufe, Einflüsse, Selbstbild, Schalter im Profil, Gate gegen Importe zwischen den
Teilen). Der Entwurf der Oberfläche mit dem User kann beginnen, während Stufe 1 umgesetzt wird; die Teilpläne folgen,
wenn das Modell aus 1a steht.

### Stufe 3 · Die Daten ziehen um

Übernahme mit Prüfbestand, Dubletten mit Scheiben der Brücke (Grundlage: V1). Teilpläne nach Stufe 2.

**Konto für Konto per CLI** (gewünscht vom User am 26. Oktober 2026): Die Übernahme läuft für ein Konto auf einmal,
mit Quelle und Ziel, etwa `--from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>`. Damit

- ordnet der User Konten mit abweichender E-Mail selbst zu, statt dass nur die gleiche E-Mail zählt,
- lässt sich zuerst ein einzelnes Konto übernehmen und prüfen, während alle anderen weiter in Treffsicher arbeiten.

Folgen, die der Teilplan von Stufe 3 klärt:

- **Ziel fehlt:** Gibt es das Ziel-Konto in Spiegel nicht, legt die Übernahme es an, mit dem Passwort aus Treffsicher
  (ADR-033).
- **Wiederholbar je Konto:** Ein zweiter Lauf für dasselbe Konto ändert nichts oder ersetzt, was der erste übernommen
  hat. Der Prüfbestand läuft je Konto.
- **Nach der Übernahme ist das Konto in Treffsicher nur lesend**, mit Hinweis auf Spiegel. Sonst gingen Einträge
  verloren, die danach noch in Treffsicher entstehen. Das ist eine kleine Änderung an Treffsicher, die der Ruhestand
  ohnehin braucht.
- **Zwei Datenbanken:** Die Übernahme liest Treffsicher und schreibt Spiegel. Die Apps selbst greifen nie quer
  (ADR-002); das CLI läuft als eigener Schritt mit Zugang zu beiden, auch für die Dateien der Anhänge.
- **Aufruf** über das Ops-CLI `vereinsheim`, auf dem VPS und lokal gegen die Prod-Kopie.
- **Zeitpunkt in Prod:** Konto für Konto in Prod geht erst, wenn Spiegel mit Tagebuch deployt ist. Der Basisbranch muss
  dafür auf `main` sein. Bis dahin wird die Übernahme nur lokal gegen die Prod-Kopie geübt.
- **ADR-033** sagt „Konten ordnen sich über die E-Mail zu“ und „Treffsicher läuft erst nur lesend“ (als Ganzes). Die
  Zuordnung je Konto und das Lesend je Konto verfeinern das; der Teilplan trägt es als Entscheidung in ADR-033 nach.

### Stufe 4 · Ruhestand von Treffsicher

Erst nur lesend mit Hinweis und Weiterleitung, dann abgeschaltet. Berührt Deploy-Vertrag, Caddy und das CLI. Teilplan
nach Stufe 3. Wie Treffsicher lesend läuft, solange der Basisbranch nicht auf `main` ist, klärt dieser Teilplan.

## Stand

| Teil | Plan | Branch | Session | Stand |
|---|---|---|---|---|
| V1 | `plans/2026-10-26-tis-v1-accounts.md` | `feat/tis-v1-accounts` | | geplant |
| 1a | | | | offen |
| 1b | | | | offen |
| 1c | | | | offen |
| 1d | | | | offen |
| 1e | | | | offen |
| 2 | | | | offen |
| 3 | | | | offen |
| 4 | | | | offen |

## Verification

Jeder Teilplan hat seine eigene Verifikation. Vor dem Merge nach `main`: Gate grün auf dem Basisbranch, Stack Ende zu
Ende mit `tools/stack-e2e/run.sh`, Prüfbestand der Übernahme auf der Prod-Kopie grün.
