# Plan N3 — App-Rahmen für Spiegel

Schritt N3 aus `vault/spiegel/spiegel-navigation.md` (SP-1.8, Design 2 nach ADR-030). Branch `feat/spiegel-app-rahmen`.

## Kontext

Spiegel hat die Seiten einer Scheibe, eines Zeitraums und die Scheiben-Liste (N2) und ein Routen-Modell (N1). Im
Labor verbindet sie ein Umschalter „Ansicht“ im Labor-Kopf; die Wege laufen über Rückrufe (`onOpen`, `onShowAll`,
`onProgress`, `onBack`). Es fehlt der Rahmen der App, der die Bereiche verbindet:

- **Telefon:** untere Leiste mit Scannen in der Mitte;
- **Desktop:** Seitenleiste ab 1024 px;
- **Scheibe:** Rückweg mit Namen und Blättern im Kontext;
- **Wege:** Links mit echten Adressen statt Rückrufen.

Entschieden ist das in `spiegel-navigation` (Entscheidungen 9, 11, 16) und `spiegel-ui-design` (Navigation). Neu
seit dem 9. Oktober 2026: Die Navigation trägt die zuletzt gewählte Disziplin (Familie) mit.

## Entscheidungen

- **D1 Rahmen je Bildschirm:**
  - **Telefon hochkant und Tablet** (unter 1024 px breit): untere Leiste mit Start · Scheiben · **Scannen** ·
    Fortschritt · Profil. Scannen ist ein runder, erhabener Knopf in der Mitte.
  - **Telefon quer** (unter 1024 px breit und unter 500 px hoch): schmale Leiste links, nur Symbole, mit denselben
    fünf Einträgen. Die Höhe bleibt der Scheibe; eine untere Leiste nähme im Querformat 72 von 375 px, die Scheibe
    passte nicht mehr unter die Sprungleiste.
  - **Ab 1024 px:** Seitenleiste, 14rem breit, oben „Spiegel“. Einträge: Start (mit Zähler), Scheiben, Fortschritt,
    „QR scannen“ als Knopf, Trennlinie, Profil, Admin als letzter Eintrag. Die Seite steht in voller Breite daneben.
  - **Admin** sieht nur ein Admin (`isAdmin`). Am Desktop ist es der letzte Eintrag, auf dem Telefon ein Eintrag in
    Profil (Entscheidung 16).
  - **Zähler** „Offen“ am Start-Symbol: eine Zahl, über 0 als kleines Abzeichen. Im Labor ein fester Platzhalter
    (2), echte Fälle kommen mit N6.
- **D2 Platz für die Leiste:**
  - Der Rahmen setzt `--app-bar` (72 px mit unterer Leiste, sonst 0 px): 56 px Leiste und 16 px, um die der
    Scan-Knopf hinausragt.
  - Die Seite bekommt unten so viel Abstand plus den sicheren Rand des Telefons.
  - Die Pille „Zurück zu …“ (`ReturnPill`) sitzt darüber.
  - `useTargetFit` zieht den Wert von der Fensterhöhe ab (Tablet hochkant: Scheibe und Serien enden über der
    Leiste).
  - Blätter (`Sheet`) liegen als Dialog ohnehin darüber.
- **D3 Links statt Rückrufe:**
  - Ein Baustein `RouteLink` rendert `<a href>` mit der Adresse aus `urlFromRoute`. Ein `RouteLinkProvider` kann
    den Klick abfangen (`navigate`) und eine eigene Link-Komponente setzen (`component`, für `next/link` in N7).
  - Ein Klick mit Strg, Cmd, Shift, Alt oder einer anderen Maustaste bleibt beim Browser.
  - Zu Links werden:
    - die Zeile der Scheiben-Liste (die kleine Scheibe ist der Link; ein Klick irgendwo in der Zeile folgt ihm);
    - der Hinweis auf andere Familien des Abends;
    - „Verlauf dieser Filter“, „Alle in Scheiben zeigen“ und „Scheibe öffnen“ (Ablesung und Telefon-Zeile);
    - Rückweg, Blättern und Navigation.
  - Im Labor fängt der Provider jeden Klick ab und wechselt die Ansicht; die `href` zeigen die Adressen der App.
