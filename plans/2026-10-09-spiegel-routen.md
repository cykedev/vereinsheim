# Plan: N1 Routen-Modell für Spiegel

- **Anlass:** Schritt N1 aus `vault/spiegel/spiegel-navigation.md` (entschieden mit dem User am 9. Oktober 2026;
  Roadmap SP-1.8).
  - Der ganze Zustand steht in der Adresse, mit englischen Pfaden und deutschen Ankern.
  - Browser-Zurück und geteilte Links stellen alles wieder her.
  - Zurück und Blättern kennen ihren Kontext (Liste, Start, Fortschritt).
- **Branch:** `feat/spiegel-routen` (von `main` f44d1de).
- **Parallel:** Die Session `feat/spiegel-seq-luecke` ändert:
  - in `shot-core`: `metrics.ts`, `timing.ts`, `position.ts`, `period.ts`;
  - in `shot-ui`: `TimeTab`, die Diagramme, `overview`, `observations`, `MetricTiles`.

  Dieser Plan fasst keine dieser Dateien an.

## Kontext

Gebaut sind die Seite einer Scheibe und die eines Zeitraums. Im Labor verbindet sie ein Zustand im Speicher
(`App.tsx`: `opened`, `returnTo`). Die App braucht stattdessen Adressen. N3 (App-Rahmen), N4 (Auswahl) und N7 (Routen
in `apps/spiegel`) bauen darauf auf. N1 liefert deshalb nur reine Funktionen mit Tests, keine Oberfläche außer einer
Zeile im Labor, die die Adresse zeigt.

**Grenze des Artifacts:** Im veröffentlichten Labor kommt nur ein einfacher Anker (`#lage`) in `location.hash` an, nie
eine Query. Auch die `data:`-Vorschau der App kann nicht navigieren. Das Labor führt die Adresse deshalb nicht als URL.
Es zeigt sie als Zeile („Adresse in der App: …“) und baut den Rückweg aus ihr: Öffnen erzeugt die Adresse der Scheibe,
„Zurück“ stellt den Zustand des Zeitraums aus der Rückweg-Adresse wieder her. So läuft das Modell live und wird von
der Skriptprüfung nachgerechnet.

## Entscheidungen

- **D1 Was in die Adresse gehört:**
  - Alles, was bestimmt, *was* man sieht: Seite, Filter, Zeitraum, Vergleich, Kennzahl und Darstellung des Verlaufs,
    gewählte Scheibe, Auswahl und Schuss der Scheibe, Wertung, Abschnitt oder Reiter.
  - Nicht in die Adresse: *wie* es gezeichnet ist (Ebenen der Scheibe, Ausschnitt Gruppe/Scheibe, Thema,
    „Erklärungen“, offenes Hilfe-Blatt). Das bleibt Vorliebe im Gerät (wie heute `labor.*` im Speicher, später im
    Profil).
- **D2 Kanonische Form:**
  - Vorgaben fallen weg, Schlüssel stehen in fester Reihenfolge.
  - `urlFromRoute(routeFromUrl(u))` ergibt die kanonische Form von `u`.
  - `routeFromUrl(urlFromRoute(r))` ist `r`.
  - Unbekannte Schlüssel werden übergangen; ungültige Werte gelten als Vorgabe. Es wird nie ein Fehler geworfen, denn
    ein von Hand geänderter Link soll trotzdem öffnen.
- **D3 Pfade und Schlüssel englisch, Anker deutsch:**
  - **Pfade:** `/`, `/cards`, `/cards/<id>`, `/progress`, `/compare`, `/scan`, `/open`, `/profile`,
    `/profile/trash`, `/admin`, `/admin/<bereich>`. Alles andere ist `unknown`.
  - **Anker:**
    - Scheibe: `parseHash`/`hashFor` (`#scheibe` … `#analyse`, Reiter `#lage` …).
    - Fortschritt: `parsePeriodHash` (`#verlauf` …).
    - Liste: der Abend als ISO-Tag (`#2026-09-25`, nur Ziffern und Bindestriche, kommt im Artifact an).
