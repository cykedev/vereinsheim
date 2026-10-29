# R · Reiter in einer Zeile, die wischt (`TabBar`)

Teilplan „Reiter“ (R) des Vorhabens „Treffsicher geht in Spiegel auf“ (Koordinationsplan
`plans/2026-10-26-treffsicher-in-spiegel.md`, Basisbranch `feat/treffsicher-in-spiegel`). Kindsession `tis-r-tab-bar`,
Branch `feat/tis-r-tab-bar` von **`main`** (vor dem Abzweigen prüfen, dass der Worktree auf dem lokalen `main` steht,
nicht auf `origin/main`), Merge nach `main`. Entscheidung des Users vom 29. Oktober 2026.

## Kontext

Reiter sind die Navigation zwischen Seiten oder Ansichten eines Bereichs. Der User hat am 29. Oktober 2026 entschieden:
Reiter stehen in **allen Apps in einer Zeile, die wischt**; sie brechen nie in mehrere Zeilen um. Mehrzeilige Reiter
sind verworfen. **Auswahlen** (etwa `Segmented` mit `wrap` im Blatt „Filter“: Listen, Merkmale) sind keine Reiter und
dürfen weiter umbrechen.

Heute in `main`:

- Ringwerk `CompetitionTabs` arbeitet schon so (eine Zeile, scrollt in sich, gewählter Reiter rückt ins Bild), aber
  app-lokal.
- Spiegel `AdminTabs` bricht bewusst um (`flex flex-wrap`, „damit am Telefon keiner verschwindet“). Das hebt die
  Entscheidung auf.
- Spiegel `ProgressSwitch` (in `shot-ui`) ist eine Reiterleiste mit zwei Links in einem anderen Aussehen (gewählt als
  weiße Pille).
- Das Tagebuch hat im Basisbranch eine eigene Reiterleiste (`DiaryHeader` in
  `apps/spiegel/src/diary/components/DiaryList.tsx`, weiße Pille). Die stellt **Teil 2c** selbst auf `TabBar` um,
  **nicht dieser Plan** (der Code existiert in `main` nicht).

R baut einen gemeinsamen Baustein, stellt die Reiterleisten in `main` darauf um, schreibt die Regel in die Konventionen
und hält sie mit einer Gate-Regel fest.

## Ansatz

### Baustein `@vereinsheim/ui/design2/tab-bar`

Neue Datei `packages/ui/src/design2/tab-bar.tsx` (`"use client"`), Export in `packages/ui/package.json`:
`"./design2/tab-bar": "./src/design2/tab-bar.tsx"`.

Link wie im Rahmen: `AppFrame` hängt nicht an Next, die App reicht `renderLink(item, props)` herein und rendert damit
ihren Link (`next/link`, `RouteLink`). `TabBar` folgt diesem Muster. Die Adresse steht im Eintrag der App (generisch
`T extends TabBarItem`), `TabBar` braucht sie nicht.