- **D4 Bereiche merken sich ihren Zustand,** wie Reiter einer App:
  - Der Link zu Scheiben und zu Fortschritt führt zur letzten Adresse des Bereichs, mit der zuletzt gewählten
    Familie. Ohne letzte Adresse gilt die Vorgabe mit dieser Familie (`areaLinks`).
  - Wechselt die Familie, fällt die Wahl im Fortschritt weg (sie gehört zur anderen Familie), ebenso der
    Abend-Anker der Liste.
  - Im Labor merkt sich jeder Bereich auch seine Scrollstelle. Sie gilt, wenn man zu genau dieser Adresse
    zurückkehrt (Navigation, Rückweg); ein Querverweis mit anderen Filtern beginnt oben.
- **D5 Rückweg und Blättern** (Entscheidung 9), als Leiste über dem Kopf der Scheibe (`CardContextBar`):
  - **Rückweg:** links „← Scheiben“ oder „← Letzte 90 Tage“ (`backLabel`), als Name „Zurück zu „Scheiben““.
  - **Blättern:** rechts „‹ vorige · nächste ›“ in zeitlicher Folge der Scheiben des Kontexts; vorige ist die
    ältere. Am Ende ist der Link ausgegraut (`aria-disabled`, kein `href`).
  - **Kontext:**
    - aus der Liste: ihre Scheiben mit den Filtern der Herkunft (Familie, Art, Merkmal, Zeitraum);
    - aus dem Fortschritt: die Scheiben seines Zeitraums nach seinem Zustand (Art, nur Probe);
    - ohne Herkunft und von Start: kein Blättern (Start kommt mit N5).
  - Blättern behält Herkunft, Wertung und Abschnitt (`siblingRoute`). Kein Wischen.
- **D6 Symbole** aus `lucide-react` (Katalog, wie `packages/ui`):
  - Start `House`, Scheiben `List`, Scannen `ScanQrCode`, Fortschritt `ChartLine`, Profil `CircleUser` (Konto,
    conventions §4), Admin `Shield` (§4), Rückweg `ArrowLeft`, Blättern `ChevronLeft`/`ChevronRight`.
  - Spiegel bekommt kein Marken-Symbol; die Seitenleiste nennt es nur mit Namen (`Target`, `Crosshair` und
    `CircleDot` sind vergeben).
- **D7 Labor:**
  - Der Rahmen umgibt jede Ansicht; die Navigation wechselt die Bereiche.
  - Der Labor-Kopf verliert „Ansicht: Scheiben | Scheibe | Zeitraum“ und bekommt „Labor: App | Beispiele“. Die
    Beispielscheiben (heute „Scheibe“) haben keine Adresse; in „Beispiele“ ist kein Bereich aktiv.
  - Start, Scannen, Profil und Admin zeigen eine Platzhalter-Seite mit dem Schritt, der sie bringt (N5, N6, N7);
    Profil enthält den Eintrag „Admin“.
  - Das Labor ist Admin (`isAdmin`), damit der Eintrag zu sehen ist.