- **D4 Werte:**

  | Schlüssel | Seiten | Werte (Vorgabe fett) |
  |---|---|---|
  | `range` | Liste, Fortschritt | `30d`, **`90d`** (Fortschritt), `12m` (= 365 Tage), `all` (Liste: **ohne** = alle), `JJJJ-MM-TT..JJJJ-MM-TT` (Beginn ≤ Ende, gültige Tage), sonst Id eines benannten Zeitraums (`[a-z0-9][a-z0-9-]*`); die festen Werte gehen vor |
  | `compare` | Fortschritt | **ohne**, `previous`, Id eines benannten Zeitraums |
  | `family` | Liste, Fortschritt | Id der Familie (`[a-z0-9][a-z0-9-]*`), **ohne** = die zuletzt benutzte, die Seite setzt sie ein |
  | `kind` | Liste, Fortschritt | **ohne** (alle), `training`, `competition` |
  | `flag` | Liste | Merkmal (`[a-z0-9][a-z0-9-]*`), **ohne** |
  | `probe` | Fortschritt | **ohne** (Training nur aus Probe zählt), `0` |
  | `scoring` | Fortschritt, Scheibe | **ohne** (Zehntel), `rings` |
  | `metric` | Fortschritt | **ohne** (`result.decimalMean`), `sigma`, `tens`, `tempo` |
  | `view` | Fortschritt | **ohne** (nach Zahl der Scheiben), `cards`, `months` |
  | `pick` | Fortschritt | Id der gewählten Scheibe, **ohne** |
  | `from` | Scheibe, Vergleich | **ohne** (direkter Link), `list`, `start`, `progress`; dazu die Schlüssel der Herkunft (Liste: `range family kind flag`; Fortschritt: `range compare family kind probe metric view`, die Wertung ist die der Scheibe) |
  | `series` | Scheibe | **ohne** (Grundauswahl der Scheibe), `all`, `match`, `probe`, Serie `1`, `2`, … |
  | `shot` | Scheibe | **ohne**, Nummer wie `shotLabels` (`23`, `P3`) |
  | `a`, `b` | Vergleich | Ids zweier Scheiben (Pflicht, sonst `unknown`) |

  - **Ids von Scheiben:** `[A-Za-z0-9_-]+`, im Pfad per `encodeURIComponent`.
  - **Reihenfolge der Schlüssel:** wie in der Tabelle von oben nach unten.
- **D5 Der Schuss steht als Nummer, nicht als Index:** Die Route trägt `shot: "23"` bzw. `"P3"`. Die Seite übersetzt
  über `shotLabels` in den Index von `ViewState.chosen`. Das Modell bleibt so frei von Schüssen.
- **D6 Herkunft trägt ihren Zustand:**
  - Eine Scheibe aus dem Fortschritt hat in ihrer Adresse die Schlüssel des Fortschritts, ohne `pick`, denn das ist
    die Scheibe selbst.
  - `backRoute` baut daraus den Fortschritt mit `pick` = diese Scheibe; die Liste zeigt sie dann gewählt.
  - Blättern (`siblingRoute`) behält Herkunft, Wertung und Abschnitt und lässt Auswahl und Schuss fallen.
- **D7 Querverweise:**
  - `listFromProgress` („Alle in Scheiben zeigen“) übernimmt `family`, `kind` und `range`.
  - `progressFromList` („Verlauf dieser Filter“) übernimmt dieselben; eine Liste ohne `range` wird `all`.