```tsx
"use client"

import { Fragment, useEffect, useRef, type ReactNode } from "react"

import { cn } from "@vereinsheim/lib/utils"

/** ein Reiter; die App erweitert ihn um ihr Ziel (`href`, Route) und rendert den Link in `renderLink` */
export interface TabBarItem {
  key: string
  label: string
}

/** was der Link eines Reiters bekommt; die App rendert damit ihren Link (`next/link`, `RouteLink`) */
export interface TabLinkProps {
  "aria-current"?: "page" | "true"
  className: string
  children: ReactNode
}

export interface TabBarProps<T extends TabBarItem> {
  /** Name der Leiste für Screenreader (`aria-label` am `<nav>`), etwa „Admin“ */
  label: string
  items: readonly T[]
  /** Schlüssel des gezeigten Reiters; null: keiner */
  current: string | null
  /**
   * auf einer Unterseite des Reiters (ein Konto, eine Disziplin): markiert als `aria-current="true"` statt „page“, der
   * Link führt zurück zur Seite des Reiters
   */
  detail?: boolean
  renderLink: (item: T, props: TabLinkProps) => ReactNode
  /** am `<nav>`, etwa die Höhe einer Leiste (`JUMP_BAR.height`) */
  className?: string
}

/** die Leiste: eine Zeile, zu breit scrollt sie in sich, ohne sichtbare Scrollbar */
export const TAB_BAR =
  "inline-flex max-w-full min-w-0 overflow-x-auto rounded-full border border-border bg-surface-2 p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

/** ein Reiter: bricht nie, schrumpft nie; gewählt in der Farbe der App wie die Wahl im Segment-Umschalter */
export const TAB =
  "shrink-0 rounded-full px-3.5 py-2 text-[13px] leading-none font-semibold whitespace-nowrap text-foreground-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"

/**
 * um wie viel die Leiste seitlich rücken muss, damit der Reiter ganz im Bild steht, mit 8 px Luft; 0, wenn er schon
 * im Bild steht
 */
export function revealOffset(
  tab: { left: number; right: number },
  bar: { left: number; right: number }
): number {
  if (tab.left < bar.left) return tab.left - bar.left - 8
  if (tab.right > bar.right) return tab.right - bar.right + 8
  return 0
}

/**
 * Reiter (Design 2): Navigation zwischen den Seiten eines Bereichs, als Links. Immer eine Zeile; ist sie breiter als ihr
 * Platz, wischt man sie seitlich, die Seite bleibt stehen. Der gezeigte Reiter rückt beim Öffnen und bei jedem Wechsel
 * ins Bild. Auswahlen sind `Segmented`, nicht `TabBar`.
 */
export function TabBar<T extends TabBarItem>({
  label,
  items,
  current,
  detail,
  renderLink,
  className,
}: TabBarProps<T>) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current
    const active = el?.querySelector<HTMLElement>("[aria-current]")
    if (!el || !active || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft += revealOffset(active.getBoundingClientRect(), el.getBoundingClientRect())
  }, [current, detail])
  return (
    // min-w-0: als Raster- oder Flex-Kind macht die Leiste die Spalte nicht breiter als die Seite
    <nav aria-label={label} className={cn("flex max-w-full min-w-0 items-center", className)}>
      <div ref={bar} data-tab-bar className={TAB_BAR}>
        {items.map((item) => (
          <Fragment key={item.key}>
            {renderLink(item, {
              "aria-current": item.key === current ? (detail ? "true" : "page") : undefined,
              className: TAB,
              children: item.label,
            })}
          </Fragment>
        ))}
      </div>
    </nav>
  )
}
```

Klassen und Verhalten sind die von `CompetitionTabs` (dort seit Design 2 im Betrieb), dazu `aria-current="true"` für
Unterseiten aus `AdminTabs` und `min-w-0` am `<nav>` gegen das Verbreitern einer Rasterspalte
(`spiegel-mobile`: „eine 512 px breite Reiterleiste ließ die ganze Seite 102 px seitlich scrollen“). `Segmented` bleibt,
wie es ist (eigene Kopie der Rück-ins-Bild-Logik; nicht umbauen, `Segmented` nutzen alle drei Apps).

**Wrapper mit `renderLink` sind Client-Komponenten:** Eine Funktion geht nicht vom Server zum Client. `AdminTabs` (heute
Server-Komponente) bekommt `"use client"`; seine Aufrufer (Server-Seiten, `AdminHeader`) geben nur `current` und
`detail` weiter, das bleibt erlaubt. `CompetitionTabs` und `ProgressSwitch` sind schon Client-Komponenten.

### Aussehen: gewählt in der Farbe der App (`bg-primary`), nicht als weiße Pille

Ein Aussehen für alle Reiter. Gewählt: der Reiter in der Akzentfarbe (`bg-primary text-primary-foreground`) auf der
Leiste `bg-surface-2` mit Rahmen, wie `CompetitionTabs` und `AdminTabs`. Begründung:

1. **Gleich wie die Reiter der Analyse:** Die Reiter der Analyse (`AnalysisStrip`, Treffsichers Statistik) sind
   `Segmented scroll` und markieren mit `bg-primary`, ebenso die Sprungleiste (`SectionNav`). Reiter, die eine Seite
   wechseln, und Reiter, die eine Ansicht in der Seite wechseln, sehen damit gleich aus. Mit der weißen Pille hätte
   Spiegel zwei Arten Reiter nebeneinander (Fortschritt: Leiste oben weiß, Analyse darunter blau).