- **D8 Nicht im Umfang:**
  - Auswahl (N4), Start (N5), Offen (N6), echte Routen in `apps/spiegel` (N7);
  - Browser-Zurück: Das Artifact lässt nur einfache Anker in die Adresse; das Labor hat keinen eigenen
    Verlauf.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/nav/areas.ts` (+ Test) | neu: `Area`, `areaOf`, `AreaMemory`, `areaLinks` |
| `packages/shot-ui/src/nav/context.ts` (+ Test) | neu: `neighbours`, `contextCardIds` |
| `packages/shot-ui/src/nav/RouteLink.tsx` (+ Test) | neu: `RouteLinkProvider`, `RouteLink`, `useRouteNavigate` |
| `packages/shot-ui/src/layout/AppFrame.tsx` (+ Test) | neu: Seitenleiste, untere Leiste, schmale Leiste, `--app-bar` |
| `packages/shot-ui/src/nav/CardContextBar.tsx` (+ Test) | neu: Rückweg und Blättern |
| `packages/shot-ui/src/layout/ReturnPill.tsx`, `useTargetFit.ts` (+ Tests) | `--app-bar` |
| `packages/shot-ui/src/list/EveningList.tsx`, `ListControls.tsx` (+ Tests) | Links statt `onOpen`, `onFamily`, `onProgress` |
| `packages/shot-ui/src/period/CardList.tsx`, `CardReadout.tsx` (+ Tests) | Links statt `onShowAll`, `onOpen` |
| `packages/shot-ui/package.json` | `lucide-react` (Katalog), Exporte |
| `tools/labor/src/App.tsx`, `LaborHeader.tsx`, `CardView.tsx`, `ListView.tsx`, `PeriodView.tsx` | Rahmen, Wege über Adressen |
| `tools/labor/src/PlaceholderView.tsx` | neu: Start, Scannen, Profil, Admin |
| `tools/labor/pruefung.js` | Umschalter auf Navigation, neue Prüfungen |
| `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`, `vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-roadmap.md`, `vault/architecture/architecture.md` | Doku |

## Required Docs

- `vault/conventions.md` (§4 Symbole, §10 Design 2)
- `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`
- `vault/spiegel/spiegel-navigation.md` (Entscheidungen 9, 10, 11, 16; „Umgesetzt in N1/N2“)
- `vault/spiegel/spiegel-mobile.md` (Sprungleiste, Pille, Querformat)

## Aufgaben

### Task 1: Bereiche (`nav/areas.ts`)

- `type Area = "start" | "cards" | "scan" | "progress" | "profile" | "admin"`.
- `areaOf(route: Route): Area | null`:
  - `start` und `open` → start; `cards` → cards; `progress` → progress; `scan` → scan;
  - `profile` und `trash` → profile; `admin` → admin; `unknown` → null;
  - `card` und `compare` nach der Herkunft: Liste und ohne Herkunft → cards, Fortschritt → progress, Start → start.
- `interface AreaMemory { cards: ListRoute | null; progress: ProgressRoute | null }`.
- `areaLinks(memory: AreaMemory, family: string | null): Record<Area, Route>`:
  - cards: die gemerkte Liste mit `family` und `evening: null`, sonst `{ page: "cards", query: { ...DEFAULT_LIST, family }, evening: null }`;
  - progress: der gemerkte Fortschritt mit `family`, `section: null` und `chosen: null`, wenn die Familie wechselt;
    sonst `{ ...DEFAULT_PROGRESS, family }`;
  - start `{ page: "start" }`, scan, profile, admin `{ page: "admin", section: null }`.
- **Test:** Handwerte je Seite für `areaOf`. Für `areaLinks`:
  - Familie ersetzt, Abend fällt weg;
  - die Wahl bleibt bei gleicher Familie und fällt bei anderer;
  - ohne Gedächtnis die Vorgabe;
  - `urlFromRoute` der Links: `/cards?family=lp-freihand`, `/progress?family=lp-freihand`.

### Task 2: Kontext der Scheibe (`nav/context.ts`)

- `neighbours(ids: readonly string[], id: string): { prev: string | null; next: string | null }`. Die `ids`
  stehen in zeitlicher Folge; `prev` ist die ältere. Ohne `id` in der Folge: beide null.
- `contextCardIds(card: CardRoute, input: { cards: readonly ListInputCard[]; nowMs: number; timeZone: string; named: readonly NamedPeriod[] }): string[] | null`:
  - **Herkunft Liste:** `cardListModel(input.cards, origin.query, { …, scoring: card.scoring })`, alle Zeilen,
    nach Beginn und Id sortiert;
  - **Herkunft Fortschritt:** `periodModel({ cards: Scheiben der Familie, state: periodStateFromRoute(backRoute(card), …), … }).cards`.
    Ohne Familie in der Herkunft gilt die erste Familie der Eingabe, wie in `cardListModel`;
  - **sonst:** null.
- **Test** mit `periodCard`:
  - Liste mit Art „Wettkampf“: nur Wettkämpfe in zeitlicher Folge;
  - Fortschritt mit Zeitraum: nur Scheiben im Zeitraum;
  - `neighbours` am Anfang, in der Mitte und am Ende; unbekannte Id.
  - Gegenprobe: eine Liste mit Art „Training“ ergibt andere Nachbarn als „Alle“.

### Task 3: Links (`nav/RouteLink.tsx`)

- `RouteLinkContext`: `{ href: (route: Route) => string; navigate?: (route: Route) => void; component?: ElementType }`.
  Vorgabe: `href = urlFromRoute`, ohne `navigate`, Komponente `"a"`.
- `RouteLinkProvider({ value, children })`.
- `RouteLink({ route, className, children, ...rest })` (rest: `aria-*`, `data-*`, `title`) rendert
  `component` mit `href`. Mit `navigate` und ohne Modifikator (`metaKey`, `ctrlKey`, `shiftKey`, `altKey`,
  `button !== 0`): `preventDefault()` und `navigate(route)`.
- `useRouteNavigate(): (route: Route) => void`: `navigate` des Providers, sonst `location.assign(href(route))`.
  Für die Zeile der Liste, die als Ganzes klickbar ist.
- **Test** (`renderToStaticMarkup`):
  - `href` aus `urlFromRoute`, mit Provider aus dessen `href`;
  - eigene Komponente;
  - Attribute werden durchgereicht.
  - Das Abfangen prüft eine reine Hilfsfunktion `shouldIntercept(event)` mit Handwerten (Modifikator, Taste).

### Task 4: Rahmen (`layout/AppFrame.tsx`)

- `pnpm --filter @vereinsheim/shot-ui add lucide-react@catalog:`, danach `pnpm install --frozen-lockfile`
  (conventions §9).
- Props: `{ current: Area | null; links: Record<Area, Route>; openCount: number; isAdmin: boolean; children }`.
- **Wurzel:** `<div data-app-frame className="[--app-bar:72px] lg:[--app-bar:0px] max-lg:[@media(max-height:499px)]:[--app-bar:0px]">`.
- **Seitenleiste:** `<nav aria-label="Bereiche" data-app-sidebar>`, `hidden lg:flex`, fest links, `w-56`,
  `border-r border-border bg-surface`.
  - Oben „Spiegel“ (`font-display`).
  - Dann Start (mit Abzeichen), Scheiben, Fortschritt, „QR scannen“ (`bg-primary text-primary-foreground`,
    rund), eine Trennlinie, Profil, Admin (nur `isAdmin`, als letzter).
  - Aktiv über `aria-current="page"` und `aria-[current=page]:bg-accent-wash`.
- **Untere Leiste:** `<nav aria-label="Bereiche" data-app-bar>`, `fixed inset-x-0 bottom-0 z-30 lg:hidden`, unter
  500 px Höhe ausgeblendet, `h-14` plus `pb-[env(safe-area-inset-bottom)]`.
  - Fünf gleiche Felder mit Symbol und kurzem Text (`text-[11px]`).
  - Die Mitte ist Scannen: Kreis `size-14 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg`, mit
    `aria-label="QR scannen"`.
  - Abzeichen am Start-Symbol.
- **Schmale Leiste** (Querformat): `<nav aria-label="Bereiche" data-app-rail>`, nur unter 1024 px Breite und 500 px
  Höhe sichtbar, `w-16`, fest links. Nur Symbole, jedes mit `aria-label`, dieselben fünf Einträge.
- **Inhalt:** `lg:pl-56`, im Querformat `pl-16`, unten `pb-[calc(var(--app-bar)+env(safe-area-inset-bottom))]`.
- **Abzeichen:** `openCount > 0`, Zahl in `bg-primary text-primary-foreground`, der Link heißt dann
  „Start, 2 offen“.
- Alle Einträge sind `RouteLink`s auf `links[area]`.
- **Test:**
  - je Leiste die Einträge in Reihenfolge, Admin nur mit `isAdmin` und nur in der Seitenleiste;
  - `aria-current` am aktiven Bereich, der Zähler im Namen;
  - die `href` aus `links`, `--app-bar` an der Wurzel;
  - keine Palette-Klassen, kein `dark:`.

### Task 5: Pille und Scheibe über der Leiste

- `ReturnPill`: `pb-[calc(1rem+var(--app-bar,0px)+env(safe-area-inset-bottom))]`.
- `targetRoom(viewportHeight, columnHeight, boxHeight, barPx = 0)` zieht `barPx` ab. `useTargetFit` liest
  `parseFloat(getComputedStyle(node).getPropertyValue("--app-bar")) || 0`.
- **Test:**
  - `targetRoom` mit Leiste: Handwert, unter `MIN_TARGET_PX` null;
  - `ReturnPill` enthält `var(--app-bar,0px)`.

### Task 6: Rückweg und Blättern (`nav/CardContextBar.tsx`)

- Props: `{ back: Route; backText: string; prev: CardRoute | null; next: CardRoute | null }`.
- `<nav aria-label="Scheibe im Kontext" data-card-context className="flex items-center justify-between gap-3">`:
  - links `RouteLink` mit `ArrowLeft` und `backText`, Name `Zurück zu „{backText}“`;
  - rechts „vorige“ und „nächste“ mit Chevron. Ohne Ziel ein `<span aria-disabled="true">` in
    `text-muted-foreground`.
- **Test:**
  - `href` von Rückweg, vorige und nächste;
  - ausgegraut ohne Ziel, ohne `href`;
  - die Namen.

### Task 7: Links in Liste und Fortschritt

- **`EveningList`:**
  - `onOpen` wird `cardRoute: (id: string) => CardRoute`, `onFamily` wird
    `otherFamilyRoute: (family: string, day: string) => ListRoute`.
  - Die kleine Scheibe ist ein `RouteLink` mit dem Namen der Zeile. Die Zeile (`tr`) folgt beim Klick über
    `useRouteNavigate`.
  - Der Hinweis ist ein `RouteLink`.
- **`ListControls`:** `onProgress` wird `progress: ProgressRoute`; „Verlauf dieser Filter“ ist ein `RouteLink`.
- **`CardList`:** `onShowAll` wird `showAll?: ListRoute`.
- **`CardReadout` und `CardLine`:** `onOpen` wird `cardRoute: (id: string) => CardRoute`; „Scheibe öffnen“ ist ein
  `RouteLink`.
- **Test:** In den bestehenden Markup-Tests werden die Knöpfe zu Links mit `href` (zum Beispiel
  `href="/cards/a?from=list&amp;family=lg-freihand"`). Die Zeile behält `data-card-row`.

### Task 8: Labor über Adressen

- **`App`:**
  - Ein Router im Speicher: `go(route: Route)` setzt die Ansicht.
    - `cards`: `changeList`, Abend-Anker → `scrollIntoView`;
    - `progress`: `changePeriod({ type: "restore", … })`;
    - `card`: die Scheibe der Saison mit dieser Adresse;
    - `start`, `scan`, `profile`, `admin`, `open`, `trash`: Platzhalter.
  - **Scrollstelle (D4):** Beim Verlassen merkt sich der Bereich `scrollY` mit seiner Adresse. Beim Betreten mit
    derselben Adresse kehrt sie zurück, sonst `scrollTo(0, 0)`.
  - `RouteLinkProvider` mit `navigate: go` um alles.
  - `AppFrame` mit `current = areaOf(…)` (in „Beispiele“ null),
    `links = areaLinks({ cards: Liste, progress: progressRoute(period, null) }, period.family)`, `openCount: 2`,
    `isAdmin: true`.
  - Es entfallen `open`, `openFromPeriod`, `openFromList`, `goBack`, `toProgress`, `toList`, `showFamily` und
    `returnTo`.
- **`LaborHeader`:** Statt „Ansicht“ ein `Segmented` „Labor“ mit „App“ und „Beispiele“; „App“ geht zur letzten
  Ansicht der App (anfangs Scheiben).
- **`CardView`:**
  - Mit geöffneter Scheibe steht über `CardPage` die `CardContextBar` mit `backRoute`, `backLabel` und den
    Nachbarn: `contextCardIds` über die Saison, `neighbours`, `siblingRoute`.
  - Der Knopf „Zurück zu …“ im Labor-Kopf entfällt.
- **`ListView`, `PeriodView`:** Routen statt Rückrufe (`cardRoute = (id) => openCard(listRoute, id, …)`,
  `progressFromList`, `listFromProgress`, `listOnEvening`).
- **`PlaceholderView`:** Titel, ein Satz („Start kommt mit N5.“, „Scannen kommt mit N6.“, „Profil kommt mit N7.“,
  „Admin kommt mit N7.“). In Profil zusätzlich ein `RouteLink` „Admin“.
- Die Speicherwerte `labor.mode` bleiben: `list`, `period`, `card` (Beispiele) und neu `start`, `scan`, `profile`,
  `admin`. Die Anker der Zeitraum-Seite und die Abende öffnen ihre Ansicht wie bisher.

### Task 9: Skriptprüfung

- **Helfer:**
  - `area(label)`: der sichtbare Link der Navigation mit diesem Namen (`[data-app-frame] nav a`, `offsetParent`
    nicht null);
  - `link(label)`: ein Link nach Text oder `aria-label`.
- **Umstellen:**
  - `button("Scheibe")` → `button("Beispiele")`, `button("Scheiben")` → `area("Scheiben")`,
    `button("Zeitraum")` → `area("Fortschritt")`;
  - „Zurück zu „…““, „Scheibe öffnen“, „Verlauf dieser Filter“ und „Alle in Scheiben zeigen“ als `link(…)`.
- **Neu:**
  - **1280 × 900:** Seitenleiste sichtbar, Einträge in Reihenfolge mit Admin zuletzt, Abzeichen „2“, der Inhalt
    beginnt rechts der Leiste (≥ 224 px), `aria-current` am Bereich. Keine untere Leiste.
  - **390 × 844:** untere Leiste mit fünf Einträgen, Scannen in der Mitte und höher als die anderen, kein Admin,
    keine Seitenleiste.
    - Die letzte Zeile der Liste lässt sich über die Leiste scrollen (Unterkante ≤ Fensterhöhe − 72).
    - Kein seitliches Scrollen.
  - **812 × 375:** schmale Leiste, keine untere Leiste; die bestehende Prüfung „Scheibe passt unter die Leiste“
    bleibt grün.
  - **768 × 1024:** Scheibe und Serien enden über der unteren Leiste.
  - **Familie und Gedächtnis:**
    - In der Liste Luftpistole und Art „Wettkampf“ wählen.
    - Der Link „Fortschritt“ hat `family=lp-freihand` und öffnet Luftpistole.
    - „Scheiben“ zurück zeigt weiter Wettkampf, an derselben Scrollstelle.
  - **Blättern aus der Liste** mit Art „Wettkampf“:
    - „vorige“ und „nächste“ sind die zeitlichen Nachbarn unter den Wettkämpfen (gegen `Li().model` gerechnet).
    - Bei der neuesten Scheibe ist „nächste“ ausgegraut.
    - Der Rückweg nach dem Blättern führt in die Liste mit denselben Filtern.
  - **Blättern aus dem Fortschritt:** Die Nachbarn liegen im Zeitraum.
  - **Pille auf dem Telefon:** Nach „Auf der Scheibe“ steht die Pille über der Leiste (Unterkante ≤ Fensterhöhe − 72).
  - **Jeder Link** der Navigation, des Rückwegs und des Blätterns hat eine `href`, die `routeOf` hin und zurück
    gleich lässt.

### Task 10: Doku

- `packages/shot-ui/CLAUDE.md`:
  - Exporte `nav/areas`, `nav/context`, `nav/RouteLink`, `nav/CardContextBar`, `layout/AppFrame`;
  - Regel „Rahmen und Links“ (D1–D5): Seiten verlinken über `RouteLink`, nie über Rückrufe für Wege.
- `tools/labor/CLAUDE.md`:
  - Rahmen, „Labor: App | Beispiele“, Platzhalter, Router im Speicher, Scrollstelle je Bereich;
  - Prüfhelfer `area`, `link`.
- `vault/spiegel/spiegel-navigation.md`: Abschnitt „Umgesetzt in N3“ mit D1–D7. Für N7: `component` des Providers
  ist `next/link`, `navigate` entfällt.
- `vault/spiegel/spiegel-roadmap.md` (N3 erledigt), `vault/architecture/architecture.md` (shot-ui: Rahmen).

## Teststeps

1. `pnpm --filter @vereinsheim/shot-ui test` — neue Tests für Bereiche, Kontext, Links, Rahmen, Leiste, Pille;
   die angepassten Markup-Tests.
2. `pnpm --filter @vereinsheim/labor build` (direkt), dann `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL.
3. Gegenproben per Mutation (je rot, dann zurück):
   - `areaLinks` ohne Ersetzen der Familie;
   - `neighbours` mit vertauschtem `prev`/`next`;
   - `contextCardIds` ohne Art-Filter;
   - `--app-bar` 0 px auf dem Telefon (Pille, letzte Zeile).
4. `pnpm check` grün vor jedem Commit.

## Verification

- `pnpm check` grün, `node .claude/vault-lint.mjs` gültig.
- Labor direkt gebaut, `pruefen` mit 0 FAIL.
- **Sichtprüfung über Screenshots aus Headless-Chrome:**
  - Desktop 1280 hell und dunkel; Telefon 390 und Querformat 812 × 375 in einem Rahmen (`iframe`), nicht über die
    Fenstergröße;
  - Screenshots unbeschnitten ansehen (`sips` schneidet mittig);
  - was nicht zu sehen ist (Hover, Fokus), steht als „nicht gesehen“ im Bericht.
- Artifact neu veröffentlichen.