- **D8 Zurück-Beschriftung:**
  - `backLabel` liefert „Start“, „Scheiben“ oder den Namen des Zeitraums wie `resolveRange` („Letzte 90 Tage“,
    „Neue Munition“, „1.5.2026 – 30.6.2026“). Ein direkter Link führt zu „Scheiben“.
  - Benannte Zeiträume und Zeitzone kommen vom Aufrufer.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/nav/routes.ts` (neu, + `routes.test.ts`) | Typen `Route`, `ListQuery`, `ProgressQuery`, `CardOrigin`; `routeFromUrl`, `urlFromRoute`, Codecs je Schlüssel |
| `packages/shot-ui/src/nav/navigate.ts` (neu, + `navigate.test.ts`) | `openCard`, `backRoute`, `backLabel`, `siblingRoute`, `listFromProgress`, `progressFromList`, `progressRoute`, `periodStateFromRoute` |
| `packages/shot-ui/src/period/state.ts` (+ Test) | Aktion `restore` (ganzen Zustand setzen) für „Zurück“ aus der Adresse |
| `packages/shot-ui/package.json` | Exporte `./nav/routes`, `./nav/navigate` |
| `packages/shot-ui/CLAUDE.md` | Exporte, Regel „Zustand in der Adresse“ |
| `tools/labor/src/App.tsx`, `CardView.tsx`, `PeriodView.tsx`, `LaborHeader.tsx`, `testHook.ts` | Zeile „Adresse in der App“, Öffnen und Zurück über das Modell |
| `tools/labor/pruefung.js`, `tools/labor/CLAUDE.md` | Prüfungen der Adresse, Rundreise, Zurück |
| `vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-roadmap.md` | „Umgesetzt in N1“, Status |

## Required Docs

- `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`
- `vault/spiegel/spiegel-navigation.md` (Entscheidungen 1–16, Abschnitt „Bereiche und Adressen“)
- `vault/conventions.md` §10
- Artifact-Grenze: nur `#wort` kommt an (siehe Kontext)

## Aufgaben

### Task 1: Zeitraum und Vergleich als Wert (`routes.ts`)

- `encodeChoice(choice: PeriodChoice): string` und `decodeChoice(value: string | null, fallback: PeriodChoice | null):
  PeriodChoice | null`:
  - `rolling` 30/90/365 ergibt `30d`/`90d`/`12m`, `all` ergibt `all`.
  - `free` ergibt `2026-05-01..2026-06-30`, `named` die Id.
  - `decodeChoice` prüft Datum (echter Kalendertag, `Date.UTC`-Rundreise) und Reihenfolge; Ungültiges ergibt
    `fallback`.
- `encodeCompare` / `decodeCompare`: `none` fällt weg, `previous`, sonst Id.
- **Tests (Handwerte):**
  - `decodeChoice("12m")` ist `{ type: "rolling", days: 365 }`.
  - `decodeChoice("2026-02-30..2026-03-01", D)` ist `D` (kein 30. Februar).
  - `decodeChoice("2026-06-30..2026-05-01", D)` ist `D`.
  - `decodeChoice("Neue Munition", D)` ist `D` (Großbuchstaben, Leerzeichen).
  - `decodeChoice("neue-munition", D)` ist `named`.
  - `decodeChoice("all", D)` ist `all`, auch wenn ein benannter Zeitraum `all` hieße.

### Task 2: Liste und Fortschritt als Query

- `listQueryToParams(q)` und `listQueryFromParams(p)`:
  - `range` wird bei `all` und ohne Angabe zu `null`.
  - `family`, `kind`, `flag` wie D4.
- `progressQueryToParams(q)` und `progressQueryFromParams(p)` mit allen Feldern von D4; die Vorgaben stehen wie in
  `initialPeriodState`.
- **Tests:**
  - Die Vorgaben ergeben leere Parameter.
  - Ein voller Fortschritt ergibt genau
    `range=2026-05-01..2026-06-30&compare=previous&family=lp-10m&kind=training&probe=0&scoring=rings&metric=sigma&view=months&pick=c42`.
  - `probe=1` und `metric=mean` werden als Vorgabe gelesen und fallen beim Schreiben weg.
  - `kind=wettkampf` ergibt `all`.

### Task 3: Die Scheibe (Herkunft, Auswahl, Schuss, Anker)

- `Route` für `card`: `{ page: "card"; id; origin: CardOrigin; selection: Selection | null; shot: string | null;
  scoring: Scoring; anchor: PageAnchor | null }`.
- `CardOrigin`: `null | { from: "start" } | { from: "list"; query: ListQuery } | { from: "progress"; query:
  Omit<ProgressQuery, "chosen" | "scoring"> }`.
- `series` wie D4; `shot` mit `/^P?[1-9]\d*$/`; der Anker über `parseHash`/`hashFor`.
- **Tests:**
  - `/cards/c42?from=progress&family=lg-10m&series=2&shot=23#lage` ergibt Herkunft Fortschritt (Vorgaben, Familie
    `lg-10m`), Auswahl 2, Schuss „23“ und Anker `{ section: "analyse", tab: "position" }`. Zurückgeschrieben ergibt
    das dieselbe Zeichenkette.
  - `series=0`, `series=-1`, `shot=0`, `shot=P` gelten als ohne.
  - Ein Ankerwort ohne Bedeutung wird zu `null`.

