# @vereinsheim/ui — Claude Scope-Notiz

Geteilte **UI-Schicht** (shadcn-Primitives, App-Shell, Admin-Oberfläche der Login-Sperren und Design 2)
für alle drei Apps (ADR-015/016). Jede Komponente gibt es nur einmal — Drift damit **strukturell unmöglich**.

## Was hier liegt

| Export                           | Inhalt                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@vereinsheim/ui/<name>`         | `src/ui/<name>.tsx` — shadcn-Primitives (button, card, dialog, …)                                                                                                              |
| `@vereinsheim/ui/shell/<name>`   | `src/shell/<name>.tsx` — DetailActionBar, PageHeader, Providers                                                                                                                |
| `@vereinsheim/ui/admin/<name>`   | `src/admin/<name>.tsx` — `LoginRateLimitInsights`, `LoginRateLimitTable` (Admin-Ansicht der Login-Sperren)                                                                     |
| `@vereinsheim/ui/design2.css`    | `design2.css` — Design 2 (ADR-030, ADR-032): eigene Tokens, hell auf `:root`, dunkel unter `.dark`, Akzent je App über `data-app`; Platz des Rahmens `--app-bar`, `--app-rail` |
| `@vereinsheim/ui/design2/<name>` | `src/design2/<name>.tsx` — Design-2-Bausteine, siehe unten                                                                                                                     |

### Bausteine von Design 2

| Export                    | Inhalt                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design2/segmented`       | Segment-Umschalter, `scroll` oder `wrap`                                                                                                                                                      |
| `design2/toggle-chip`     | Schalter-Chip                                                                                                                                                                                 |
| `design2/sheet`           | Blatt: am Telefon von unten, am Desktop daneben                                                                                                                                               |
| `design2/round-toggle`    | weicher Kreis für eine Einstellung                                                                                                                                                            |
| `design2/theme`           | `ThemeScript storageKey` (im `<head>`), `ThemeProvider storageKey`, `useTheme` (`theme`, `resolved`, `setTheme`), `themeScript`                                                               |
| `design2/theme-switch`    | `ThemeSwitch`: Darstellung System, Hell, Dunkel                                                                                                                                               |
| `design2/toaster`         | `Toaster` (sonner) in Design 2, hell oder dunkel wie `useTheme().resolved`; über der unteren Leiste (`--app-bar`) und neben der schmalen (`--app-rail`)                                       |
| `design2/app-frame`       | `AppFrame`: Seitenleiste ab 1024 px (Unterseiten über `FrameItem.sub`), untere Leiste mit Aktion in der Mitte, schmale Leiste quer; `FrameItem`, `renderLink`; an der Wurzel `data-app-frame` |
| `design2/page`            | `Page`: Breite, Rand und Platz über der unteren Leiste einer Seite                                                                                                                            |
| `design2/page-header`     | `PageHeader`: Seitenkopf mit Titel in der Schrift der Marke, Satz und Aktion                                                                                                                  |
| `design2/card`            | `Card` und ihre Teile wie `ui/card`, in den Maßen von Spiegel (16 px Rand, 12 px Abstand, große Radien)                                                                                       |
| `design2/decision-dialog` | `DecisionDialog` (mit `children`, `confirmDisabled`), `DecisionBody`, `NoticeDialog`, Typ `Decision`: Folgen vor dem Bestätigen                                                               |
| `design2/undo`            | `UndoHost`, `useUndo`, `UndoBar`, Typ `UndoResult`: „Gelöscht · Rückgängig“                                                                                                                   |
| `design2/help`            | `HelpText`, `HELP_FIELDS`, `HelpIcon`, `HelpButton`, `HelpBody` (ohne Client-Grenze)                                                                                                          |
| `design2/help-sheet`      | `HelpSheet` (Erklärung als Blatt), `HelpProvider`, `useHelp`                                                                                                                                  |
| `design2/bar`             | `BAR_PX`, `EDGE_PX`, `JUMP_BAR`: Klassen der 56 px hohen klebenden Leisten                                                                                                                    |
| `design2/score-colors`    | `SCORE_HEX`, `scoreKey`: Ringwert-Farben als Hex für Orte ohne CSS-Variablen (PDF)                                                                                                            |