2. **Kontrast des Zustands:** Die weiße Pille unterscheidet sich von der Leiste nur um 1,08 : 1 (hell, `card` #ffffff auf
   `surface-2` #f4f6fa) bzw. 1,09 : 1 (dunkel, #141b26 auf #1a2330); `shadow-sm` ist im Dunkeln kaum zu sehen. Der
   gewählte Reiter fiele damit unter die 3 : 1 für Bedienzustände (WCAG 1.4.11). `primary` auf `surface-2`: hell 5,1 bis
   5,5 : 1, dunkel 7,8 bis 9,3 : 1 in allen drei Akzenten.
3. **Bestand:** Drei von vier Leisten in `main` (`CompetitionTabs`, `AdminTabs`, `SectionNav`) markieren schon mit
   `bg-primary`; nur `ProgressSwitch` nicht.

Folge: `ProgressSwitch` („Zeitraum · Vergleichen“) wechselt sichtbar von weiß auf blau. Das Tagebuch (2c) übernimmt
dasselbe Aussehen über `TabBar`.

### Gefundene Reiterleisten und Entscheidung

| Stelle | Heute | Entscheidung |
| --- | --- | --- |
| Ringwerk `components/app/shell/CompetitionTabs.tsx` | eine Zeile, wischt, `bg-primary`, app-lokal | **auf `TabBar`**, Verhalten und Aussehen gleich; Prop-Form (`tabs`, `current` als href) bleibt für `CompetitionDetailHeader` |
| Spiegel `components/admin/AdminTabs.tsx` | `flex flex-wrap`, bricht um | **auf `TabBar`** (wischt), `"use client"`, `detail` → `aria-current="true"` |
| `shot-ui/src/nav/ProgressSwitch.tsx` („Zeitraum · Vergleichen“) | eine Zeile (`w-max`), wischt nicht, weiße Pille | **auf `TabBar`** mit `RouteLink` in `renderLink`, Aussehen `bg-primary`; `className` geht ans `<nav>` |
| `shot-ui/src/analysis/AnalysisStrip.tsx` (Reiter der Analyse, Scheibe und Zeitraum) | `Segmented scroll`, Radiogruppe, eine Zeile, wischt | **bleibt**: Reiter in der Seite (keine Links, Pfeiltasten), erfüllt die Regel schon |
| Treffsicher `statistics/StatisticsAnalysis.tsx` (Rekorde, Trefferlage, Einflüsse, Selbstbild) | `Segmented scroll`, eine Zeile, wischt; die Zeile darum (`flex-wrap`) bricht nur zwischen Reitern und „Erklärungen“ | **bleibt** |
| `shot-ui/src/layout/SectionNav.tsx` (Sprungleiste) | Anker in der Seite, eine Zeile, am Telefon teilen sich 3 oder 4 Einträge die Breite (`grid-cols-N`) | **bleibt**: keine Reiter (Sprung in der Seite), bricht nie um |
| `packages/ui/src/design2/app-frame.tsx` (Seitenleiste, untere Leiste) | Rahmen der App | **bleibt**: kein Reiter |
| Profil in allen Apps (`nav` „Weitere Bereiche“ / „Admin“, Raster aus Karten, nur am Telefon) | Kacheln untereinander | **bleibt**: Liste von Zielen, kein Reiter |
| `shot-ui/src/nav/CardContextBar.tsx` („Zurück zu …“, Blättern) | `flex-wrap` | **bleibt**: kein Reiter |
| Spiegel `components/card/DisciplineChoice.tsx` | Liste zur Wahl im Blatt (`aria-current="true"`) | **bleibt**: Auswahl |
| `Segmented wrap` (Blatt „Filter“: Listen, Merkmale) und alle übrigen `Segmented` | Auswahl | **bleibt** (darf umbrechen) |
| `packages/ui/src/ui/tabs.tsx` (shadcn `Tabs`) | von keiner App genutzt | **bleibt** unberührt |
| Spiegel `diary/components/DiaryList.tsx` `DiaryHeader` | nur im Basisbranch, weiße Pille, wischt nicht | **Teil 2c**, nicht R |

### Konvention und Gate

- `vault/conventions.md` §2 (Komponenten-Kanon), neuer Punkt nach „Detail-Aktionen“:
  „**Reiter:** `<TabBar>` aus `@vereinsheim/ui/design2/tab-bar` für die Seiten eines Bereichs (Links), in allen Apps
  **eine Zeile, die wischt**; nie mehrzeilig. Der gezeigte Reiter ist in der Farbe der App markiert und rückt ins Bild,
  auf einer Unterseite ist der Reiter ihres Bereichs markiert (`detail`) und führt zurück. Reiter in einer Seite (die
  Analyse) sind `Segmented scroll`. Auswahlen (`Segmented`, mit `wrap` für viele oder lange Möglichkeiten) sind keine
  Reiter und dürfen umbrechen. Entschieden am 29. Oktober 2026.“
- §10, Liste der allgemeinen Bausteine: „Reiter `tab-bar`“ ergänzen. §8, Liste „Erzwungen“: die neue Regel ergänzen.
- `packages/ui/CLAUDE.md`, Tabelle „Bausteine von Design 2“, neue Zeile:
  `design2/tab-bar` | `TabBar` (Reiter als Links, eine Zeile, die wischt, gewählter im Bild, `detail` für Unterseiten),
  `TabBarItem`, `TabLinkProps`, `renderLink` wie `app-frame`.
- `packages/shot-ui/CLAUDE.md`, Zeile `ProgressSwitch`: „… zwei Links über `TabBar` aus `@vereinsheim/ui/design2/tab-bar`“.
- `vault/spiegel/spiegel-navigation.md` (Absatz Admin): „Jede Admin-Seite trägt dieselben Reiter (`AdminTabs`, eine
  Zeile, die wischt) …“.

**Gate-Regel** (`scripts/consistency-check.sh`, Abschnitt „Konventionen von Design 2 (fatal)“, geschützter Pfad):
Ein `<nav` mit `flex-wrap` ist zu breit (trifft `CardContextBar`, kein Reiter). Eine Reiterleiste von Hand erkennt man
eng am Stil der gezeigten Seite mit Fläche, `aria-[current=page]:bg-…`. Nach R setzen ihn in `main` nur noch `TabBar`
und `AppFrame` (Seitenleiste, `bg-accent-wash`). `aria-[current=true]` (Auswahl `DisciplineChoice`) und
`aria-[current=location]` (Sprungleiste) trifft die Regel nicht.

```bash
  # §2: Reiter sind TabBar (eine Zeile, die wischt). Eine Reiterleiste von Hand erkennt man am Stil der gezeigten
  # Seite mit Flaeche; ihn setzen nur TabBar und der Rahmen der App.
  n=$({ grep -rn --include='*.tsx' -E 'aria-\[current=page\]:bg-' "$dir" 2>/dev/null || true; } \
    | { grep -vE '\.test\.tsx:|packages/ui/src/design2/(tab-bar|app-frame)\.tsx:' || true; } | wc -l | tr -d ' ')
  [[ "$n" != "0" ]] && report "$name" "$n Reiterleiste(n) von Hand — TabBar aus @vereinsheim/ui/design2/tab-bar (§2)"
```

Dazu die Kopfzeilen des Skripts von „§3/§4/§6/§7/§10“ auf „§2/§3/§4/§6/§7/§10“ (Zeile 6 und die `ok`-Meldung).

## Dateien

Neu: `packages/ui/src/design2/tab-bar.tsx`, `packages/ui/src/design2/tab-bar.test.tsx`.

Geändert:

- `packages/ui/package.json` (Export), `packages/ui/CLAUDE.md`
- `apps/ringwerk/src/components/app/shell/CompetitionTabs.tsx`, `apps/ringwerk/tools/pruefen.ts` (Abschnitt „Reiter“)
- `apps/spiegel/src/components/admin/AdminTabs.tsx`, `apps/spiegel/src/components/admin/AdminTabs.test.tsx`
- `packages/shot-ui/src/nav/ProgressSwitch.tsx`, `packages/shot-ui/src/nav/ProgressSwitch.test.tsx`,
  `packages/shot-ui/CLAUDE.md`
- `apps/spiegel/tools/pruefen.ts` (Selektoren `[data-progress-switch]`, neuer Abschnitt „Reiter“)
- `vault/conventions.md`, `vault/spiegel/spiegel-navigation.md`
- `scripts/consistency-check.sh` (**geschützter Pfad**, Aufgabe 8)

Keine Migration, kein Schema, keine Brücke (keine neue `spiegel-bridge` auf dem Pi nötig), kein `compose.yml`, keine
neuen Texte in der Oberfläche (die `aria-label` bleiben „Admin“, „Seiten des Wettbewerbs“, „Fortschritt“).

## Required Docs

- `vault/conventions.md` §2, §3 (Raster, `min-w-0`), §5, §8 (Regeln mit Probe-Datei), §9 („Ein Feld fester Breite …“:
  `innerWidth === visualViewport.width`), §10
- `packages/ui/CLAUDE.md` (App-frei: Links über `renderLink`), `packages/shot-ui/CLAUDE.md` (`RouteLink`)
- `apps/ringwerk/CLAUDE.md` „Vor jedem Release“ und `vault/apps/ringwerk/ringwerk-pruefbestand.md` (Ringwerk ist
  produktionskritisch: Änderung verlustfrei, eigener Abgleich, eigenes Release)
- `apps/spiegel/CLAUDE.md` (Admin, `pruefen`)
- `vault/spiegel/spiegel-mobile.md` („Reiter in einer Zeile“, seitliches Scrollen)
- Vorbild: `apps/ringwerk/src/components/app/shell/CompetitionTabs.tsx`, `packages/ui/src/design2/app-frame.tsx`
  (`renderLink`), `packages/ui/src/design2/segmented.test.tsx` (Markup-Tests)

## Aufgaben

0. Worktree vorbereiten: `apps/*/.env` und `apps/spiegel/tools/private` aus dem Haupt-Checkout verlinken (mit
   `[ -e … ] ||` vor `ln -s`), `pnpm install --frozen-lockfile`. Ringwerk-Ausgangsstand an echten Daten **vor** der
   ersten Codeänderung (der Branch steht noch auf `main`): `pnpm --filter ringwerk build`, dann
   `pnpm --filter ringwerk pruefen:aufnehmen --echt` (Chrome braucht die Sandbox aus; nur lesend, alles unter
   `reports/ringwerk-echt/`). Hat der User die Dev-Datenbank von Ringwerk nicht frisch geholt, mit dem vorhandenen Stand
   aufnehmen und das im Bericht sagen.

1. **Baustein** `packages/ui/src/design2/tab-bar.tsx` wie oben, Export in `packages/ui/package.json`.
   Tests `tab-bar.test.tsx` (`renderToStaticMarkup`, `renderLink` als `(item, props) => createElement("a", { href:
   item.href, ...props })`, Einträge `{ key, label, href }`):
   - eine Zeile, die wischt: Klassen der Leiste (`data-tab-bar`) enthalten `overflow-x-auto`, `max-w-full`, `min-w-0`,
     `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`, **nicht** `flex-wrap`; jeder Link `shrink-0` und
     `whitespace-nowrap`; im ganzen Markup kein `flex-wrap`.
   - `<nav aria-label="…">` mit `min-w-0`; `className` landet am `<nav>`.
   - `current` → genau ein Link mit `aria-current="page"`; mit `detail` genau einer mit `aria-current="true"`; `current:
     null` → keiner.
   - Reihenfolge der Links wie `items`, Text = `label`, `href` aus dem Eintrag.
   - Farben nur aus Tokens: `aria-[current=page]:bg-primary` vorhanden, kein `bg-card`, keine Palette-Klasse.
   - `revealOffset`: links außerhalb → negativ mit 8 px Luft (`{left: 10, right: 60}` in `{left: 20, right: 200}` →
     −18), rechts außerhalb → positiv (`{left: 180, right: 230}` → 38), im Bild → 0.
   Commit `feat(ui): TabBar, tabs in one swiping row`.

2. **Ringwerk** `CompetitionTabs` auf `TabBar`: Signatur bleibt (`tabs: CompetitionTab[]`, `current` als href),
   intern `items = tabs.map((t) => ({ key: t.href, label: t.label, href: t.href }))`, `label="Seiten des Wettbewerbs"`,
   `className={JUMP_BAR.height}`, `renderLink={(tab, props) => <Link href={tab.href} {...props} />}`. Eigener
   `useEffect`, `useRef` und die Klassen entfallen. Kommentar: „Reiter der Seiten eines Wettbewerbs über `TabBar`“.
   `apps/ringwerk/tools/pruefen.ts`, `tabs()`: Selektoren `[data-competition-tabs]` → `[data-tab-bar]`, Breiten
   `[360, 390, 1280]` (360 und 390 mit Höhe 844), zusätzlich `vv: innerWidth === Math.round(visualViewport.width)` und
   `sw: document.documentElement.scrollWidth <= innerWidth` in die Prüfung aufnehmen; Name der Prüfung
   „… Reiter in einer Zeile, die Seite markiert und im Bild, die Seite scrollt nicht seitlich“.
   Commit `refactor(ringwerk): competition tabs on the shared TabBar`.

3. **Spiegel** `AdminTabs` auf `TabBar`: `"use client"`, `label="Admin"`, `items={ADMIN_SECTIONS}`,
   `current={current}`, `detail={detail}`, `renderLink={(s, props) => <Link href={s.href} {...props} />}`. Kommentar
   neu: „Reiter des Admins auf jeder Admin-Seite, eine Zeile, die wischt. Auf einer Unterseite (ein Konto, eine
   Disziplin, eine Liste) ist der Reiter ihres Bereichs markiert und führt zurück zu dessen Seite.“ `AdminHeader`: das
   Raster `grid gap-3` bekommt `grid-cols-1`, damit die Spalte nicht mit der Leiste wächst (die Unterseiten stehen in
   `section` mit `PAGE_SINGLE`, dort genügt `min-w-0` am `<nav>`; die Prüfung im Browser belegt beides).
   `AdminTabs.test.tsx` bleibt grün (Reihenfolge, `page`, `true`) und bekommt einen Fall „eine Zeile, die wischt“: kein
   `flex-wrap`, `data-tab-bar` und `overflow-x-auto` vorhanden.
   Commit `fix(spiegel): admin tabs in one swiping row`.

4. **`ProgressSwitch`** auf `TabBar`: `items = [{ key: "progress", label: "Zeitraum" }, { key: "compare", label:
   "Vergleichen" }]`, `label="Fortschritt"`, `current={current}`, `className={className}`,
   `renderLink={(entry, props) => <RouteLink route={routes[entry.key]} {...props} />}`. `data-progress-switch` und
   `w-max` entfallen (die Leiste ist `inline-flex` und so breit wie ihr Inhalt). Kommentar: „… zwei Links als Reiter
   (`TabBar`) …“, ohne „im Look des Segment-Umschalters“. `ProgressSwitch.test.tsx`: die Regexe auf `href` und
   `aria-current` an die Reihenfolge der Attribute anpassen, die `RouteLink` ausgibt (erst rendern, dann anpassen;
   die Aussagen bleiben: zwei Links, gezeigte Seite `aria-current="page"`), dazu `aria-[current=page]:bg-primary`
   vorhanden, `bg-card` nicht.
   `apps/spiegel/tools/pruefen.ts`: Selektoren `[data-progress-switch]` (Zeilen um 2202 und 2251) →
   `nav[aria-label="Fortschritt"]`.
   Commit `refactor(shot-ui): progress switch on the shared TabBar`.

5. **Skriptprüfung Spiegel**, neue Funktion `tabBars(page)` und Abschnitt „Reiter“ in `main()`: für `/progress` und
   `/compare` bei 360 und 390 px (Höhe 844) je `[data-tab-bar]`: eine Zeile (eine `top` über alle Links),
   `[aria-current]` vorhanden und im Bild der Leiste (±1 px), `document.documentElement.scrollWidth <= innerWidth`,
   `innerWidth === Math.round(visualViewport.width)`. Danach bei 360 px auf `/progress` die Leiste mit
   `scrollLeft = scrollWidth` ans Ende schieben, „Vergleichen“ antippen und auf `/compare` wieder prüfen, dass der
   gewählte Reiter im Bild steht. Admin prüft die Skriptprüfung nicht (das Demo-Konto ist kein Admin), siehe
   Verifikation.
   Commit `test(spiegel): script check for tab bars at phone width`.

6. **Konvention und Doku:** `vault/conventions.md` (§2 neuer Punkt „Reiter“, §8 Regel in „Erzwungen“, §10 Baustein),
   `packages/ui/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `vault/spiegel/spiegel-navigation.md` mit den Texten oben;
   Prettier nicht auf `vault/`. `node .claude/vault-lint.mjs` bzw. `/sync-graph`: grün.
   Commit `docs(conventions): tabs are one swiping row (TabBar)`.

7. **Gate und Prüfungen** (siehe Verifikation): `pnpm check`, Ringwerk-Abgleich, Skriptprüfungen, Browser.
   Befunde als eigene Commits.

8. **Gate-Regel (Circuit-Breaker, geschützter Pfad `scripts/`):** Der Autopilot-Guard verweigert `scripts/`. Die
   Kindsession hält hier an, legt der koordinierenden Session den Diff (Regel oben + Kopfzeilen) vor und schreibt ihn
   erst nach OK, außerhalb des Autopiloten (Marker entfernt). Danach:
   - `bash -n scripts/consistency-check.sh`
   - grüner Ist-Zustand: `bash scripts/consistency-check.sh` → „ok alle Konventions-Checks (§2/§3/§4/§6/§7/§10)“.
   - Probe mit Verstoß: `apps/spiegel/src/components/admin/TabProbe.tsx` mit
     `<a aria-current="page" className="aria-[current=page]:bg-card">Probe</a>` anlegen → FATAL „apps/spiegel: 1
     Reiterleiste(n) von Hand“; dieselbe Zeile in `TabProbe.test.tsx` → kein Treffer; beide Dateien löschen, Gate
     wieder ok.
   - Probe gegen falsch-positive: `DisciplineChoice.tsx` (`aria-[current=true]`), `SectionNav.tsx`
     (`aria-[current=location]`), `app-frame.tsx` lösen nichts aus (ist im grünen Lauf belegt).
   - Wirkung auf den Basisbranch belegen, ohne ihn anzufassen:
     `git show feat/treffsicher-in-spiegel:apps/spiegel/src/diary/components/DiaryList.tsx | grep -cE 'aria-\[current=page\]:bg-'`
     → 1 (siehe „Offene Punkte“).
   Commit `chore(gate): hand-built tab bars are fatal, TabBar is the one`.

9. Plan per letztem Commit entfernen (`plans/` enthält nur offene Pläne).

## Tests und Verifikation

- `pnpm check` im Worktree grün (lint, format, test, tsc, `next build` aller drei Apps); der Stop-Hook prüft den
  Haupt-Checkout, das Gate im Worktree läuft deshalb selbst.
- **Ringwerk** (vor dem Merge, `apps/ringwerk/CLAUDE.md` „Vor jedem Release“): `pnpm --filter ringwerk build`,
  `pnpm --filter ringwerk pruefdaten`, `pruefen:vergleichen` **0 Fehler** (die Klassen der Reiter sind gleich, erwartet
  auch 0 Hinweise und keine geänderten Seitenbilder), `pruefen:ablaeufe` grün bis auf bekannte Befunde,
  `pruefen:vergleichen --echt` gegen die Aufnahme aus Aufgabe 0: 0 Fehler. `pnpm --filter ringwerk pruefen` (eigener
  Build auf :3013): Abschnitt „Reiter“ bei 360, 390 und 1280 px grün, sonst 0 FAIL. Den Ausgangsstand nicht neu
  aufnehmen.
- **Spiegel:** Dev-Server aus dem Worktree auf **:3023** (`pnpm --filter spiegel exec next dev --port 3023`, die
  geschriebene `AGENTS.md` danach löschen); `seed:own --demo`, `BASE_URL=http://localhost:3023 pnpm --filter spiegel
  pruefen`, `seed:own --email <Konto des Users>` in **einem** Befehl. Grün, Abschnitt „Reiter“ eingeschlossen (bricht der
  erste Lauf nach dem Start des Servers mit „Inspected target navigated or closed“ ab, einmal wiederholen).
- **Browser, Telefonbreite 390 und 360 px** (Browser-Pane, `resize_window` mit Breite 390 bzw. 360), hell und dunkel:
  - Spiegel `/progress` und `/compare`: Leiste in einer Zeile, gewählter Reiter blau und im Bild.
  - Spiegel Admin `/admin`, `/admin/site` (letzter Reiter „Anlage und Brücke“, muss beim Öffnen ins Bild rücken),
    `/admin/users/<id>` (Unterseite, `aria-current="true"`): Leiste wischt, gewählter Reiter sichtbar, kein seitliches
    Scrollen der Seite (`innerWidth === visualViewport.width` und `scrollWidth <= innerWidth` per `javascript_tool`).
    Das braucht ein Admin-Konto: Der User meldet sich im Pane selbst an. Ist das nicht möglich, steht Admin im Bericht
    als **„nicht belegt“**, abgedeckt durch die Markup-Tests von `AdminTabs` und denselben Baustein in Ringwerk und im
    Fortschritt.
  - Ringwerk auf **:3020** (`pnpm --filter ringwerk exec next dev --webpack --port 3020`): Seite eines Wettbewerbs mit
    allen Reitern (Ergebnis, Playoffs, Erfassen, Teilnehmer, Protokoll) bei 390 und 360 px, auf „Protokoll“ rückt der
    letzte Reiter ins Bild; Anmeldung im Pane durch den User oder Beleg aus `pnpm --filter ringwerk pruefen`.
  - Desktop 1280 px: Leisten unverändert in einer Zeile ohne Wischen.
- Nicht belegt bleibt voraussichtlich: Wischen mit dem Finger am echten Telefon (das Pane wischt mit der Maus bzw.
  über `scrollLeft`).

## Offene Punkte für den Koordinator

**Entschieden am 29. Oktober 2026:** Der User hat das Aussehen in der Farbe der App (`bg-primary`) bestätigt. Das
Tagebuch stellt 2c auf `TabBar` um, nach dem Rebase des Basisbranchs auf `main`. Die übrigen Punkte gelten wie
beschrieben.

1. **Aussehen der Reiter:** gewählt in der Farbe der App (`bg-primary`) für alle, nicht die weiße Pille (Begründung
   oben: gleich wie die Reiter der Analyse, Kontrast des Zustands 1,1 : 1 bei der Pille, Bestand). Sichtbare Folge in
   `main`: „Zeitraum · Vergleichen“ im Fortschritt wird blau. Das Tagebuch übernimmt das Aussehen in 2c. Bitte vom User
   bestätigen lassen, bevor `/implement` startet.
2. **Reihenfolge mit dem Basisbranch:** Nach dem Merge von R nach `main` und dem Rebase des Basisbranchs schlägt die
   Gate-Regel bei `DiaryHeader` an (1 Treffer, `aria-[current=page]:bg-card`), das Gate des Basisbranchs ist dann rot,
   bis `DiaryHeader` auf `TabBar` steht. Vorschlag: `DiaryHeader` beim Rebase in einem eigenen kleinen Commit auf
   `TabBar` umstellen (Teil 2c oder die koordinierende Session), nicht die Regel aufweichen. Kleine Konflikte erwartet
   in `vault/conventions.md` (im Basisbranch geändert).
3. **Release:** R berührt Ringwerk (produktionskritisch): eigenes Release an einem Tag ohne Wettkampf, mit Backup
   und dem Abgleich oben. Spiegel ändert sichtbar Admin und Fortschritt. Treffsicher ändert sich sichtbar nicht (neue
   Datei im geteilten Paket), ein Release ist dort nicht nötig.
4. **Admin im Browser** braucht ein Admin-Konto: Anmeldung durch den User im Pane, sonst „nicht belegt“.
5. **Keine ADR:** Die Entscheidung ist eine Konvention (§2) und bekommt keine eigene ADR; `AdminTabs` hob mit „brechen
   um, damit keiner verschwindet“ eine frühere Wahl auf, das steht nur im Kommentar und ändert sich mit.

## Geschützte Pfade

- **Aufgabe 8:** `scripts/consistency-check.sh` (Autopilot-Guard: `scripts/`) — Circuit-Breaker, Diff an die
  koordinierende Session, Schreiben nach OK außerhalb des Autopiloten.
- Sonst keine: kein Schema, keine Migration, kein `compose.yml`/`Caddyfile`, nichts unter `vault/decisions/` oder
  `.claude/`; kein Push, kein Deploy, kein Migrate.