### Task 4: Die ganze Adresse

- `routeFromUrl(pathname: string, search: string, hash: string): Route` und `urlFromRoute(route: Route): string`
  für alle Seiten aus D3.
  - Hilfstypen `CardRoute`, `ListRoute`, `ProgressRoute` als `Extract<Route, { page: … }>`.
  - Die Liste trägt `evening` (ISO-Tag aus dem Anker).
  - Der Vergleich ohne `a` oder `b` ergibt `unknown`.
  - `/admin/<bereich>` trägt `section`.
  - Ein Schrägstrich am Ende zählt nicht (`/cards/` ist `/cards`).
  - Eine Id mit unerlaubten Zeichen ergibt `unknown`.
- **Tests:**
  - **Tabelle von zwölf Adressen mit Handwerten**, je Seite mindestens eine.
  - **Rundreise über alle Kombinationen** aus:
    - je zwei bis drei Werten jedes Schlüssels;
    - drei Herkünften;
    - Auswahl, Schuss und Anker.

    Das sind einige tausend Routen. Jede muss `routeFromUrl(urlFromRoute(r))` gleich `r` ergeben.
  - **Kanonisch:** Vertauschte Schlüssel und Vorgaben im Link ergeben dieselbe Route und beim Schreiben die
    kanonische Form.

### Task 5: Wege zwischen den Seiten (`navigate.ts`)

- `openCard(from: Route, id: string): Route`:
  - Aus `cards` wird die Herkunft `list` mit dessen Query.
  - Aus `progress` wird `progress` ohne `pick` und `scoring`; die Wertung der Scheibe ist die des Fortschritts.
  - Aus `start` wird `start`; aus jeder anderen Seite gibt es keine Herkunft.
  - Auswahl, Schuss und Anker sind leer.
- `backRoute(card)`:
  - `list` führt zu `cards` mit der Query und dem Abend `null`.
  - `progress` führt zu `progress` mit der Query, `chosen` = Id und der Wertung der Scheibe.
  - `start` führt zu `start`; ohne Herkunft zu `cards` mit leerer Query.
- `siblingRoute(card, id)` nach D6.
- `listFromProgress(progress)` und `progressFromList(list)` nach D7.
- **Tests:**
  - **Rundreise:** Ein Fortschritt mit Wahl, darin eine Scheibe öffnen und zurück, ergibt denselben Fortschritt mit
    `chosen` = Id. Das gilt auch nach einem Wechsel der Wertung auf der Scheibe; die neue Wertung kommt mit.
  - **Blättern** behält `#lage` und die Herkunft und verliert `series` und `shot`.
  - **Liste:** Aus der Liste geöffnet und zurück ergibt dieselbe Liste.

### Task 6: Beschriftung des Rückwegs

- `backLabel(card, context: { named: readonly NamedPeriod[]; timeZone: string }): string`.
  - Für den Fortschritt liefert es `resolveRange(choice, { nowMs: 0, firstMs: null, ...context }).label`; die
    Beschriftung hängt nicht von `nowMs` ab.
  - Sonst „Start“ oder „Scheiben“.
- **Tests:**
  - „Letzte 90 Tage“, „Alles“ und „Neue Munition“ aus einem benannten Zeitraum.
  - Ein freier Zeitraum in `Europe/Berlin` wie `resolveRange`.
  - „Scheiben“ für einen direkten Link.

### Task 7: Fortschritt ↔ Zustand und „restore“

- `periodStateFromRoute(route: ProgressRoute, fallbackFamily: string): PeriodState`: `family: null` wird
  `fallbackFamily`.
- `progressRoute(state: PeriodState, section: PeriodSection | null): Route`.
- In `period/state.ts` die Aktion `{ type: "restore"; state: PeriodState }`, die den ganzen Zustand setzt.
- **Tests:**
  - **Rundreise Zustand → Route → Zustand** für alle Felder.
  - `restore` ersetzt alles, auch `chosen`.
  - Der Reducer bleibt sonst unverändert; die bestehenden Tests sind grün.

