# Plan: Spielwiese festhalten und weiter erkunden

Branch `feat/spiegel-ui-reference` (Worktree `.claude/worktrees/spiegel-ui-reference`, parallel läuft eine
andere Session im Haupt-Checkout). Bezug: Roadmap SP-1.8 (Session-Detail, `packages/shot-ui`), SP-2.1
(Verläufe), SP-2.2 (Vergleiche); [[spiegel-ui-design]].

## Kontext

Die Spielwiese (Artifact https://claude.ai/artifact/58GBLyEKGutSbKxyjfJ6K5, Version 13) zeigt die beste
Oberfläche, die Spiegel bisher hat: Scheibe mit Haarlinien, Treffern in Kalibergröße und Nummern, Serien als
kleine Scheiben, Analyse in sechs Reitern mit Kacheln, Karten, Diagrammen, Beobachtungen und Hilfe an jeder
Zahl, Visierverstellung von Hand. Der User: „die scheiben und serienansichten sind wunderschön und
funktionieren gut“, und sie sollen in der fertigen App „genauso gut oder schön“ entstehen.

Die Quellen lagen nur im Scratchpad und sind beim Neustart der Session am 8. Oktober verschwunden. Gerettet
und committet (`94fc4ca`, `tools/spielwiese/`): die Vorlage aus dem Artifact (Rückweg Byte für Byte), die
Skriptprüfung aus dem Sitzungsprotokoll (0 FAIL von 118 gegen Version 13), die Einstiegsdateien (Bundles Byte
für Byte gleich). Was fehlt:

- Die Spielwiese ist nicht baubar ohne Handarbeit und nicht im Gate: Die nächste Änderung am Fachkern kann
  sie still brechen.
- Die Zeichenregeln der Scheibe stehen in [[spiegel-ui-design]]; der Analysebereich (Reiter, Kacheln, Karten,
  Diagramme, Platz der Hilfe, Zustände bei zu wenig Daten) steht nur im Code (2237 Zeilen).
- SP-1.8 nimmt als Abnahme nur die ältere Konzeptseite (`vault/_attachments/spiegel-konzept.html`).
- Der User nennt, was die Spielwiese noch nicht zeigt: eine Serie allein ansehen, Auswahl von Serien oder
  allen Schüssen, Wiedergabe, eigener Zoom, Serien vergleichen, Scheiben verschiedener Tage vergleichen,
  Trends über Scheiben; dazu die Nummern: „zahlen überlagern sich stark, ohne dass ich das gefühl habe, dass
  eine zahl zu einem ‚tieferen‘ schuss gehört“.

## Ansatz und Empfehlung

| Weg | Was | Für | Gegen |
|---|---|---|---|
| 1 Nur archivieren | Quellen und eine eingefrorene Seite | billig | Details bleiben in 2237 Zeilen Code verborgen, Spielwiese verrottet |
| **2 Festhalten** (empfohlen) | baubar im Repo und im Gate, eingefrorene Referenz, Referenzbilder, Katalog jedes Bausteins, Skriptprüfung als Abnahme für SP-1.8 | nichts geht verloren, SP-1.8 hat Maße, Zustände und Prüfungen | Pflege: eine Änderung am Fachkern muss die Spielwiese mitziehen |
| 3 `packages/shot-ui` jetzt | Zeichenkern als geteiltes Paket | dieselbe Geometrie in App und Spielwiese | Kernarbeit von SP-1.8, hängt an Entscheidungen zur App (React, Server Components); besser dort, mit 2 als Vorlage |

Empfehlung: **Teil A = Weg 2**, danach **Teil B = Erkunden** in Runden mit dem User, direkt im Repo (jede Runde
committet, nichts mehr nur im Scratchpad). Weg 3 bleibt der Anfang von SP-1.8.

## Entscheidungen

- **D1 Ort:** `tools/spielwiese` als privates Workspace-Paket `@vereinsheim/spielwiese`; in
  `pnpm-workspace.yaml` ausdrücklich `tools/spielwiese` (kein `tools/*`, damit andere Werkzeuge nicht
  ungewollt ins Gate kommen). Kein Deploy, von keiner App genutzt; `turbo prune` für die Apps nimmt es nicht mit.
- **D2 Gate:** `build` (esbuild, unter 2 s) und `test` (Drift-Test) laufen in `pnpm check`; `test` und
  `build` hängen an `^build`, damit eine Änderung in `shot-core`, `shot-help` oder `meyton-pdf` den Cache
  ungültig macht (Lehre aus dem Review von SP-1.12). Die Skriptprüfung im Browser (`pruefen`, gut zwei
  Minuten) bleibt wie `simulate` außerhalb des Gates, mit Regel in der Scope-Notiz.
- **D3 Werkzeuge in TypeScript** statt der früheren Python-Skripte: `tsx` und die esbuild-API, wie die Skripte
  von `shot-help`. Chrome über `CHROME_PATH`, sonst der macOS-Standardpfad.
- **D4 Eingefrorene Referenz:** die gebaute Seite als `vault/_attachments/spiegel-spielwiese.html`, wie die
  Konzeptseite; erneuert nur, wenn der User einen Stand abnimmt (Version 13 jetzt, danach je Erkundungsrunde
  höchstens einmal). 1,9 MB, davon 1,7 MB pdf.js.
- **D5 Referenzbilder:** `vault/_attachments/spielwiese/*.png`, dunkel: Desktop 1280 px je Reiter und die
  Scheibe mit Serien, Handy 390 px Scheibe und Überblick; zusammen höchstens etwa 3 MB. Ein Skript erzeugt
  sie neu.
- **D6 Katalog:** neue Note `vault/spiegel/spiegel-ui-reference.md`: je Baustein Zweck, Datenquelle
  (Funktion aus `shot-core`, Hilfethema), Aufbau mit Maßen und Tokens, Zustände (zu wenig Daten, Urteil),
  Bedienung, Handy/Desktop, Barrierefreiheit, Prüfungen der Skriptprüfung, Bild, Fundstelle im Code.
  [[spiegel-ui-design]] bleibt die Note für Grundsätze und Zeichenregeln; beide verlinken sich.
- **D7 Abnahme SP-1.8:** Sichtprüfung gegen die eingefrorene Spielwiese und die Bilder (Konzeptseite nur
  für Bildschirme, die die Spielwiese nicht hat); die 118 Prüfungen werden als Liste zu Markup- und
  Verhaltenstests der echten Ansicht.
- **D8 Daten:** Beispielwerte stehen schon in den Fixtures von `shot-core`, das Beispiel-PDF ist erfunden und
  seine ID steht in den Tests von `meyton-pdf`; kein echter Ausdruck (ADR-029). Neue Beispieldaten für
  Teil B (mehrere Abende) werden erzeugt, mit festem Seed.
- **D9 Teil B ist interaktiv,** nicht autonom: Jede Runde baut Varianten, veröffentlicht das Artifact und
  wartet auf das Urteil des Users; was er wählt, kommt in Katalog und [[spiegel-ui-design]]. Die Spielwiese
  rechnet weiter nur mit dem Fachkern; braucht eine Idee neue Statistik (etwa „zwei Serien echt
  verschieden?“), zeigt die Runde die Darstellung beschreibend und notiert die fehlende Funktion für
  SP-2.2, statt im Browser zu rechnen.

## Dateien (Teil A)

| Datei | Änderung |
|---|---|
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Eintrag `tools/spielwiese`, neuer Importer |
| `tools/spielwiese/package.json`, `tsconfig.json`, `turbo.json`, `.gitignore`, `vitest.config.ts` | Paket, Skripte `build`, `test`, `check-types`, `format:check`, `pruefen`, `bilder` |
| `tools/spielwiese/scripts/build.ts` | Bundles über die esbuild-API, Vorlage füllen → `dist/spiegel-spielwiese.html`, `dist/test.html` |
| `tools/spielwiese/scripts/pruefen.ts` | Headless-Chrome mit Zeitlimit, `<pre id="dbg">` lesen, „n FAIL von m“, Exit-Code |
| `tools/spielwiese/scripts/bilder.ts` | Referenzbilder (Desktop direkt, Handy über 390-px-iframe) |
| `tools/spielwiese/test/drift.test.ts` | jeder Name hinter `S.`, `H.`, `MeytonPdf.` in Vorlage und Skriptprüfung existiert im jeweiligen Modul |
| `tools/spielwiese/CLAUDE.md`, `README.md` | Scope-Notiz, Regeln, Bedienung |
| `vault/_attachments/spiegel-spielwiese.html`, `vault/_attachments/spielwiese/*.png` | Referenz und Bilder |
| `vault/spiegel/spiegel-ui-reference.md` | Katalog (neu) |
| `vault/spiegel/spiegel-ui-design.md`, `spiegel.md`, `spiegel-roadmap.md`, `vault/architecture/architecture.md`, `vault/index.md` | Verweise, SP-1.8 Umfang und Abnahme, Repo-Karte |

## Required Docs

`vault/conventions.md`, [[spiegel-ui-design]], `vault/spiegel/spiegel-roadmap.md` (SP-1.8, SP-2.1, SP-2.2),
`packages/shot-help/CLAUDE.md` (Muster für Skripte, `^build`), `vault/SCHEMA.md` (Note und `_attachments`),
`tools/spielwiese/README.md`.

## Tasks Teil A

1. **Paket anlegen.** `package.json` (`private`, Name `@vereinsheim/spielwiese`, devDependencies:
   `@vereinsheim/shot-core`, `@vereinsheim/shot-help`, `@vereinsheim/meyton-pdf` als `workspace:*`,
   `esbuild` 0.28.1 exakt wie im Lockfile, `tsx`, `typescript`, `vitest`, `@types/node`, `prettier` aus dem
   Catalog), `tsconfig.json` erbt von `@vereinsheim/config`, `turbo.json` mit `build`
   (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`) und `test` (`dependsOn: ["db:generate", "^build"]`),
   `.gitignore` mit `dist/`. Einstiegsdateien über die Paketnamen statt relativer Pfade. Danach
   `pnpm install` und `pnpm install --frozen-lockfile`; Lockfile-Diff nur der neue Importer.
2. **`scripts/build.ts`** (test-first, wo prüfbar): baut die drei Bundles mit denselben Optionen wie Version
   13, ersetzt die Platzhalter, `__COMMIT__` aus `git rev-parse --short HEAD`, `__TESTS__` als Option
   (`--tests 329`), ohne Option entfällt das Stempel-Feld. Probe: gebaut aus `94fc4ca` mit `--tests 329`
   ist `dist/spiegel-spielwiese.html` Zeichen für Zeichen gleich der geretteten Seite ohne Gerüst.
3. **`scripts/pruefen.ts`:** baut, legt die Testseite an (Gerüst, Fehlersammler, Skriptprüfung), startet
   Chrome mit `--headless=new --dump-dom --virtual-time-budget=40000`, beendet ihn nach 150 s, liest den
   Bericht, druckt FAIL-Zeilen, Exit 1 bei FAIL oder fehlendem Bericht. Erwartet: 0 FAIL von 118.
4. **Drift-Test** `test/drift.test.ts`: sammelt per Regex `S.<name>`, `H.<name>`, `MeytonPdf.<name>` aus
   `template.html` und `harness.js` und erwartet jeden Namen in `Object.keys` des Moduls. Gegenprobe: einen
   Namen in einer Kopie der Vorlage verfälschen → Test rot.
5. **Referenz und Bilder:** `scripts/bilder.ts`, dann `vault/_attachments/spiegel-spielwiese.html` aus dem
   Build (Version 13 inhaltlich, Stand des Branches) und die Bilder; jedes Bild ansehen.
6. **Katalog** `spiegel-ui-reference.md` nach D6, Bausteine: Seitenaufbau und Tokens; Scheibe (Ringe,
   Ringzahlen, Treffer, Nummern, Streukreis, Ellipse, Schwerpunkt, Zoom Gruppe/Scheibe, Probe hohl und
   gestrichelt, neuer Schuss, Tippen, Ablesung); Serien als kleine Scheiben; Schusstabelle; Kacheln an der
   Scheibe; Wertung umschalten; Visier verstellt; Analyse: Reiter, Datenlage-Zeile, Beobachtungen, Kacheln im
   Überblick, Karten mit „Was heißt das?“, Urteils-Pillen, Diagramme (Serienkurve, gleitender Schnitt mit
   Trend, Rhythmus, Richtungsuhr, Schwerpunkt-Pfad, Zehntel- und Ringverteilung, Quoten mit Wilson-Balken,
   σ-Bereich, von-Neumann-Skala, Lage/Streuung-Balken, Probe auf der Scheibe); Hilfe (Schalter, Einstieg,
   Glossar, Fehlschlüsse, „Trefferbild“); leere Werte und Sonderfälle; wie die Zahlen geprüft sind
   (Skriptprüfung gegen den Fachkern, Tests mit Handwerten, Simulationen). Dazu Verweise und SP-1.8 nach D7.
7. **Scope-Notiz** `tools/spielwiese/CLAUDE.md`: rechnet nur über den Fachkern; nach Änderungen an
   `shot-core`-Auswertungen oder an der Spielwiese `pnpm --filter @vereinsheim/spielwiese pruefen`; Artifact
   aus `dist/` neu veröffentlichen (gleiche URL); keine echten Ausdrucke; Referenz nur bei Abnahme erneuern.

## Teil B: Erkunden (Runden mit dem User)

Jede Runde: Varianten in `tools/spielwiese` bauen, Skriptprüfung um die neuen Bedienungen erweitern,
`pruefen` grün, Artifact neu veröffentlichen, Urteil des Users, Ergebnis in Katalog und
[[spiegel-ui-design]], committen. Ziel-Feature in Klammern.

- **Runde 1, die Scheibe (SP-1.8):**
  - *Nummern in Ebenen:* jede Nummer gehört zur Ebene ihres Treffers (Treffer und Nummer paarweise in
    Abgabefolge, ein späterer Treffer verdeckt auch die Nummer darunter); dazu Antippen eines Treffers hebt
    ihn mit Nummer nach oben; Variante Nummern nur für die gewählte Serie.
  - *Serie wählen:* Tippen auf eine Serienscheibe zeigt nur diese Serie groß (die anderen blass oder aus),
    Mehrfachauswahl, „alle“; die Analyse folgt der Auswahl (Nummern bleiben die der ganzen Scheibe).
  - *Eigener Zoom:* Ziehen und Zoomen mit Maus und zwei Fingern neben „Gruppe/Scheibe“, Haarlinien bleiben
    1 px, Zurück auf Doppeltippen.
- **Runde 2, Ablauf und Serien (SP-1.8, SP-2.2):**
  - *Wiedergabe:* Schüsse in Abgabefolge, Tempo wählbar (echt, schnell), Regler, Serienwechsel sichtbar,
    bei „Bewegung reduzieren“ Sprünge.
  - *Serien vergleichen:* zwei Serien übereinander in den Vergleichsfarben A blau, B orange, je Schwerpunkt
    und Streukreis, Tabelle mit Differenz; beschreibend (D9).
- **Runde 3, über Tage hinweg (SP-2.1, SP-2.2):**
  - *Beispieldaten:* acht erfundene Abende über sechs Wochen mit leichter Verbesserung und einem
    Ausreißerabend, fester Seed.
  - *Scheiben vergleichen:* zwei Abende wählen, übereinander und als Tabelle.
  - *Trends:* Verlauf von Ergebnis, σ, Lage und Tempo über die Abende mit gleitendem Schnitt und Trend aus
    `shot-core` (Mann-Kendall, Theil-Sen), ehrlich mit n und „nicht klar“.

## Test steps

- Teil A: `pnpm check` grün (inklusive `build` und `test` der Spielwiese); `pnpm --filter
  @vereinsheim/spielwiese pruefen` → 0 FAIL von 118; Build-Probe aus Task 2 Zeichen für Zeichen gleich;
  Drift-Gegenprobe rot; `vault-lint` gültig; Bilder angesehen (Desktop und Handy, dunkel).
- Teil B: je Runde `pruefen` grün mit den neuen Prüfungen, Sichtprüfung Handy und Desktop, Urteil des Users.

## Verification

Bericht `reports/2026-10-08-spiegel-spielwiese.md` mit Gate-Ausgabe, Ergebnis von `pruefen`, Build-Probe,
Drift-Gegenprobe und Bildern. Artifact aus dem Repo-Build neu veröffentlichen (gleiche URL); es zeigt
denselben Inhalt wie Version 13. Merge nach `main` erst mit OK des Users und wenn die parallele Session fertig
ist; davor `main` in den Branch holen (Rebase des Feature-Branches).