## Regeln

- **Just-in-time-Paket**: TS-Source direkt; Next transpiliert via `transpilePackages` (in
  `@vereinsheim/config/next`). `"use client"` bleibt in den interaktiven Komponenten.
- **`react`/`react-dom`/`next`/`next-auth` sind peerDependencies** (App liefert sie → eine Instanz).
  `radix-ui`/`@radix-ui/react-slider`/`class-variance-authority`/`next-themes` sind Paket-deps;
  `lucide-react`/`sonner` zusätzlich App-deps (App-Code nutzt sie auch). `cn` kommt aus `@vereinsheim/lib`.
- **Tailwind `@source`**: `design2.css` nimmt die Paket-Sourcen ins Class-Scanning — sonst fehlen die
  Klassen der Paket-Komponenten im App-Build (Tailwind v4 scannt sonst nur den App-Baum). Die Bausteine aus
  `@vereinsheim/shot-ui` nimmt der `globals.css`-Stub jeder App dazu.
- **Kein `"use server"`**; **shadcn-CLI** läuft weiter im App-Kontext (`components.json` + der
  `globals.css`-Stub bleiben app-lokal).
- Cross-Importe paket-intern **relativ** (`./button`, `../ui/alert-dialog`) — nicht über `@vereinsheim/ui`.
- **Design 2** (`design2.css`, `src/design2/`) nutzen alle drei Apps; das Drift-Gate hält ihre `globals.css`-Stubs
  byte-gleich und prüft die Regeln von Design 2 auch in `src/` dieses Pakets (ohne die shadcn-Primitives bei `dark:`,
  `vault/conventions.md` §8). Jede Farbe, die zwischen hell und dunkel wechselt, steht in beiden Blöcken;
  die Scheibe (Papier, Spiegel, Ringwert-Farben) ist in beiden Themes gleich. Akzent, Schrift auf dem Akzent und
  `rank-*` tragen auf der Kartenfläche mindestens 4,5 : 1, `chart-*` mindestens 3 : 1, je App und Theme (Test
  `tokens.test.ts`).
- **Platz des Rahmens als Token:** `design2.css` setzt `--app-bar` (Platz der unteren Leiste samt Aktion: 72 px, 0 ab
  1024 px und im Querformat) und `--app-rail` (Breite der schmalen Leiste, nur im Querformat) an `:root`, solange ein
  `AppFrame` (`data-app-frame`) auf der Seite steht; dieselben Grenzen wie die Klassen der Leisten (Test
  `frame-space.test.ts`). Was unten fest steht, rückt über `--app-bar` und `env(safe-area-inset-bottom)`, nie mit eigener
  Zahl: „Rückgängig“ (`UndoBar`) 12 px darüber, die Toasts 16 px (sonner unter 600 px Breite) bzw. 24 px. Beide zugleich
  lägen übereinander, der Toast oben; heute zeigt nur „Scheibe löschen“ in Spiegel „Rückgängig“, ohne Toast. Eine
  Aktion, die beides tut, braucht eine eigene Lösung.
- **App-frei:** Bausteine aus `src/design2/` kennen keine App: Texte, Routen und Schlüssel kommen als Props
  (`brand`, `renderLink`, `storageKey`, `Decision`). Was den Fachkern braucht, bleibt in `@vereinsheim/shot-ui`.
- **`src/ui/*` steht in Design 2:** Dialoge auf der Kartenfläche mit `rounded-2xl` über `scrim`, Titel in
  `font-display`, Leerzustand in `design2/card` (Test `src/ui/dialogs.test.tsx`). Neue Formen entstehen weiter unter
  `src/design2/`.
- Verhalten/Styles ändert man **hier**, nicht in den Apps. Nach Änderungen: `pnpm check` grün.