### Task 8: Exporte und Doku des Pakets

- `package.json`: `"./nav/routes"` und `"./nav/navigate"`.
- `shot-ui/CLAUDE.md`:
  - zwei Zeilen in der Export-Tabelle;
  - eine Regel „Zustand in der Adresse“: D1, D2 und D5 kurz, die Artifact-Grenze und der Hinweis, dass Seiten ihre
    Adresse nur über `nav/*` bauen.

### Task 9: Labor

- **`LaborHeader`:** Eigenschaft `address?: string`; darunter eine Zeile `data-address` in Mono
  „Adresse in der App: /progress?…“, die in sich bricht (`break-all`).
- **`App.tsx`:**
  - Zeitraum: `address = urlFromRoute(progressRoute(period, null))`.
  - Scheibe öffnen: `cardRoute = openCard(progressRoute(period, null), card.id)`, merken.
  - „Zurück“: `dispatch({ type: "restore", state: periodStateFromRoute(backRoute(cardRoute), period.family) })`.
    `returnTo` bleibt nur für die Scrollstelle, die nicht in die Adresse gehört.
- **`CardView.tsx`:**
  - Die Adresse der Scheibe aus der übergebenen Route (geöffnet) bzw. für die Beispiele
    `{ page: "card", id: "<waffe>-<beispiel>", origin: null }`.
  - Dazu `selection`, `shot` über `shotLabels`, `scoring` und der aktive Reiter als Anker.
  - Der Knopf „Zurück“ heißt nach `backLabel` („Zurück zu „Letzte 90 Tage““).
- **`testHook.ts`:** `tools.nav = { routeFromUrl, urlFromRoute, backRoute, openCard }`.
- **`pruefung.js`**, Abschnitt Zeitraum:
  - Die Adresse folgt dem Zeitraum (30 Tage → `range=30d`, Vergleich → `compare=previous`, Luftpistole →
    `family=lp-10m`).
  - Öffnen zeigt `/cards/<id>?from=progress…`.
  - Serie 2 und ein Tipp ergeben `series=2&shot=…`.
  - Der Rückweg heißt nach dem Zeitraum.
  - Zurück stellt Zeitraum, Vergleich und Familie her, mit `pick=<id>`.
  - Jede gesehene Adresse übersteht `routeFromUrl` und `urlFromRoute` unverändert.
  - Auf der Seite einer Scheibe: Die Adresse der Beispiele trägt den Reiter als Anker.
- **`tools/labor/CLAUDE.md`:** Zeile zur Adresse.

### Task 10: Vault

- `spiegel-navigation.md`: Abschnitt „Umgesetzt in N1“, mit Modul, Werten (D4), Grenze des Artifacts und dem, was
  N3 übernimmt (echte Navigation, Next-Routen).
- `spiegel-roadmap.md` SP-1.8: N1 erledigt.
- `node .claude/vault-lint.mjs`.

## Teststeps

- **Test zuerst** für Task 1–7 (reine Funktionen), mit Handwerten aus diesem Plan.
- **Gegenproben:**
  - Ein vertauschter Wert in einem Codec (`12m` → 30 Tage) macht Handwert-Test und Rundreise rot.
  - `backRoute` ohne `chosen` macht die Rundreise aus Task 5 rot.
  - Die Labor-Prüfung „Zurück stellt her“ schlägt an, wenn „Zurück“ statt `restore` nichts tut.
- `pnpm check` nach jedem Task.

## Verification

- `pnpm check` grün, `node .claude/vault-lint.mjs` gültig.
- `pnpm --filter @vereinsheim/labor build` (direkt), dann `pruefen` mit 0 FAIL.
- **Sichtprüfung im Labor:** Die Adresszeile ändert sich mit Zeitraum, Vergleich und Familie. Öffnen und Zurück
  zeigen die Wahl wieder; auf dem Telefon (375 px) bricht die Zeile, ohne seitlich zu scrollen.
- Artifact neu veröffentlichen.
- **Nicht im Umfang:**
  - echte Navigation (N3);
  - Next-Routen (N7);
  - der Anker des Abends in der Liste. Das Modell kennt ihn, die Liste kommt mit N2.
